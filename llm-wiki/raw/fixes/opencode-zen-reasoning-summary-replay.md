# OpenCode Zen Reasoning Summary Replay Fix

## Date
2026-05-10

## Problem
After an OpenCode Zen `big-pickle` turn produced reasoning metadata, a later Responses-backed turn could fail with:

```json
{"type":"invalid_request_error","message":"[ArrayParam] [input[4].content] [array_above_max_length] Invalid 'input[4].content': array too long. Expected an array with maximum length 0, but got an array with length 1 instead."}
```

The local proxy had been translating upstream Chat Completions `reasoning_content` into a Responses `reasoning` output item with `content: [{ "type": "reasoning_text", "text": "..." }]`. When that item was replayed as conversation history into a later Responses request, the provider rejected non-empty `reasoning.content`.

## Fix
The unified Responses proxy now emits translated reasoning output as:

```json
{
  "type": "reasoning",
  "summary": [{ "type": "summary_text", "text": "..." }],
  "content": []
}
```

`responsesInputToMessages()` reads both `content` and `summary`, so later Chat Completions proxy turns still recover `reasoning_content` from the summary while Responses providers receive schema-valid empty reasoning content.

## Files
- `src/server/unifiedResponsesProxy.ts`
- `src/server/unifiedResponsesProxy.test.ts`
- `tests.md`

## Verification
- `pnpm vitest run src/server/unifiedResponsesProxy.test.ts`
- `pnpm run test:unit`
- `pnpm run build`
