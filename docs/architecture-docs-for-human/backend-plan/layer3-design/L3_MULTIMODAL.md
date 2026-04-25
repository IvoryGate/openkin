# L3 Multimodal contract (095)

## Message parts (shared contract)

- `TextPart`, `JsonPart` — unchanged.
- `ImagePart` — `{ type: 'image', url, mimeType?, detail? }`. `url` may be `https:`, `http:`, or `data:`. L3 does not define upload; transport is reference-only.
- `FileRefPart` — `{ type: 'file_ref', ref, name?, mimeType?, sizeBytes? }`. L4+ resolves `ref` to content; L3 only carries metadata.

`MessagePart` = union of the above. Core `RunOptions.userMessage` passes a full user `Message` (095).

## Run request (`RunInputDto`)

- `text: string` — may be empty when `attachments` is non-empty.
- `attachments?:` array of `{ kind: 'image', url, ... }` | `{ kind: 'file', ref, ... }`.
- The service maps this to a single user `Message` and sets `userMessage` on the agent run; plain-text-only rows may still be stored as raw string in `messages.content`.

## Persistence (reference model)

- Single-text user turns: stored as the raw string (backward compatible).
- Any multimodal shape (multiple parts, or any non-`text-only` part): stored as `theworld:msg:v1:` + JSON `{"parts":[...]}` in `messages.content`.
- `GET /v1/sessions/:id/messages` returns the stored string; clients parse the prefix when they need structured parts.
- `POST /v1/runs` rehydrates in-memory history using the same format before appending the new turn.

## OpenAI path

`OpenAiCompatibleChatProvider` maps `ImagePart` to `image_url` content parts and `FileRefPart` to a text line `[Attached file: …] ref=…` for text-only API surfaces.

## Stream / events

- Run SSE line protocol is unchanged (`StreamEvent`). Multimodal user input is not duplicated as a separate event type; observability may log flattened text via server hooks.
- `pnpm test:multimodal` — HTTP acceptance for L3 run input + v1 user persistence + second run (mixed text + file).
