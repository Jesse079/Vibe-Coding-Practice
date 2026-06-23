# Design QA

- source visual truth path: `docs/assets/immersive-stage-reference.png`
- implementation screenshot path: `docs/assets/implementation-config.png`
- combined comparison: `docs/assets/design-comparison.png`
- viewport: 1440 × 1024
- state: 画笔配置面板打开；实现使用本地假摄像头空背景，参考图使用真实手部和示例笔迹

## Full-view comparison evidence

并排图显示两者都采用全屏深色画布、顶部轻量状态、底部横向工具坞以及工具坞上方的居中配置面板。配置面板均包含五色、五档粗细和高对比完成按钮，主要绘图区未被永久侧栏占用。

## Focused region comparison evidence

配置面板和底部工具坞在全图中足够清晰，可直接检查控件数量、选中反馈、圆角、间距和文字；本次不需要额外局部裁切。参考图中的手、关键点和笔迹属于运行内容，假摄像头截图无法复现，不将其判为静态 UI 缺失。

## Findings

- 无 P0、P1 或 P2 问题。
- 字体与排版：系统无衬线字体、标题和小型状态文字层级清晰；实现比概念图更克制，属于可接受差异。
- 间距与布局：配置面板、底部工具坞和顶部状态保持同一视觉轴线，画布占比符合参考。
- 颜色与视觉令牌：深黑背景、青色激活态、五种标志色和红色危险操作与参考一致。
- 图像与资产：摄像头是运行时媒体，不使用占位图片；关键点由 Canvas 根据真实模型结果绘制。概念图没有需要单独导入的品牌资产。
- 文案：实现使用已确认的正式手势规则，未照搬概念图中与需求冲突的示意文案。

## Patches made since previous QA pass

- 增加底部画笔入口，鼠标可打开配置面板。
- 配置完成后同步刷新底部颜色和粗细摘要。
- 配置或绘制模式下禁用清除，防止鼠标绕过模式约束。
- 保持配置完成后的捏合释放门控。

## Follow-up polish

- P3：真实摄像头测试后，可根据实际背景亮度微调遮罩透明度。
- P3：根据使用者手速微调捏合阈值和平滑系数。

final result: passed

