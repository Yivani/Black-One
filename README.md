<div align="center">
  <img src="public/readme-logo.svg" width="120" alt="Black One logo">
  <h1>Black One</h1>
  <p><strong>A local-first desktop workspace for AI chat, code, and agent tasks.</strong></p>
</div>

Black One keeps conversations and settings on your device while letting you work with cloud or local model providers. It combines streaming chat, project-aware tools, a native multi-terminal, a priority-based Todo board, and long-term memory in one restrained desktop interface.

> Black One is early software. Review tool actions before approving them and avoid testing with data you cannot replace.

## What it does

- Connects to OpenAI, Anthropic, OpenRouter, xAI, Kimi, compatible endpoints, and local models
- Streams chats with sessions, folders, search, archive, branching, and export
- Runs file and shell tools inside folders you explicitly attach
- Provides Manual, Auto, YOLO, and Blocked permission modes for agent actions
- Includes multiple native terminal sessions powered by `portable-pty`
- Tracks tasks on a Critical → High → Mid → Low Todo board with per-priority models
- Remembers facts you explicitly save via long-term memory
- Installs CLI coding agents (Codex, Claude Code, Gemini CLI, Kimi Code, OpenCode) from Settings
- Stores desktop chats in SQLite and API keys in the operating-system keychain
- Records categorized failures in Command Center → Errors, with an opt-in GitHub issue handoff

## Install

Download the latest Windows installer from [GitHub Releases](https://github.com/Yivani/Black-One/releases).

## Develop

Requirements:

- Node.js 20 or newer
- Rust stable
- The [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform

```bash
git clone https://github.com/Yivani/Black-One.git
cd Black-One
npm install
npm run tauri:dev
```

Useful checks:

```bash
npm run build
npm run test:memory
npm run test:prompts
npm run test:display
npm run test:todo
npm run test:cli
npm run test:tools
npm run test:errors
cargo test --manifest-path src-tauri/Cargo.toml
```

## Architecture

```text
React + TypeScript
├── Zustand application state
├── provider streaming and tool runtime
├── memory, todo, and terminal stores
└── persistence adapter
    ├── IndexedDB in browser preview
    └── Tauri commands on desktop
        ├── SQLite conversations and settings
        ├── OS keychain credentials
        └── native filesystem, shell, and PTY access
```

The detailed engineering snapshot lives in [Analyse.md](Analyse.md).

## Error reports

Unexpected failures are stored locally in the Command Center. Nothing is uploaded automatically. The **Create GitHub issue** action opens a prefilled draft in your browser; inspect it and remove private information before submitting.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), keep changes focused, and explain how you verified them. Maintainers review every pull request before deciding whether to merge it.

## License

Black One is available under the [MIT License](LICENSE).
