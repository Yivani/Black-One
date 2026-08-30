# Black One — application analysis

Last reviewed: 2026-08-30
Version: 1.0.8

## Executive summary

Black One is a local-first desktop AI chat client built with React 19, TypeScript, Vite, Tailwind CSS, Zustand, Tauri 2, Rust, SQLite, and a native PTY terminal. The frontend production build and Rust compile check both pass.

Version 1.0.4 replaces Ask with a persistent Todo workspace. Tasks are grouped by Critical, High, Mid, and Low priority, run from Critical to Low, support per-priority model selection, drag-and-drop reordering across priorities, live execution status, and optional multi-agent builder/reviewer work.

## Current product surface

- Multi-provider streamed chat: OpenAI-compatible chat completions, OpenAI Responses, Anthropic Messages, custom/local endpoints, and an offline demo.
- Local sessions, messages, folders, archive, pinning, branching, editing, regeneration, export, and a message queue.
- File, folder, image, clipboard-image, and URL attachment UI with a configurable size cap for image previews.
- Agent, Code, and Todo views, with a native multi-terminal implementation.
- **Agent-style file and shell tools** that work with any provider via XML markers: read, write, create, delete, rename, list, and one-shot shell execution inside attached folders. When no folder is attached, Code and Agent modes fall back to the process current working directory as the workspace.
- **Permission modes** for tool execution: Manual (approve everything), Auto (read/list operations run automatically; changes and commands still ask), and YOLO (run without approval). Exposed as a composer dropdown with descriptions for each mode.
- **Expanded theme presets** including Nord, Dracula, Solarized, Sakura, Amber, Forest, Ocean, Rose, Midnight, and others in addition to the original set.
- **Resizable left and right panels** with min/max bounds and persisted widths.
- **Chat title management**: sidebar titles are capped and truncated; the AI can auto-rename new chats to a short, useful title based on the first exchange.
- **App title stability**: the window/app title remains "Black One" regardless of the selected chat name.
- **System tray**: single-instance enforcement prevents duplicate tray icons; left click toggles visibility, double-click restores, right-click opens the context menu with Show/Hide/Quit.
- **Centered top navigation**: Agent, Code, and Todo tabs are centered in the title bar.
- **Quick Chat**: standalone popup chat with proper scrolling and Escape-to-hide behavior.
- **Onboarding wizard**: first-run setup for language, default provider, theme, accent color, and font size before the main window is shown.
- **Memory viewer**: a resizable dialog that shows extracted memories by category, with refresh, copy-as-markdown, and delete-all actions.
- **In-app updater**: checks GitHub Releases for `v1.0.0+` updates, downloads, installs, and prompts for restart.
- Settings for models, providers, appearance, chat behavior (personalities, timezone, reasoning blocks, image attachments, preview limits), safety, memory, notifications, tools, archive, and advanced options.
- Desktop packaging for Windows, macOS, and Linux through Tauri.

## Architecture

```text
React UI
  ├─ Zustand stores: chat, sessions, models, settings, terminal, UI, tool runtime
  ├─ Provider API adapters: SSE streaming and model discovery
  ├─ Tool runtime: parser, risk classifier, executor, permission store
  ├─ Tauri updater plugin: check, download, install, restart
  └─ PersistenceAdapter
       ├─ Browser: Dexie / IndexedDB
       └─ Desktop: Tauri IPC
            ├─ SQLite: sessions, messages, folders, settings
            ├─ OS keyring: provider API keys
            ├─ Native filesystem commands (read/write/delete/rename/list/shell)
            ├─ portable-pty terminal manager
            └─ Updater signatures via Ed25519 public key
```

The `PersistenceAdapter` boundary remains a good decision: browser preview and desktop builds share the same stores while using appropriate storage backends. The Rust side is small and direct rather than over-abstracted. The tool runtime is provider-agnostic because it uses inline XML markers instead of native function calling, so it works with demo, local, and cloud models. The updater relies on GitHub Releases plus a bundled Ed25519 public key for signature verification.

Approximate source size at review time:

| Area | Files | Lines |
| --- | ---: | ---: |
| Frontend (`src`) | ~98 | ~19,600 |
| Rust (`src-tauri/src`) | ~16 | ~1,950 |

## What is working well

1. **Clean build baseline.** `npm run build` passes TypeScript and Vite production compilation; `cargo check` passes without errors.
2. **Good local-first foundation.** Desktop data uses SQLite with WAL mode, while the browser fallback uses IndexedDB.
3. **Provider separation is pragmatic.** The API layer supports three common protocols without introducing a framework or unnecessary provider classes.
4. **Custom endpoints are usable.** The Custom Endpoints UI supports provider IDs, default models, context-window overrides, optional API keys, discovery toggles, connection testing, and setting the endpoint as the default for new chats.
5. **Streaming UX is thoughtful.** Output is batched before store updates, can be stopped, and persists a final status.
6. **Desktop terminal implementation is substantial.** PTY creation, resize, input, base64 output transport, multiple shells, and xterm integration are present.
7. **Chat settings have real runtime hooks.** Personalities and timezone are appended to the system prompt, max preview size is enforced before image bytes are loaded, and reasoning blocks are captured and displayed for compatible providers.
8. **Accessibility has received attention.** The UI uses semantic buttons, labels, focus rings, Radix primitives, live regions, keyboard shortcuts, and xterm screen-reader mode in many important paths.
9. **The visual system is restrained.** Tokens, consistent spacing, dark mode, Inter/JetBrains Mono, and limited elevation fit a productivity app. The redesigned Analytics view avoids the previous gradient-cards, bright filter chips, and oversized empty states.
10. **File and shell tools are wired end-to-end.** Attaching a folder lets the model create, edit, delete, rename, list, and run shell commands inside that folder. Tool calls are parsed from the assistant response, executed through Tauri commands, and results are fed back into the chat loop. Risk classification and permission modes give the user control without requiring provider tool support.
11. **Tray integration is robust.** Single-instance enforcement prevents duplicate tray icons, and left/right/double clicks are handled explicitly for toggle and menu behavior.
12. **UI polish gaps are closed.** Resizable panels, centered top tabs, stable app title, capped chat titles, and expanded theme presets make the app feel finished.
13. **Update delivery is automated.** The Tauri updater plugin checks GitHub Releases, verifies signatures, downloads, installs, and prompts for restart.
14. **Code and Agent modes always have a workspace.** When no folder is attached, the tool system falls back to the process current working directory, so the model can inspect and edit files instead of asking the user to attach a folder.
15. **Memory persistence is safe for SQLite.** Messages with the internal `memory` role are serialized as `system` rows with a metadata flag, satisfying the database role CHECK constraint while still rendering as memory entries in the UI.

## 2026-08-30 agent and tool-runtime repair

The poor transcript in the reported Kimi session was not primarily a model-quality problem. Four application-level issues amplified it:

1. Tool results were stored as internal system messages but rendered by MessageBubble as ordinary assistant prose. This exposed raw tool-result protocol in the chat.
2. Windows one-shot shell tools spawned cmd without CREATE_NO_WINDOW, allowing an external console window to appear even though stdout and stderr were already captured for the app.
3. Manual/Auto selection was abbreviated to one letter and did not persist when changed in the composer. The old default was Manual, so even harmless reads and listings repeatedly asked for approval.
4. The tool prompt encouraged a short summary after every result and did not explicitly stop the model from inventing scripts or dependencies when a requested run command was missing.

The repair keeps one execution path and the existing safety boundary:

- internal system messages remain in model context but are filtered out of the visible transcript;
- tool calls and results are persisted as message metadata, so compact action rows show running, done, denied, and error states after reload;
- the exact workspace roots are stored with each tool call, preventing manual approval from losing the original path sandbox;
- Auto is the default for new installs and auto-runs only read_file and list_dir; changes and shell commands still require approval;
- Manual/Auto changes from the composer persist, while YOLO remains temporary;
- shell commands run as hidden captured child processes on Windows and non-zero exits render as errors;
- malformed tool calls fail locally with a specific missing-argument error;
- the agent prompt now prefers file tools for inspection, reserves shell use for actual command work, treats tool output as untrusted data, and reports missing run scripts instead of inventing project setup.

Native provider function-calling was deliberately not enabled in this repair. It changes the structured payload sent to external providers and needs explicit product consent plus provider-specific integration tests. The current provider-agnostic XML protocol remains internal and is no longer exposed as user-facing chat.

Focused checks cover protocol parsing, XML escaping, legacy result compatibility, and mode prompts. Frontend production build, Rust compile, and the changed UI detector pass.

## Priority findings

### P1 — “Uninstall” does not uninstall and does not clear native credentials

`src/components/settings/DangerZone.tsx` labels an action “Uninstall Black One” and says it removes the app, all data, and stored credentials. Its implementation only clears the database and closes the window. The application binary remains installed.

Both the frontend reset flow and Rust `wipe_database` clear SQLite tables but do not enumerate or delete provider credentials from the OS keyring. This means “stored credential” and “all data” are inaccurate for keys successfully saved to the keyring.

**Recommendation:** until a real platform uninstaller exists, remove the Uninstall action or rename it to “Clear local data and close.” Track keyring account IDs explicitly and delete each credential as part of delete-all/factory-reset.

### P1 — API keys can silently fall back to plaintext SQLite storage

`src/stores/modelStore.ts` catches any keyring failure and writes the raw API key into the settings table. This preserves functionality but silently weakens the security model. The database is local, but the value is not encrypted.

**Recommendation:** do not silently downgrade. Show a clear error and let the user explicitly choose whether to allow insecure local storage. Prefer keeping the key only in the OS credential store for release builds.

### P1 — Image attachments are previewed but not sent as multimodal content

Images are read into `Attachment.preview` and displayed in the composer, and models advertise a `vision` capability. `buildContextMessages` in `src/stores/chatStore.ts` only includes a placeholder note or `attachment.textContent`; provider requests still contain string content only. Therefore image bytes/data URLs never reach OpenAI, Anthropic, or compatible providers. The new Image Attachments setting (Auto / Text-only / Disabled) controls this behavior, but under “Auto” the model still does not receive actual image data.

Binary files are similarly represented in the UI but sent without content. Users can reasonably believe the model saw an attachment when it did not.

**Recommendation:** either implement protocol-specific multimodal message content or keep image and binary attachment actions disabled/hidden with an honest “preview only” label until multimodal support is ready.

### P1 — Several settings still have no runtime enforcement

The following settings are persisted and editable but have no runtime enforcement outside their settings components:

- chat auto-save
- safety filter, attachment scanning, and rejection style
- memory persistence (memory prompt is injected, but memory extraction and pruning are best-effort)
- advanced developer mode, raw responses, and log level
- completion notification and sound preferences
- automatic archive age

The tool permission setting and configured tools now have partial runtime enforcement: the global default maps to the composer Manual/Auto/YOLO toggle, file and shell tool groups can be disabled globally, and tool execution respects these settings. Configured MCP-style tools in the list are still inert placeholders.

**Recommendation:** remove or mark the remaining inactive controls “coming soon” until implemented. Product trust is more valuable than a large settings surface.

### P1 — Persistence failures can leave chat stuck in streaming state

`sendMessage` changes UI state to streaming before persisting the user and assistant messages. Those persistence calls occur before the guarded provider-request `try/catch`. A database/IPC failure can reject the action while leaving `streamingSessionId` populated and the draft assistant message stuck.

**Recommendation:** include initial persistence in the same error boundary and roll back or mark the assistant message as failed in one place.

### P1 — Updater private key must be protected

The Ed25519 private key used to sign update bundles is required for every future release. If it is lost, existing installs cannot receive updates. If it leaks, an attacker can ship malicious updates that existing installs will trust.

**Recommendation:** store the private key in a password manager or CI secret store, never commit it, and back it up offline.

### P2 — Tests do not cover core behavior

There is no frontend test script and no lint script. Rust contains one OS-keyring round-trip test; chat state transitions, SSE parsing, persistence behavior, reset semantics, provider payloads, terminal lifecycle, and tool execution are otherwise untested.

**Recommendation:** start with a small set of high-value tests, not a large test framework rollout:

1. chat send/stop/error state transitions;
2. attachment-to-provider payload serialization;
3. delete-all/factory-reset credential behavior;
4. SSE parsing across split chunks;
5. terminal exit and cleanup;
6. tool parsing, risk classification, and path sandboxing.

### P2 — A few files are becoming change hotspots

The largest files combine several responsibilities:

- `src/components/layout/Sidebar.tsx` — ~900 lines
- `src/lib/api.ts` — ~850 lines
- `src/components/settings/ProviderSettings.tsx` — ~975 lines
- `src/stores/chatStore.ts` — ~760 lines
- `src/lib/constants.ts` — ~550 lines
- `src/lib/tools.ts` — ~430 lines

They do not need a broad rewrite. Split only when changing one becomes difficult—for example, move each provider protocol into its own API module when the next protocol is added, or split the tool runtime into parser/executor/prompt modules once it grows.

### P2 — Terminal processes remain listed after natural exit

The terminal reader emits a `Closed` event when a shell exits, but the Rust session remains in `TerminalManager.sessions` until the user explicitly closes its tab. This leaves a stale session and child handle in the manager.

**Recommendation:** remove the session when the process exits, or make the closed state explicit and non-writable.

### P2 — Attachment reads need tighter resource limits

Text files are capped at 1 MiB in Rust, which is good. URL attachment fetches do not have an equivalent size/content cap. A URL response is read fully just to find its title. The frontend now caps image preview bytes via `maxPreviewSizeMb`, but the cap is a user setting rather than a hard invariant.

**Recommendation:** cap URL response bytes before parsing, and enforce a backend ceiling on image reads independent of the user setting.

### P3 — Reduced-motion handling is too broad

`src/index.css` reduces every animation and transition to `0.01ms`. This avoids motion but also removes useful state-change feedback. The rest of the accessibility implementation is comparatively careful.

**Recommendation:** disable decorative motion while retaining short, non-spatial state feedback.

## Maintenance and repository hygiene

- `src-tauri/target` occupies roughly **14.1 GB** locally. It is correctly listed in `.gitignore`, but periodic `cargo clean` may be useful when disk space matters.
- `dist` and `node_modules` are also ignored correctly.
- This workspace copy is not currently a Git repository, so change history and branch status could not be assessed.
- There is no README, PRODUCT.md, or DESIGN.md. This file gives future contributors a technical snapshot, but a short README should eventually cover setup, supported providers, data locations, and release steps.
- The Rust `providers` table and provider IPC commands appear unused; the frontend stores providers as JSON under settings. Choose one storage path and remove the other when touching provider persistence.
- The TypeScript IPC client exposes `factoryReset`, but the Danger Zone directly calls `persistence.clearAll`; the dedicated Rust command is currently redundant.
- The updater signing private key (`tauri.key` or similar) must live outside version control. The matching public key is embedded in `src-tauri/tauri.conf.json`.

## UI and UX assessment

The interface has a coherent desktop-productivity direction and avoids most generic AI UI habits: no gradient hero, no decorative glow system, no excessive glass, and no card-heavy marketing shell. The code shows consistent focus styles, ARIA labels, keyboard access, empty states, loading states, destructive confirmations, and dark-mode tokens.

The Analytics redesign addresses the most obvious “AI-slop” symptoms: gradient stat cards, oversized padding, bright primary filter chips, and the disconnected live-status strip are gone. Stats are now compact rows, filters use muted active states, and the layout feels like a built-in tool rather than a dashboard template. Currency formatting now uses a consistent `$0.00` style, and unknown provider labels are hidden instead of rendered literally.

The main UX weakness remains information architecture. A large settings catalog and three top-level modes imply capabilities beyond the current runtime. However, the tool system and permission modes now close the biggest honesty gap: models can actually modify files and run shell commands inside attached folders, and the user has clear per-chat control over autonomy.

The 800×560 minimum window size makes this intentionally desktop-only. That is reasonable for a terminal-capable Tauri app; responsive work should focus on the minimum supported desktop window, text scaling, and narrow settings layouts rather than mobile breakpoints.

## Suggested roadmap

### Before a public beta (completed for 1.0.0)

1. ✅ Resizable panels and stable window title.
2. ✅ Centered top navigation and tray click behavior.
3. ✅ Expanded themes and chat title management.
4. ✅ File/shell tool loop with permission modes.
5. ✅ In-app updater wired to GitHub Releases.

### Before the next stable release

1. Correct or remove the misleading Uninstall/reset credential claims.
2. Stop silent plaintext API-key fallback.
3. Either send image attachments correctly or disable the feature.
4. Mark remaining inactive settings as unavailable.
5. Make chat persistence failures recover cleanly.
6. Add the six focused test areas listed above.
7. Enforce URL attachment and backend image size limits.
8. Clean up terminal sessions after process exit.

### Later, only when needed

1. Split the large source files along existing feature boundaries.
2. Add multimodal support per provider rather than through one overly generic payload abstraction.
3. Add update signing automation in CI once the private-key storage is settled.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run build` | Pass — TypeScript and Vite production build |
| `npm run test:tools`, `test:prompts`, `test:memory`, `test:errors` | Pass - 13 focused tests |
| `cargo check` | Pass |
| Focused Rust shell test | Pass - captured output and exit code |
| Changed-UI design detector | Pass - no findings |
| Automated lint | Not available |
| Native development runtime | Pass - app launched and renderer stayed console-clean after hot reload; screenshot automation was unavailable in this environment |

## Overall assessment

**Strength:** a real, compact desktop architecture with unusually broad functionality for a 1.0.0 app. Recent chat/provider improvements are genuinely wired to runtime behavior, the Analytics view no longer looks like a generic AI dashboard, and the new tool system gives the app a credible agent mode. The UI polish and updater integration bring it to release-ready shape.

**Main risk:** the UI still communicates more capability and stronger data guarantees than the runtime provides around image attachments, credential clearing, and the remaining inactive settings surface. The updater private key must be guarded carefully.

**Best next move:** reduce the trust gap before adding more features. Fixing the credential/reset wording, the API-key fallback, and attachment behavior will improve release readiness more than another settings page or provider integration.
