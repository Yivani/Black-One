<div align="center">
  <img src="src-tauri/icons/logo.svg" width="88" alt="Black One logo">
  <h1>Black One</h1>
  <p><strong>A local-first desktop workspace for AI chat, code, and agent tasks.</strong></p>
</div>

Black One keeps conversations and settings on your device while letting you work with cloud or local model providers. It combines streaming chat, project-aware tools, and a native terminal in one restrained desktop interface.

> Black One is early software. Review tool actions before approving them and avoid testing with data you cannot replace.

## What it does

- Connects to OpenAI, Anthropic, compatible endpoints, and local models
- Streams chats with sessions, folders, search, archive, branching, and export
- Runs file and shell tools inside folders you explicitly attach
- Provides Manual, Auto, and YOLO approval modes for agent actions
- Includes multiple native terminal sessions powered by `portable-pty`
- Stores desktop chats in SQLite and API keys in the operating-system keychain
- Records categorized failures in Command Center → Errors, with an opt-in GitHub issue handoff

## Install

Download a packaged build from [GitHub Releases](https://github.com/Yivani/Black-One/releases). Release artifacts will appear there as they become available.

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
npm run test:errors
cargo test --manifest-path src-tauri/Cargo.toml
```

## Architecture

```text
React + TypeScript
├── Zustand application state
├── provider streaming and tool runtime
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
