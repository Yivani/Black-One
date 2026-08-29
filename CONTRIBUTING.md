# Contributing to Black One

Thanks for helping improve Black One. Bug fixes, accessibility improvements, documentation, and focused product enhancements are welcome.

## Before you start

1. Search existing issues and pull requests.
2. Open an issue before a large feature or architectural change.
3. Do not include API keys, chat data, local paths, or other private information.

## Development

```bash
npm install
npm run tauri:dev
```

Keep changes small and consistent with the existing architecture and visual language. Prefer platform features and existing dependencies over new packages.

Before opening a pull request, run the relevant checks:

```bash
npm run build
npm run test:errors
cargo test --manifest-path src-tauri/Cargo.toml
```

## Pull requests

Describe the problem, the solution, and the checks you ran. Add screenshots for visible changes. A maintainer may request changes, close a proposal that does not fit the product, or merge it after review.

By contributing, you agree that your work is licensed under the repository's MIT License.
