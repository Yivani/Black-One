import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateKey,
  categoryForKind,
  containsSecret,
  extractMemoryCandidates,
  isDevelopmentTool,
  parseMissingCommand,
  redactSecrets,
  type CommandObservation,
} from "./terminalMemory.ts";

const ok = (
  command: string,
  output = "",
  extra: Partial<CommandObservation> = {},
): CommandObservation => ({ command, output, exitCode: 0, ...extra });

const failed = (
  command: string,
  output: string,
  exitCode = 127,
): CommandObservation => ({ command, output, exitCode });

// =========================================================== secret handling

test("masks provider keys, tokens, and JWTs", () => {
  const cases: Array<[string, string]> = [
    ["OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456", "sk-"],
    ["curl -H 'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz'", "ghp_"],
    ["aws configure set key AKIAIOSFODNN7EXAMPLE", "AKIAIOSFODNN7EXAMPLE"],
    ["slack --token xoxb-1234567890-abcdefghij", "xoxb-"],
    [
      "auth eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27u",
      "eyJhbGci",
    ],
  ];
  for (const [input, secret] of cases) {
    const redacted = redactSecrets(input);
    assert.ok(!redacted.includes(secret), `${secret} survived redaction`);
    assert.ok(redacted.includes("[redacted]"), `${input} produced no marker`);
  }
});

test("masks credentials embedded in a URL but keeps the scheme", () => {
  const redacted = redactSecrets("git clone https://alice:hunter2@github.com/a/b.git");
  assert.ok(!redacted.includes("hunter2"));
  assert.ok(!redacted.includes("alice"));
  assert.ok(redacted.startsWith("git clone https://[redacted]@github.com"));
});

test("masks flag-shaped secrets while keeping the flag readable", () => {
  assert.equal(redactSecrets("deploy --token=abc123xyz"), "deploy --token=[redacted]");
  assert.equal(redactSecrets("mysql --password hunter2"), "mysql --password [redacted]");
  assert.equal(redactSecrets("cli --api-key SOMETHINGLONG"), "cli --api-key [redacted]");
});

test("masks inline environment assignments that name a secret", () => {
  assert.equal(
    redactSecrets("DATABASE_PASSWORD=swordfish npm start"),
    "DATABASE_PASSWORD=[redacted] npm start",
  );
});

test("leaves ordinary text alone", () => {
  const plain = "npm run build && cargo test --all-features";
  assert.equal(redactSecrets(plain), plain);
  assert.equal(containsSecret(plain), false);
  assert.equal(containsSecret("NODE_ENV=production npm run build"), false);
});

test("a command carrying a secret produces no memory at all", () => {
  const candidates = extractMemoryCandidates(
    failed("NPM_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz pnpm t", "pnpm: command not found"),
  );
  assert.deepEqual(candidates, []);
});

test("secrets in output never reach a stored fact", () => {
  const candidates = extractMemoryCandidates(
    failed("deploy", "bash: deploy: command not found\ntoken=sk-abcdefghijklmnopqrst"),
  );
  assert.ok(!JSON.stringify(candidates).includes("sk-abcdef"));
});

// ================================================== the bar for remembering

test("a command that worked teaches nothing worth storing", () => {
  // The whole point: `npm run build` succeeding is already written in
  // package.json. Repeating it in memory is clutter, not knowledge.
  for (const command of [
    "npm run build",
    "npm run dev",
    "pnpm test",
    "cargo build",
    "node -v",
    "make check",
    "git status",
    "ls -la",
  ]) {
    assert.deepEqual(
      extractMemoryCandidates(ok(command, "done")),
      [],
      `${command} succeeding should not create a memory`,
    );
  }
});

test("a dev server announcing its URL is not a memory either", () => {
  assert.deepEqual(
    extractMemoryCandidates(ok("npm run dev", "  ➜  Local: http://localhost:5173/")),
    [],
    "the port is in the config; an agent can read it there",
  );
});

test("an ordinary failure is remembered as nothing", () => {
  for (const observation of [
    failed("cargo test", "test result: FAILED. 3 failed", 101),
    failed("npm run build", "error TS2339: Property 'x' does not exist", 1),
    failed("npm run dev", "Error: Port 1420 is already in use", 1),
  ]) {
    assert.deepEqual(
      extractMemoryCandidates(observation),
      [],
      "a broken build is state, not a durable fact",
    );
  }
});

test("a timed-out command proves nothing", () => {
  assert.deepEqual(
    extractMemoryCandidates({
      command: "pnpm test",
      output: "pnpm: command not found",
      exitCode: 1,
      timedOut: true,
    }),
    [],
  );
});

test("an unreadable exit status is treated as no evidence", () => {
  assert.deepEqual(
    extractMemoryCandidates({
      command: "pnpm test",
      output: "pnpm: command not found",
      exitCode: null,
    }),
    [],
  );
});

// ================================================== the one thing it learns

test("a development tool this machine lacks is worth remembering", () => {
  const [fact] = extractMemoryCandidates(
    failed("pnpm test", "bash: pnpm: command not found"),
  );
  assert.equal(fact.kind, "missing-tool");
  assert.equal(fact.subject, "tool:pnpm");
  assert.equal(fact.content, "`pnpm` is not installed on this machine.");
  assert.equal(categoryForKind(fact.kind), "environment");
});

test("recognizes a missing executable on every shell", () => {
  for (const output of [
    "bash: pnpm: command not found",
    "zsh: command not found: pnpm",
    "The term 'pnpm' is not recognized as a name of a cmdlet",
    "'pnpm' is not recognized as an internal or external command",
  ]) {
    assert.equal(parseMissingCommand(output), "pnpm", output);
  }
  assert.equal(parseMissingCommand("everything is fine"), null);
});

test("a path-qualified executable is reported by name", () => {
  assert.equal(
    parseMissingCommand("The term 'C:\\tools\\pnpm.exe' is not recognized"),
    "pnpm",
  );
});

test("a typo is not turned into a permanent fact", () => {
  // Without the whitelist, fat-fingering `ls` would leave "`sl` is not
  // installed on this machine" in the bank forever.
  for (const name of ["sl", "gti", "npmm", "yolo", "asdf123"]) {
    assert.equal(isDevelopmentTool(name), false, `${name} should not qualify`);
    assert.deepEqual(
      extractMemoryCandidates(failed(name, `bash: ${name}: command not found`)),
      [],
    );
  }
});

test("the whitelist covers the tools people actually reach for", () => {
  for (const name of [
    "pnpm", "yarn", "bun", "deno", "node", "cargo", "rustc", "go", "python",
    "poetry", "docker", "kubectl", "terraform", "gh", "tsc", "pytest",
    "claude", "codex", "gemini", "kimi",
  ]) {
    assert.equal(isDevelopmentTool(name), true, `${name} should qualify`);
  }
});

test("tool names are matched regardless of case", () => {
  assert.equal(isDevelopmentTool("PNPM"), true);
  assert.equal(isDevelopmentTool("  Docker  "), true);
});

// ================================================================== identity

test("installing a tool retires the note that it was missing", () => {
  const [missing] = extractMemoryCandidates(
    failed("pnpm test", "zsh: command not found: pnpm"),
  );
  const [again] = extractMemoryCandidates(
    failed("pnpm build", "zsh: command not found: pnpm"),
  );
  assert.equal(
    candidateKey(missing),
    candidateKey(again),
    "the same gap must confirm one fact, not stack up",
  );
});

test("different tools are different facts", () => {
  const [pnpm] = extractMemoryCandidates(failed("pnpm t", "zsh: command not found: pnpm"));
  const [bun] = extractMemoryCandidates(failed("bun t", "zsh: command not found: bun"));
  assert.notEqual(candidateKey(pnpm), candidateKey(bun));
});

test("the bank is global, so a fact carries no workspace", () => {
  const [fact] = extractMemoryCandidates(
    failed("pnpm test", "bash: pnpm: command not found"),
  );
  assert.equal(
    candidateKey(fact),
    "tool:pnpm",
    "identity must not be scoped: one machine, one answer, every workspace",
  );
});
