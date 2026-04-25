# L3 · Run identity and lifecycle (090)

This note freezes **third-layer** vocabulary for runs and sessions so that event, scheduler, approval, and recovery work (091–095) can share one state model. It does **not** define L4 product UX.

## Run identity

- **`RunId`**: canonical string id for one agent run. It matches **`traceId`** on all current HTTP routes (`POST /v1/runs`, `GET /v1/runs/:traceId`, SSE stream, cancel).
- **Persistence** of terminal state lives in `agent_run_traces` (`packages/server` SQLite). In-flight runs also exist in memory (`TraceStreamHub`, abort controllers) until they finish.

## Execution mode and stream attachment (declared hints)

These are **substrate hints** on `CreateRunRequest` / `CreateRunResponseBody` / `TraceDto` / `TraceSummaryDto`:

| Field | Values | Meaning |
|--------|--------|---------|
| `executionMode` | `foreground` (default), `background` | Does **not** change the core run engine. `background` signals that the client may not block on the run (e.g. may skip opening SSE). |
| `streamAttachment` | `attached` (default), `detached` | Whether the client **intends** to hold `GET /v1/runs/:traceId/stream`. `detached` is valid for fire-and-forget; the server may still emit SSE for other observers. |

The server records these in an in-process map keyed by `traceId` so operator `GET` responses can echo them. After restart, traces read from DB fall back to **`foreground` / `attached`** until a future migration persists the columns.

## Persistence vs event vs approval state (do not merge enums)

- **Persistence (`RunFinalStatus`)**: terminal outcome written to `agent_run_traces` — `completed`, `failed`, `cancelled`, `aborted`, `budget_exhausted`.
- **Event / live plane**: SSE `StreamEvent` types (`text_delta`, `run_completed`, `run_failed`, …) — not the same enum as DB status.
- **Approval / danger (093)**: 使用独立 `ApprovalRecordDto` / `GET /v1/approvals` 系 API 与 `domain: approval` 事件，**不**在 `RunFinalStatus` 中占坑 `blocked`；L4+ 在工具侧自行对接 [L3_APPROVAL_DANGER.md](./L3_APPROVAL_DANGER.md) 后再观测 run。

## Attach, detach, resume, interrupt (minimal L3 semantics)

- **Attach (stream)**: open `GET /v1/runs/:traceId/stream` to receive SSE for that run.
- **Detach (stream)**: close the SSE connection; the run **continues** unless cancelled.
- **Resume (stream)**: if the run is still in flight, opening the stream again receives buffered/ live events per `TraceStreamHub` behavior.
- **Resume (session work)**: send a **new** user turn with `POST /v1/runs` (new `traceId`) on the same `sessionId` after history rehydration — this is a new run, not revival of an old trace id.
- **Interrupt (user)**: `POST /v1/runs/:traceId/cancel` — cooperative cancellation via `AbortSignal`; persisted status becomes `cancelled` when the engine reports it.

## Foreground / background / resumable / blocked / recoverable (mapping)

| Concept | L3 meaning in 090 |
|---------|-------------------|
| Foreground | Default `executionMode`; client typically attaches the stream. |
| Background | `executionMode: background`; same execution path; observability-oriented hint. |
| Resumable (session) | Session + message history remain; **new** runs can be started. Same `traceId` is not “resumed” after terminal persist. |
| Blocked | **不**以 Run 行终态表示；以 **093** 的 `ApprovalRecordDto.status`（如 `pending` 侧的产品语义）+ L4+ 不发起后续工具为准；见 [L3_APPROVAL_DANGER.md](./L3_APPROVAL_DANGER.md)。 |
| Recoverable | For `failed` runs, inspect `RunError.retryable` (payload / future DTO); retry by issuing a **new** run — not automatic in 090. |

## Operator and client surfaces

- **Operator / internal** tools may depend on `executionMode`, `streamAttachment`, and `RunId` as above.
- **`packages/sdk/client`** stays on the public session/run API; no new lifecycle-only surface required in 090.
