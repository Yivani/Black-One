# Black One — Application Analysis

Last reviewed: 2026-08-31
Version: 1.0.8

## Executive Summary

Black One is a local-first, desktop AI workspace for Windows (Tauri 2 + Rust backend) wrapped in a React 19 / TypeScript / Vite / Tailwind CSS frontend. It is designed as a "coding agent" environment: instead of a traditional chat-with-API-key flow, the app centers on terminal-based CLI coding agents, a persistent Todo board, native multi-terminal panes, file/shell tools, and long-term memory. The app can still talk to cloud providers (OpenAI, Anthropic, OpenRouter, xAI, Kimi, etc.) via API keys, but the default first-run path now guides users to install CLI tools such as Codex, Claude Code, Gemini CLI, Kimi Code, and OpenCode.

The current release (1.0.8) is a major redesign: the old Agent view and many standalone settings panels were removed, the onboarding was rebuilt around CLI tools, the UI layout is customizable, and Agent turns are rendered as unified expandable "Thinking" blocks.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS 4, Radix UI primitives, Lucide icons, Sonner toasts, `react-window` for message virtualization, `@dnd-kit` for drag-and-drop.
- **State**: Zustand + Immer across many focused stores (chat, session, model, UI, terminal, todo, settings, tool runtime, update).
- **Backend**: Tauri 2 (Rust), SQLite via `rusqlite` for sessions/messages/folders, native PTY terminals via Tauri shell, OS-level shortcuts, auto-start, and tray support.
- **Persistence**: Encrypted/secure settings storage via Tauri `stronghold`-style key store for API keys; other settings and sessions in SQLite/localStorage.
- **Streaming**: Custom SSE parser supporting OpenAI-compatible chat completions, OpenAI Responses API, Anthropic Messages, and custom/local endpoints.
- **Tooling**: XML-based tool protocol (`<tool>` / `<tool_result>`), provider-agnostic, works with any model that can emit the markers.

## Product Surface

### 1. Main Views

The app has two top-level view modes, switched from the title bar or sidebar:

- **Code** — A chat workspace with an attached multi-terminal deck. This is the primary coding/agent surface.
- **Todo** — A Kanban-style board with four priority lanes (Critical, High, Mid, Low). Tasks can be dragged between lanes and reordered. Each priority can be assigned its own model.

The old dedicated "Agent" view was removed in 1.0.7; agentic behavior now lives inside Code view via tools and mode-specific system prompts.

### 2. Layout & Shell

- **AppShell** renders a header (`TitleBar`) plus a flex row of up to three zones: sidebar, main content, right panel. Sidebar and right panel can be positioned left or right independently.
- **TitleBar** is fully customizable: users can drag items (sidebar toggle, identity, view tabs, layout picker, haptics, settings, right panel, theme toggle) between left/center/right/hidden zones.
- **Layout presets**: Default, Focus (zen mode), Terminal deck (right panel open on Files), Quad. Users can also save custom layouts.
- **Zen mode** hides the sidebar for distraction-free work.
- **Resizable sidebar and right panel** with min/max width constraints persisted to `localStorage`.

### 3. Sidebar

The left sidebar has two states:

- **Expanded**: Shows a "New chat" button, search field, workspace folders, chat list (Today + folder groupings), pinned sessions, and a bottom rail with terminal list, todo status, update button, and command-center button.
- **Collapsed**: A narrow icon rail with New terminal, Code/Todo toggles, update, and command-center buttons.

Terminal list in the sidebar supports creating, renaming, color-coding, and closing native terminals. Todo status shows open/done counts.

### 4. Code View

Code view is a chat + terminal workspace:

- **Composer** at the bottom supports multi-line input (max 8 lines), file/folder/image/URL/clipboard attachments, model selector, tool-permission mode selector, prompt snippets, send/cancel/regenerate, and a message queue.
- **Message list** virtualizes long histories, groups consecutive tool calls into single assistant "Thinking" blocks, and shows a jump-to-bottom button when scrolled up.
- **Message bubbles** render user/assistant/system/memory messages with Markdown, code blocks with copy, citations, reasoning blocks, attachments, and tool cards.
- **Thinking blocks**: Each Agent turn collapses reads, commands, outputs, and errors into one expandable block; only the final answer is shown in the normal stream.
- **Tool call cards** show pending tool calls with Allow/Deny actions, risk classification, and execution state. Approvals survive reload/runtime state loss and prevent double execution.
- **Context banner** warns when message history was truncated to fit the configured context window.

### 5. Native Multi-Terminal

- The terminal deck supports grid, horizontal, and vertical layouts.
- Terminals are native PTY shells running in the Rust backend.
- Users can create, rename, reorder (drag-and-drop), and color-code terminals.
- The terminal is integrated with chat: shell tool commands run in the attached workspace folder, and the "New terminal" shortcut opens a new pane.

### 6. Todo Board

- Four priority lanes with per-lane model selection.
- Add tasks inline, drag-and-drop reorder across lanes.
- Statuses: queued, working, blocked (approval needed), done, error.
- Runner executes tasks from Critical to Low. Todo tasks requiring tools use the selected chat/session and do not create a new chat per task.
- Multi-agent option runs a builder/reviewer pass structure.

### 7. Model / Provider System

- Built-in providers: OpenAI (Codex), Anthropic, OpenRouter, xAI, OpenCode, Kimi, Kimi Code, and a local/custom endpoint.
- Each provider has a default model list with capabilities (vision, tools, reasoning, streaming), pricing, and context windows.
- API keys are stored securely in the Tauri backend; the frontend only knows `hasApiKey`.
- Model selection is provider-qualified (`provider::modelId`) to avoid collisions.
- The demo provider works offline and streams realistic canned responses.
- Model discovery can fetch available models from endpoints that support it.

### 8. File & Shell Tools

Provider-agnostic XML tool protocol:

- `read_file`, `write_file`, `create_dir`, `delete_file`, `delete_dir`, `rename_file`, `list_dir`, `shell_command`.
- Tools operate only inside attached folders (or the current working directory if no folder is attached).
- Permission modes: **Manual** (approve everything), **Auto** (reads/lists auto-approve; changes/commands ask), **YOLO** (run without approval), **Blocked** (disable tools).
- Critical shell patterns (`sudo`, `rm -rf`, `curl | sh`, etc.) raise risk warnings.
- Shell commands run hidden in the background without opening an external terminal window.

### 9. Memory System

- **Explicit memory**: The model can emit `<memory>` blocks; the app extracts, categorizes (personal, work, hobbies, projects, preferences, writing style, goals, relationships, other), prunes, and injects relevant entries into future prompts.
- Memory is persisted as JSONL and mirrored to Markdown for user inspection.
- Memory prompt rendering selects the most important entries up to a character budget and groups by category.
- Backfill/recovery mechanism ensures legacy memory is not lost.

### 10. Session Management

- Sessions are stored in SQLite with messages, metadata, folders, archive state, pinning, and unread flags.
- Users can create, rename, duplicate, delete, archive, pin, move to folders, and export sessions (JSON or Markdown).
- Auto-pruning removes redundant empty "New chat" drafts on load.
- Session mode (`chat`/`code`/`agent`) is persisted; selecting a session switches back to Code view unless already there.

### 11. Attachments

- Supported kinds: file, folder, image, URL.
- Image previews respect a max preview size cap.
- Folder attachments become the tool workspace.
- Clipboard-image paste and drag-and-drop are supported.

### 12. Settings

Settings are opened in a large modal dialog with a left category nav:

- **Appearance**: Light/dark/system mode, 14 color theme presets (Default, Ocean, Warm, Forest, Berry, Sunset, Coffee, Mint, Lime, Nord, Dracula, Solarized, Sakura, Amber), 13 accent colors plus custom color picker, font size (small/medium/large), sidebar/right-panel position, avatar display, vibe hearts.
- **Haptics**: Enable/disable, volume, click/finish/error sound selection.
- **Keyboard Shortcuts**: Customizable bindings including quick-chat, toggle sidebar, command palette, dark mode, zen mode, new terminal.
- **CLI Tools**: Install/update/uninstall Codex, Claude Code, Gemini CLI, Kimi Code, OpenCode via npm in the background.
- **Memory**: Context window limit, persistence toggle, max memory size, allowed categories, memory viewer/exporter.
- **System**: Minimize to tray, start minimized, start with Windows, diagnostic log level.
- **About**: Version, update check/install, GitHub link, reset/danger zone.

Removed in the redesign: separate ModelSettings, ChatSettings, ArchiveSettings, SafetySettings, ToolSettings, NotificationSettings, and the Agent view.

### 13. Onboarding

First-run wizard (4 steps):

1. Language selection (English ready; German/Spanish marked coming soon).
2. **CLI Tools**: Install terminal coding agents; runs npm installs in background without opening a shell window.
3. **Appearance**: Theme mode, color preset, accent color, font size.
4. **Finish**: Summary and "Start using Black One".

The wizard is scrollable and responsive for small windows. Existing installs (any stored settings) skip onboarding automatically.

### 14. Command Center / Diagnostics

- **Command Center** shows usage stats, recent errors, memory stats, and quick actions.
- **Error Log** lists captured frontend/backend errors with categorization and secret redaction.
- **Error boundary** catches render errors and offers a prefilled GitHub issue URL.
- **Update mechanism**: Native Tauri updater with GitHub release fallback; checks every 15 minutes.
- **Changelog** component surfaces recent release notes.

### 15. Quick Chat Window

A global system shortcut (`Mod+Shift+Space` by default) opens a small floating quick-chat window where the user can pick a model, type a message, and send it. The main window then creates/loads the session and streams the response.

### 16. Vibe Hearts

A playful haptic/visual feedback feature: small floating heart particles on certain interactions (toggleable in Appearance settings).

## Architecture Highlights

- **Store isolation**: Each domain has its own Zustand store. Cross-store side effects (e.g., tool permission sync) are handled in action bodies or listeners.
- **Chat flow**: `sendMessage` → build context with memory + mode prompt + tool prompt → stream completion → parse tool calls → approval/runtime execution → tool result serialization → continue loop until no more tools or max depth.
- **Mode system**: System prompts differ between chat/code/agent/todo modes. Code/agent modes enable tools; Todo forces agent mode and a selected model.
- **Agent loop guard**: Tool loop depth is tracked per session to prevent runaway agents. Promise-only replies are retried once, then surfaced as errors rather than fake completion.
- **Streaming**: Custom SSE reader supports multiple provider formats and flushes UI updates on a fixed interval for smooth rendering.
- **Persistence layer**: Abstracted `persistence` object wraps Tauri SQLite commands; fallback in memory for web/non-Tauri builds.

## Security & Privacy

- API keys never leave the Rust process in plaintext during normal operation; they are read via Tauri commands and sent directly to provider APIs.
- Tool execution is sandboxed to attached folders (or the current working directory).
- High-risk shell patterns trigger elevated risk classification.
- Error reports redact secrets, local usernames, and file paths before creating GitHub issue URLs.
- Native Kimi tool calls are opt-in because they transmit tool definitions and local results to Kimi's API.

## Known Limitations / Future Areas

- The app currently targets Windows primarily; macOS bundle identifier warnings exist but do not block builds.
- Signing is disabled for public releases; installers are unsigned.
- Some settings types remain in the schema (notifications, safety, archive) even though their dedicated UI panels were removed.
- The demo provider is offline and does not execute tools.
- Windows screenshot automation for pixel-level UI tests is flaky.
- `latest.json` is gitignored and not auto-updated in the repo; releases rely on GitHub assets.

## Build & Test Maturity

- Production frontend build (`npm run build`) and Rust `cargo check` pass.
- Test suites cover memory, prompts, chat display grouping, todo core, CLI tool commands, tool protocol round-trips, and error redaction.
- All current tests pass on the 1.0.8 codebase.
