export type CameraStatus =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "interrupted"
  | "unsupported"
  | "error";

export interface CameraState {
  status: CameraStatus;
  message: string;
}

type StateListener = (state: CameraState) => void;

const cameraConstraints: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 },
  },
};

export class CameraController {
  private stream: MediaStream | null = null;

  public constructor(
    private readonly videoElement: HTMLVideoElement,
    private readonly onStateChange: StateListener,
  ) {}

  public async start(): Promise<void> {
    this.stop(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.emit("unsupported", "当前浏览器不支持摄像头访问。");
      return;
    }

    this.emit("requesting", "请在浏览器提示中允许使用摄像头。");

    try {
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
      this.stream = stream;
      this.videoElement.srcObject = stream;

      for (const track of stream.getVideoTracks()) {
        track.addEventListener("ended", this.handleTrackEnded, { once: true });
      }

      await this.videoElement.play();
      this.emit("active", "摄像头已连接，画面仅在本机处理。");
    } catch (error: unknown) {
      this.stop(false);
      this.emitError(error);
    }
  }

  public stop(emitState = true): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.removeEventListener("ended", this.handleTrackEnded);
        track.stop();
      }
    }

    this.stream = null;
    this.videoElement.pause();
    this.videoElement.srcObject = null;

    if (emitState) {
      this.emit("idle", "摄像头已关闭。");
    }
  }

  private readonly handleTrackEnded = (): void => {
    this.stop(false);
    this.emit("interrupted", "摄像头连接已中断，请重新连接。");
  };

  private emitError(error: unknown): void {
    if (!(error instanceof DOMException)) {
      this.emit("error", "摄像头启动失败，请稍后重试。");
      return;
    }

    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        this.emit(
          "denied",
          "摄像头权限被拒绝，请在浏览器设置中允许后重试。",
        );
        break;
      case "NotFoundError":
      case "DevicesNotFoundError":
        this.emit("unavailable", "没有找到可用的摄像头设备。");
        break;
      case "NotReadableError":
      case "TrackStartError":
        this.emit(
          "unavailable",
          "摄像头可能正被其他程序占用，请关闭占用程序后重试。",
        );
        break;
      default:
        this.emit("error", "摄像头启动失败，请检查设备后重试。");
    }
  }

  private emit(status: CameraStatus, message: string): void {
    this.onStateChange({ status, message });
  }
}
