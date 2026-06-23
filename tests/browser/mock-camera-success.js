(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;

  const context = canvas.getContext("2d");
  let frame = 0;
  if (context) {
    context.fillStyle = "#253440";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const stream = canvas.captureStream(30);
  const [track] = stream.getVideoTracks();

  window.__mockCameraTrack = track;
  window.__mockCameraTimer = window.setInterval(() => {
    if (!context) return;
    frame += 1;
    context.fillStyle = frame % 2 === 0 ? "#253440" : "#263541";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#435866";
    context.fillRect((frame * 5) % canvas.width, 0, 4, canvas.height);
    if ("requestFrame" in track) track.requestFrame();
  }, 33);

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => stream,
    },
  });
})();
