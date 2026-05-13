# What To Test

## Open Docker Provider Tasks

These tasks come from packaged Docker Browser cycles. Keep each task here until a fresh packaged Docker run proves it passes with browser screenshots and network evidence.

Passed and removed on 2026-05-13: continuing a historical Codex thread after `Codex -> OpenCode Zen` provider switch. Fresh evidence showed the same `#/thread/019e2117-b1dc-7401-804f-b86fadc97604` route stayed visible and `hi provider opencode zen` returned an assistant reply without a raw `thread not found` error.

### [ ] P0 - OpenRouter selected state must not fall back to Codex models silently

**Environment**

- Packaged Docker image built from the current branch.
- Auth-mounted container, preferably on `http://127.0.0.1:4192/#/`.
- OpenRouter key available to the container, or an explicit no-key state.

**Current evidence**

- Fresh run: packaged image `codexapp-provider-exec:local`, auth-mounted container on `http://127.0.0.1:4292/#/`.
- Browser screenshots:
  - `output/playwright/docker-exec-openrouter-before-dropdown.png`
  - `output/playwright/docker-exec-openrouter-dropdown.png`
- `/codex-api/free-mode/status` returned `enabled=true`, `hasCodexAuth=true`, `provider=openrouter`, `currentModel=big-pickle`, `wireApi=responses`.
- `/codex-api/provider-models` returned `exclusive=true`, `count=26`, first models including `openrouter/free`, `inclusionai/ring-2.6-1t:free`, and `baidu/cobuddy:free`.
- The composer model button still showed stale `big-pickle`.
- The dropdown showed OpenRouter models but also appended stale `big-pickle`.

**Repro**

1. Start an auth/Codex container with a fresh isolated `CODEX_HOME`.
2. Open Settings and switch provider from `Codex` to `OpenRouter`.
3. Open the composer model dropdown.
4. Inspect `/codex-api/free-mode/status` and `/codex-api/provider-models`.
5. Send `hi provider openrouter` only if OpenRouter is fully configured.

**Pass criteria**

- Settings, free-mode status, provider-models, and the model dropdown agree on the active provider state.
- If OpenRouter is configured, `/codex-api/provider-models` returns OpenRouter-compatible models and the dropdown does not show Codex-only catalog entries as the active list.
- If OpenRouter is not configured, the UI shows an explicit blocking state instead of retaining Codex models.
- No send after selecting OpenRouter uses a stale Codex, Groq, NIM, or previous-provider model.

**Validation evidence to capture**

- Browser screenshot of Settings showing `OpenRouter`.
- Browser screenshot of the model dropdown.
- Network evidence for `/codex-api/free-mode/status`, `/codex-api/provider-models`, and any send payload.
- Final chat reply or final visible provider configuration error.

### [ ] P0 - Custom NVIDIA NIM chat provider must drive dropdown and send through chat proxy

**Environment**

- Packaged Docker image built from the current branch.
- Auth-mounted container, preferably on `http://127.0.0.1:4192/#/`.
- NVIDIA API key mounted or configured for the container.

**Provider config**

- Base URL: `https://integrate.api.nvidia.com/v1`
- Wire API: `chat`

**Current evidence**

- Fresh run: packaged image `codexapp-provider-exec:local`, auth-mounted container on `http://127.0.0.1:4292/#/`.
- Browser screenshots:
  - `output/playwright/docker-exec-nim-home-stale-model.png`
  - `output/playwright/docker-exec-nim-dropdown-stale.png`
  - `output/playwright/docker-exec-nim-new-thread-send.png`
- `/codex-api/free-mode/status` returned `enabled=true`, `provider=custom`, `currentModel=01-ai/yi-large`, `customBaseUrl=https://integrate.api.nvidia.com/v1`, `wireApi=chat`.
- `/codex-api/provider-models` returned `source=custom`, `exclusive=true`, `count=123`, first models including `01-ai/yi-large`, `abacusai/dracarys-llama-3.1-70b-instruct`, and `adept/fuyu-8b`.
- The home composer still showed stale `big-pickle` instead of the NIM model.
- The dropdown did not show `01-ai/yi-large` in the tested UI state.
- Sending a new thread with `hi provider nvidia nim new thread` failed against the Responses path: `http://127.0.0.1:4190/codex-api/custom-proxy/v1/responses`.

**Repro**

1. Start an auth/Codex container with a fresh isolated `CODEX_HOME`.
2. Configure custom provider with the NIM base URL and `wireApi=chat`.
3. Refresh provider models.
4. Open the composer model dropdown and search for a known NIM model from the returned model list.
5. Select a valid NIM chat model.
6. Send `hi provider nvidia nim`.

**Pass criteria**

- Settings and `/codex-api/free-mode/status` show `provider=custom` and `wireApi=chat`.
- `/codex-api/provider-models` returns an exclusive NIM model list.
- The composer dropdown shows the NIM list, not Codex models.
- Sending uses the chat-completions proxy path and sends a non-empty `messages` array.
- The final chat state is either an assistant reply or the exact upstream error rendered in the conversation.
- There is no `messages field cannot be empty` error and no `/custom-proxy/v1/responses` request for the NIM chat provider.

**Validation evidence to capture**

- Browser screenshot of the custom provider settings.
- Browser screenshot of the NIM model dropdown.
- Browser screenshot of the reply or exact final error in the same thread.
- Network evidence for `/codex-api/free-mode/status`, `/codex-api/provider-models`, and the custom proxy send request body/path.

### [ ] P1 - Run Groq custom chat provider packaged Docker validation

**Environment**

- Packaged Docker image built from the current branch.
- Auth-mounted or no-auth container on a unique port.
- Groq API key available to the container.

**Provider config**

- Base URL: `https://api.groq.com/openai/v1`
- Wire API: `chat`

**Current evidence**

- Local KeePass registry had OpenRouter and NVIDIA keys, but no Groq key entry was found during the 2026-05-13 run.
- A fresh 2026-05-13 key lookup still found no Groq key entry.
- No valid Groq send test has been completed.

**Repro**

1. Add or provide a Groq API key for the packaged Docker container.
2. Configure custom provider with the Groq base URL and `wireApi=chat`.
3. Refresh provider models.
4. Open the composer model dropdown and select a valid Groq chat model.
5. Send `hi provider groq`.

**Pass criteria**

- `/codex-api/free-mode/status` shows `provider=custom` and `wireApi=chat`.
- `/codex-api/provider-models` returns an exclusive Groq model list.
- The composer dropdown shows Groq models, not Codex/OpenRouter/NIM stale entries.
- Sending uses the chat-completions proxy path and sends a non-empty `messages` array.
- The final chat state is either an assistant reply or the exact upstream error rendered in the conversation.
- There is no `messages field cannot be empty` error.

**Validation evidence to capture**

- Browser screenshot of the custom provider settings.
- Browser screenshot of the Groq model dropdown.
- Browser screenshot of the reply or exact final error in the same thread.
- Network evidence for `/codex-api/free-mode/status`, `/codex-api/provider-models`, and the custom proxy send request body/path.
