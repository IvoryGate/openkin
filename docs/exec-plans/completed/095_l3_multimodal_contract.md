# 095 · L3 Multimodal Contract

## 目标

把当前仅有预留的多模态能力推进到第三层正式 contract：附件、多模态消息、多模态 run / stream / persistence reference 都要形成稳定协议。

## 背景

用户明确要求多模态不能继续只停留在“留有接口”。如果第四层后续要做：

- 图片 / 文件输入
- 多模态消息展示
- 多模态工具调用

第三层必须先提供稳定 schema。

## 已冻结决策

1. 本单先做协议，不做第四层最终交互。
2. 首期至少覆盖 image / file attachment 两类输入能力。
3. 首期允许用 reference / metadata 方式持久化，不要求一次完成所有媒体存储终态。
4. 不在本单内做第五层跨 surface 多模态 continuity。

## 允许修改

- `packages/shared/contracts/src/`
- `packages/server/src/`
- `packages/sdk/operator-client/src/`
- `scripts/`
- `docs/architecture-docs-for-agent/third-layer/`
- `docs/architecture-docs-for-human/backend-plan/layer3-design/`
- `docs/exec-plans/active/`
- 根 `package.json`（仅脚本）

## 禁止修改

- `packages/sdk/client/`（除非本单明确冻结并批准 client surface 变更）
- `packages/channel-core/`
- `packages/cli/src/tui/`
- `apps/web-console/`
- 不相关的底层多媒体渲染系统

## 低能力模型执行前必须先读

- `AGENTS.md`
- `docs/index.md`
- `docs/governance/MODEL_OPERATING_MODES.md`
- `090_l3_run_identity_and_lifecycle.md`
- `091_l3_unified_event_plane.md`
- 当前 shared contracts 与 message / stream 相关文件

## 本轮范围

1. 明确 attachment message shape
2. 明确 multimodal run request shape
3. 明确 multimodal stream event shape
4. 明确 attachment persistence / reference model
5. 明确 operator / product-shell-facing 的最小观察路径

## 本轮不做

- 不做第四层附件上传 UX
- 不做第五层 Web / Desktop / channel 多模态外扩
- 不做复杂媒体处理 pipeline
- 不做多模态 orchestration

## 验收标准

1. 第三层文档明确列出多模态 contract 边界
2. 至少一条自动化验证覆盖 attachment 或 multimodal message path
3. 多模态 contract 能被后续第四层产品能力直接消费
4. `pnpm check` 通过
5. `pnpm verify` 通过

## 必跑命令

```bash
pnpm check
pnpm verify
```

## 升级条件

1. 需要同步重设计 client surface
2. 需要一次性引入完整媒体存储系统
3. 需要跨到第五层 remote / channel multimodal continuity
4. `pnpm verify` 连续两轮不通过

## 关账与交付

- **Contract**：`ImagePart` / `FileRefPart`；`RunInputDto.attachments`；`RunOptions.userMessage`（core）传递完整 `Message`。
- **服务**：`POST /v1/runs` 解析 `input`，写入 `theworld:msg:v1:` 多段用户行；`importSessionHistory` 反序列化同格式。
- **LLM**：`OpenAiCompatibleChatProvider` 将 `image` 映射为 `image_url`；`file_ref` 为文本行。
- **可观测性**：`log-hook` 使用与持久化侧一致的展平串。
- **文档**：`THIRD_LAYER_COVERAGE.md`（095 节）、`L3_MULTIMODAL.md`。
- **自动化**：`pnpm test:multimodal`（根 `package.json`）。

**下一子单**：`096`（tooling exposure and introspection）。
