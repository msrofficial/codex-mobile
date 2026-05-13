# What To Test

## Open Docker Provider Tasks

These tasks come from packaged Docker Browser cycles. Keep each task here until a fresh packaged Docker run proves it passes with browser screenshots and network evidence.

Passed and removed on 2026-05-13: continuing a historical Codex thread after `Codex -> OpenCode Zen` provider switch. Fresh evidence showed the same `#/thread/019e2117-b1dc-7401-804f-b86fadc97604` route stayed visible and `hi provider opencode zen` returned an assistant reply without a raw `thread not found` error.

Passed and removed on 2026-05-13: OpenRouter selected state no longer falls back to stale `big-pickle`. Fresh packaged Docker evidence on `http://127.0.0.1:4492/#/` showed `currentModel=openrouter/free`, 26 exclusive OpenRouter models, no `big-pickle`, and screenshot `output/playwright/docker-fix-openrouter-dropdown.png`.

Passed and removed on 2026-05-13: custom NVIDIA NIM provider now drives the dropdown and sends without the empty-messages failure. Fresh packaged Docker evidence on `http://127.0.0.1:4492/#/` showed `currentModel=01-ai/yi-large`, 123 exclusive NIM models, no `big-pickle`, screenshot `output/playwright/docker-fix2-nim-dropdown.png`, and a final upstream NIM 404 rendered in chat without `messages field cannot be empty` in `output/playwright/docker-fix2-nim-send.png`.

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
