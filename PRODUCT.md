# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Black One is for people who use AI to inspect, change, and verify work in a local desktop workspace.

## Product Purpose

Black One is a local-first desktop AI client for conversations, coding, terminal work, and autonomous task execution. Success means the user can see what the AI is doing, control its model and permissions, and keep work moving without losing local context.

## Positioning

Black One combines provider-independent AI conversations with local persisted sessions, native workspace tools, and explicit execution permissions in one desktop app.

## Operating Context

Users work from the Agent, Code, and Todo surfaces. Todo work is organized by Critical, High, Mid, and Low priority, processed from Critical to Low, and can use a different configured model for each priority.

## Capabilities and Constraints

- React and TypeScript render inside a Tauri desktop shell.
- Sessions and messages persist locally; provider credentials use the OS credential store when available.
- Agent work can inspect files, edit files, and run shell commands through the existing permission-controlled tool loop.
- Todo items must persist, support reordering across priorities, expose execution state, and allow an optional multi-agent pass.
- The current agent runtime serializes tool loops. Multi-agent Todo work therefore uses ordered independent passes over the same workspace rather than concurrent writes.

## Brand Commitments

Keep the product name Black One and the existing restrained desktop-productivity visual language.

## Evidence on Hand

- `Analyse.md` contains the current architecture, runtime behavior, and verified build status.
- The existing Agent, Code, queue, model selector, and tool approval interfaces are the behavioral references for Todo.

## Product Principles

- Show real capability and state; do not imply work that is not executing.
- Keep user data and project work local-first.
- Reuse the existing provider, session, and tool systems.
- Prefer clear control over decorative complexity.

## Accessibility & Inclusion

New controls must remain keyboard reachable, clearly labeled, and usable at the app's minimum desktop window size.
