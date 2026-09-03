<div align="center">
  <img src="public/readme-logo.svg" width="120" alt="Black One logo">
  <h1>Black One</h1>
  <p><strong>A local-first desktop workspace for AI chat, code, and agent tasks.</strong></p>
  <p>
    <a href="https://github.com/Yivani/Black-One/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/Yivani/Black-One?style=flat-square&color=1e1e28"></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-1e1e28?style=flat-square"></a>
    <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-1e1e28?style=flat-square">
    <img alt="Built with" src="https://img.shields.io/badge/Tauri%202-React%2019-1e1e28?style=flat-square">
  </p>
</div>

Black One keeps your conversations, settings, and memory on your own device while you work with cloud or local model providers. Streaming chat, project-aware tools, native terminals, a Todo board, and a memory that every agent shares — in one restrained desktop interface.

> **Early software.** Review tool actions before approving them, and avoid testing with data you cannot replace.

---

## What it does

**Chat and models**
Connects to OpenAI, Anthropic, OpenRouter, xAI, Kimi, any OpenAI-compatible endpoint, and local models. Sessions, folders, search, archive, branching, and export.

**Agent tools**
File and shell tools run only inside folders you explicitly attach. Four permission modes — Manual, Auto, YOLO, Blocked — decide how much runs without asking.

**Terminals**
Several native shells powered by `portable-pty`, each belonging to a workspace. Install and run the CLI coding agents from Settings: Codex, Claude Code, Gemini CLI, Kimi Code, OpenCode.

**Memory that follows you**
One global bank shared by every workspace. It saves what you *ask* it to remember and what your machine is missing — not the build command your `package.json` already states. Facts are written into `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md`, so the CLI agents in your terminals read the same memory Black One does.

**Todo board**
Critical → High → Mid → Low, per workspace. Tasks are yours to run: drag them
between lanes, then copy one and paste it wherever you want it done. The sidebar
keeps the open ones listed Critical first, each row a copy button.

**Made to live in**
21 colour themes, each checked against WCAG contrast in both light and dark. Eleven short synthesized sounds for sending, finishing, tools, memory, and terminals — every family switchable. English, German, and Spanish throughout. A tray icon that carries workspace status, and launch-at-login.

**Local by default**
Desktop chats live in SQLite; API keys live in the operating-system keychain. Failures are recorded in Command Center → Errors, with an opt-in GitHub issue handoff.

## Install

Download the latest Windows installer from [GitHub Releases](https://github.com/Yivani/Black-One/releases) and run it.

Black One checks for new releases and shows you what changed, then links you to the installer. It never installs an update by itself.

## Develop

**Requirements** — Node.js 20+, Rust stable, and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```bash
git clone https://github.com/Yivani/Black-One.git
cd Black-One
npm install
npm run tauri:dev
```

**Checks**

```bash
npm test                                      # every TypeScript unit test
npm run typecheck                             # tsc --noEmit
npm run build                                 # typecheck + production bundle
cargo test --manifest-path src-tauri/Cargo.toml
```

The suite is split into focused scripts too — `npm run test:memory`, `test:terminal-memory`, `test:themes`, `test:sounds`, `test:updates`, `test:i18n`, and others listed in `package.json`.

**How the tests are organised.** Logic that deserves a test lives in an import-free `*Core.ts` module — no React, no Tauri, no DOM — so it runs under `node --experimental-strip-types` with no test framework at all. That is why terminal input parsing, memory rules, theme contrast, and the sound set can each be proven without launching the app.

## Architecture

```text
React 19 + TypeScript + Vite
├── Zustand stores          chat, memory, todo, terminal, workspace, settings
├── provider streaming      OpenAI / Anthropic / OpenAI-compatible
├── tool runtime            file + shell tools, permission modes
└── persistence adapter
    ├── IndexedDB           browser preview
    └── Tauri commands      desktop
        ├── SQLite          conversations and settings
        ├── OS keychain     credentials
        └── native          filesystem, shell, PTY, tray
```

## Error reports

Unexpected failures are stored locally in the Command Center. Nothing is uploaded automatically. **Create GitHub issue** opens a prefilled draft in your browser — read it and remove anything private before submitting.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), keep changes focused, and explain how you verified them. Every pull request is reviewed before it is merged.

## License

Black One is available under the [MIT License](LICENSE).
