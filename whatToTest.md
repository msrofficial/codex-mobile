# What To Test

## Docker provider cycle failures from 2026-05-13

### Provider-switched historical thread cannot send

- Environment: packaged Docker image `codexapp-provider-cycle:local`, auth-mounted container on port `4192`.
- Browser evidence:
  - `output/playwright/docker-provider-switch-zen-dropdown-fixed.png`
  - `output/playwright/docker-provider-switch-zen-result-fixed.png`
  - `output/playwright/docker-provider-switch-openrouter-result.png`
- Repro:
  1. Start on an auth/Codex thread.
  2. Switch Settings provider from Codex to OpenCode Zen.
  3. Keep the same thread URL.
  4. Send `hi provider opencode zen`.
- Result:
  - URL remains stable after the route-continuity fix.
  - Conversation remains visible.
  - Send fails with `RPC turn/start failed with HTTP 502: thread not found: <thread-id>`.
- Expected:
  - Either the provider switch should make the routed thread runnable under the new backend session, or the UI should clearly explain that the existing thread cannot be continued under the new provider and provide a safe new-thread path.

### OpenRouter provider can show selected while backend remains Codex

- Environment: auth-mounted container on port `4192`.
- Browser evidence:
  - `output/playwright/docker-provider-switch-openrouter-settings.png`
  - `output/playwright/docker-provider-switch-openrouter-dropdown.png`
- Network evidence:
  - `/codex-api/free-mode/status` returned `enabled=false`, `hasCodexAuth=true`, `provider=openrouter`.
  - `/codex-api/provider-models` returned `source=provider`, `providerId=""`, `count=0`.
- Result:
  - Settings showed OpenRouter selected.
  - Composer model dropdown still showed Codex models (`GPT-5.5`, `GPT-5.4`, etc.).
- Expected:
  - If OpenRouter is selected, it should either activate with an OpenRouter key/model list or show an explicit blocking state instead of leaving Codex models active.

### Custom NVIDIA NIM chat provider does not drive the UI model dropdown and sends to Responses path

- Environment: auth-mounted container on port `4192`, custom provider set through `/codex-api/free-mode/custom-provider`.
- Config:
  - `baseUrl=https://integrate.api.nvidia.com/v1`
  - `wireApi=chat`
- Browser evidence:
  - `output/playwright/docker-provider-switch-custom-nim-dropdown.png`
  - `output/playwright/docker-provider-switch-custom-nim-result.png`
- Network evidence:
  - `/codex-api/free-mode/status` returned `enabled=true`, `provider=custom`, `customBaseUrl=https://integrate.api.nvidia.com/v1`, `wireApi=chat`.
  - `/codex-api/provider-models` returned `source=custom`, `exclusive=true`, and 123 models.
- Result:
  - UI model dropdown still showed Codex models.
  - Searching `moonshotai/kimi-k2.5` returned no results even though NIM provider model discovery succeeded.
  - Sending `hi provider nvidia nim` failed with `unexpected status 404 Not Found: 404 page not found, url: http://127.0.0.1:4192/codex-api/custom-proxy/v1/responses`.
- Expected:
  - UI dropdown should show the custom NIM model list.
  - Chat-completions providers should send to the chat proxy path and produce non-empty `messages`.

### Groq custom provider not completed

- Environment: local KeePass registry has OpenRouter and NVIDIA keys, but no Groq key entry was found.
- Result:
  - Could not perform a valid Groq send test.
- Expected:
  - Add or provide a Groq API key, then run the same packaged Docker Browser evidence flow with `baseUrl=https://api.groq.com/openai/v1`, `wireApi=chat`, model-list verification, and send verification.
