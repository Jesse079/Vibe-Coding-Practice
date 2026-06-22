# 项目文档索引

本目录保存隔空手写画板的长期标准。开发日志放在根目录 `dev-logs/`，不与规范文档混放。

| 文件 | 用途 |
| --- | --- |
| `01-requirements.md` | 产品需求、首版范围和不做事项 |
| `02-technical-design.md` | 技术栈、模块、数据流和性能策略 |
| `03-interaction-design.md` | 三种模式、手势、界面和防误触规则 |
| `04-development-plan.md` | 小里程碑、顺序和阶段验收条件 |
| `05-coding-standards.md` | TypeScript、Canvas、命名和错误处理规范 |
| `06-testing-and-acceptance.md` | 自动检查、手工场景和最终验收标准 |
| `07-security-and-privacy.md` | 摄像头、隐私、依赖和敏感信息规则 |
| `08-decisions.md` | 已确认的技术与产品决策记录 |

## 维护规则

- 需求改变：更新 `01-requirements.md`，必要时同步交互和测试文档。
- 技术方案改变：更新 `02-technical-design.md` 和 `08-decisions.md`。
- 手势或状态改变：更新 `03-interaction-design.md` 和测试场景。
- 里程碑完成：更新 `04-development-plan.md` 和当日开发日志。
- 文档之间冲突时，以用户最新确认的需求为准，并立即修正文档。

