# 技术设计

## 技术栈

- 构建工具：Vite
- 开发语言：原生 TypeScript
- 页面实现：HTML、CSS、Canvas 2D
- 手部识别：MediaPipe `@mediapipe/tasks-vision` Hand Landmarker
- 依赖管理：npm
- 目标浏览器：桌面版 Chrome

首版不引入 React、Vue、状态管理库或绘图库。

当前锁定：

- `@mediapipe/tasks-vision`：`0.10.35`
- 模型：官方 Hand Landmarker float16 bundle
- 模型路径：`public/models/hand_landmarker.task`
- 模型 SHA-256：`FBC2A30080C3C557093B5DDFC334698132EB341044CCEE322CCF8BCF3607CDE1`
- WASM 路径：`public/mediapipe/wasm/`
- 推理策略：GPU 优先，初始化失败时回退 CPU

## 推荐模块

```text
src/
  main.ts
  styles.css
  types.ts
  camera/
  hand-tracking/
  gestures/
  state/
  drawing/
  ui/
public/
  models/
```

具体文件在工程初始化时确定，但模块职责不得混在一个超大文件中。

## 数据流

```text
摄像头视频帧
  -> Hand Landmarker
  -> 单手关键点结果
  -> 坐标镜像与画面裁切映射
  -> 手势快照
  -> 状态机
  -> 绘制引擎或配置/清除交互
  -> Canvas 与界面反馈
```

识别层只输出观察结果，不直接修改界面；状态机决定当前允许发生的行为。

## 核心类型

- `AppMode`：`idle | configuring | drawing`
- `BrushConfig`：颜色、线宽
- `Point`：画布坐标和时间
- `HandObservation`：关键点、置信信息、时间戳
- `GestureSnapshot`：五指张开、单食指、捏合状态和指针位置
- `Stroke`：固定画笔配置和有序点集合
- `AppEvent`：驱动状态转换的事件
- `AppState`：当前模式、画笔、笔画和交互进度

状态转换逻辑应使用纯函数或可独立测试的类，不能散落在 DOM 事件中。

当前实现：

- `src/hand-tracking/hand-tracker.ts`：模型加载、单手视频推理和性能统计。
- `src/gestures/gesture-recognizer.ts`：五指、单食指和捏合滞回。
- `src/state/app-state-machine.ts`：三个互斥模式。
- `src/drawing/drawing-engine.ts`：归一化笔画、平滑和重放。
- `src/app/air-drawing-app.ts`：组合模块并驱动 UI。
- `src/bootstrap.ts`：当前唯一页面入口。

## 坐标系统

- 摄像头视觉必须与用户镜像直觉一致。
- Hand Landmarker 的归一化坐标先转换到实际显示视频区域，再映射到画布。
- 必须考虑 `object-fit: cover` 产生的横向或纵向裁切。
- 视频、诊断层、交互指针和绘图层必须使用同一套映射函数。
- M4 已将映射实现集中在 `src/camera/cover-mapping.ts`：
  - `calculateCoverTransform` 计算缩放、渲染尺寸和裁切偏移。
  - `mapNormalizedPointToViewport` 负责归一化点、镜像和视口坐标转换。
- 绘图 Canvas 按 `devicePixelRatio` 设置实际像素尺寸，CSS 尺寸保持与视口一致。

## 手势判定

### 捏合

- 使用拇指尖与食指尖距离除以手掌尺度，避免手离摄像头远近导致固定像素阈值失效。
- 使用进入阈值和松开阈值两套阈值，形成滞回区间，减少临界状态抖动。
- 阈值先集中定义为可调常量，实机测试后再确定最终值。

### 五指张开

- 根据各手指关节方向和指尖相对手掌的位置判断伸展。
- 连续满足 0.6 秒才产生进入配置事件。
- 中途条件失效时清空计时。

### 单食指

- 食指伸展，其他非拇指手指收拢。
- 拇指姿态不作为唯一条件，降低左右手和手掌角度的影响。

## 绘制策略

- 使用捏合中心或稳定的食指尖作为画笔点，工程阶段通过实测选择更稳的一种。
- 输入点先做轻量低通滤波。
- 绘制时使用中点二次曲线或等价 Canvas 平滑方法连接采样点。
- 每一笔保存自身的 `BrushConfig`，不能依赖渲染时的全局画笔配置。
- 窗口缩放优先保存归一化点，或按比例重放笔画，避免直接拉伸位图。

## 性能策略

- 使用 `requestAnimationFrame` 驱动渲染和视频帧检查。
- 同一视频时间只执行一次识别。
- 初期在主线程测量实际帧率和阻塞情况。
- 只有确认识别造成明显卡顿时，才增加 Web Worker，避免过早复杂化。
- 诊断信息使用低频更新，避免每帧修改大量 DOM。
- 连续假视频流浏览器测试中，GPU 路径稳定在约 31 FPS、单次推理约 4ms；该结果只代表测试设备和无手背景，真实手部与设备需单独验证。

## 错误恢复

- 权限拒绝、无摄像头、模型加载失败和视频流中断分别显示可理解的状态。
- 手暂时离开画面时结束当前悬停计时；绘制中丢失手部超过短暂容错时间则安全抬笔。
- 页面卸载时停止媒体轨道并释放识别资源。
- M4 的摄像头状态由 `src/camera/camera-controller.ts` 统一管理；播放失败、页面离开或流中断时都会停止并释放媒体轨道。
