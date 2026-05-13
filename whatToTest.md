# What To Test

## Open Docker Provider Tasks

These tasks come from the packaged Docker Browser cycle on 2026-05-13. Keep each task here until a fresh packaged Docker run proves it passes with browser screenshots and network evidence.

### [ ] P0 - Continue or safely block historical threads after provider switch

**Environment**

- Packaged Docker image built from the current branch.
- Auth-mounted container, preferably on `http://127.0.0.1:4192/#/`.

**Current evidence**

- Browser screenshots:
  - `output/playwright/docker-provider-switch-zen-dropdown-fixed.png`
  - `output/playwright/docker-provider-switch-zen-result-fixed.png`
  - `output/playwright/docker-provider-switch-openrouter-result.png`
- URL remained stable after the route-continuity fix.
- Conversation remained visible.
- Sending after `Codex -> OpenCode Zen` failed with `RPC turn/start failed with HTTP 502: thread not found: <thread-id>`.

**Repro**

1. Start an auth/Codex container with a fresh isolated `CODEX_HOME`.
2. Open a Codex thread and record the full `#/thread/<thread-id>` URL.
3. Switch Settings provider from `Codex` to `OpenCode Zen`.
4. Confirm the URL still contains the same thread id and the conversation is visible.
5. Send `hi provider opencode zen`.

**Pass criteria**

- The URL stays on the same `#/thread/<thread-id>` route.
- The visible conversation remains in place.
- The UI either:
  - successfully continues the thread using the active provider, or
  - blocks sending before `turn/start` with a clear message and a safe new-thread path.
- The chat must not render a raw `thread not found` backend failure after the user presses Send.

**Validation evidence to capture**

- Browser screenshot before provider switch.
- Browser screenshot after provider switch with the same thread URL visible.
- Browser screenshot after sending or after the explicit blocked-send state.
- Network evidence for `/codex-api/free-mode/status`, `/codex-api/provider-models`, and the send path.

### [ ] P0 - OpenRouter selected state must not fall back to Codex models silently

**Environment**

- Packaged Docker image built from the current branch.
- Auth-mounted container, preferably on `http://127.0.0.1:4192/#/`.
- OpenRouter key available to the container, or an explicit no-key state.

**Current evidence**

- Browser screenshots:
  - `output/playwright/docker-provider-switch-openrouter-settings.png`
  - `output/playwright/docker-provider-switch-openrouter-dropdown.png`
- `/codex-api/free-mode/status` returned `enabled=false`, `hasCodexAuth=true`, `provider=openrouter`.
- `/codex-api/provider-models` returned `source=provider`, `providerId=""`, `count=0`.
- Settings showed `OpenRouter`, but the composer dropdown still showed Codex models such as `GPT-5.5` and `GPT-5.4`.

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

- Browser screenshots:
  - `output/playwright/docker-provider-switch-custom-nim-dropdown.png`
  - `output/playwright/docker-provider-switch-custom-nim-result.png`
- `/codex-api/free-mode/status` returned `enabled=true`, `provider=custom`, `customBaseUrl=https://integrate.api.nvidia.com/v1`, `wireApi=chat`.
- `/codex-api/provider-models` returned `source=custom`, `exclusive=true`, and 123 models.
- UI dropdown still showed Codex models.
- Searching for `moonshotai/kimi-k2.5` returned no results even though model discovery succeeded.
- Sending failed against the Responses path: `http://127.0.0.1:4192/codex-api/custom-proxy/v1/responses`.

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
- No valid Groq send test was completed.

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
