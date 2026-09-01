#!/usr/bin/env node
/**
 * Pre-release gate for the updater manifest.
 *
 * The Tauri updater verifies `latest.json` against the pinned public key, so a
 * manifest published with the signature placeholder still in place does not
 * fail loudly — it makes every client silently reject the update. This check
 * turns that into a build error instead.
 *
 * Run: npm run check:release
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function read(relative) {
  try {
    return readFileSync(join(root, relative), "utf8");
  } catch (error) {
    problems.push(`Cannot read ${relative}: ${error.message}`);
    return null;
  }
}

// ---------------------------------------------------------------- versions
const pkg = JSON.parse(read("package.json") ?? "{}");
const tauriConf = JSON.parse(read("src-tauri/tauri.conf.json") ?? "{}");
const cargoToml = read("src-tauri/Cargo.toml") ?? "";
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "package.json": pkg.version,
  "tauri.conf.json": tauriConf.version,
  "Cargo.toml": cargoVersion,
};

const expected = pkg.version;
for (const [file, version] of Object.entries(versions)) {
  if (!version) {
    problems.push(`${file} has no version field.`);
  } else if (version !== expected) {
    problems.push(`${file} is ${version}, expected ${expected}.`);
  }
}

// ------------------------------------------------------- updater manifest
const manifestRaw = read("latest.json");
if (manifestRaw) {
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    problems.push(`latest.json is not valid JSON: ${error.message}`);
  }

  if (manifest) {
    if (manifest.version !== expected) {
      problems.push(
        `latest.json is ${manifest.version}, expected ${expected}.`,
      );
    }
    const platforms = Object.entries(manifest.platforms ?? {});
    if (platforms.length === 0) {
      problems.push("latest.json lists no platforms.");
    }
    for (const [name, platform] of platforms) {
      const signature = platform?.signature ?? "";
      if (!signature || /REPLACE_WITH|PLACEHOLDER|TODO/i.test(signature)) {
        problems.push(
          `latest.json ${name} still carries a placeholder signature. ` +
            "Paste the contents of the .sig file produced by `npm run tauri:build`.",
        );
      }
      if (!/^https:\/\//.test(platform?.url ?? "")) {
        problems.push(`latest.json ${name} has no https download URL.`);
      }
      if (platform?.url && !platform.url.includes(expected)) {
        problems.push(
          `latest.json ${name} URL does not point at v${expected}: ${platform.url}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error("Release check failed:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("");
  process.exit(1);
}

console.log(`Release check passed for ${expected}.`);
