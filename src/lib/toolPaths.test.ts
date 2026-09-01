import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTerminalScript,
  normalizePathForCompare,
  parseTerminalOutput,
  pathLooksInsideAny,
  resolvePath,
  stripAnsi,
} from "./toolPaths.ts";

// ---------------------------------------------------------------- containment

test("normalizes separators, case, and drive letters", () => {
  assert.equal(normalizePathForCompare("C:\\Proj\\Src"), "c:/proj/src");
  assert.equal(normalizePathForCompare("C:/proj//src/"), "c:/proj/src");
  assert.equal(normalizePathForCompare("/home/user/./app"), "/home/user/app");
});

test("collapses traversal segments", () => {
  assert.equal(normalizePathForCompare("C:/proj/../../Windows"), "c:/windows");
  assert.equal(normalizePathForCompare("C:/proj/sub/../other"), "c:/proj/other");
  assert.equal(normalizePathForCompare("/a/b/../../etc/passwd"), "/etc/passwd");
});

test("traversal cannot climb above an absolute root", () => {
  assert.equal(normalizePathForCompare("C:/../../.."), "c:/");
  assert.equal(normalizePathForCompare("/../../etc"), "/etc");
});

test("accepts paths inside a root", () => {
  const roots = ["C:\\proj"];
  assert.equal(pathLooksInsideAny("C:/proj", roots), true);
  assert.equal(pathLooksInsideAny("C:/proj/src/main.ts", roots), true);
  assert.equal(pathLooksInsideAny("C:\\proj\\src\\main.ts", roots), true);
  assert.equal(pathLooksInsideAny("C:/PROJ/Src", roots), true);
});

test("rejects traversal out of a root", () => {
  const roots = ["C:\\proj"];
  assert.equal(pathLooksInsideAny("C:/proj/../../Windows", roots), false);
  assert.equal(pathLooksInsideAny("C:/proj/../secrets.txt", roots), false);
  assert.equal(pathLooksInsideAny("C:/proj/sub/../../..", roots), false);
  assert.equal(
    pathLooksInsideAny("/home/user/project/../../../etc/passwd", [
      "/home/user/project",
    ]),
    false,
  );
});

test("rejects a sibling directory that shares a name prefix", () => {
  assert.equal(pathLooksInsideAny("C:/project-backup/x", ["C:/project"]), false);
  assert.equal(pathLooksInsideAny("/srv/appdata", ["/srv/app"]), false);
});

test("rejects unrelated absolute paths", () => {
  const roots = ["C:\\proj"];
  assert.equal(pathLooksInsideAny("C:/Users/me/.ssh/id_rsa", roots), false);
  assert.equal(pathLooksInsideAny("/etc/shadow", ["/home/me"]), false);
});

test("honours any of several roots", () => {
  const roots = ["C:/a", "C:/b"];
  assert.equal(pathLooksInsideAny("C:/b/file.txt", roots), true);
  assert.equal(pathLooksInsideAny("C:/c/file.txt", roots), false);
});

test("resolves relative paths against the first root only", () => {
  assert.equal(resolvePath("src/main.ts", ["C:\\proj"]), "C:/proj/src/main.ts");
  assert.equal(resolvePath("C:/other/x.ts", ["C:\\proj"]), "C:/other/x.ts");
  assert.equal(resolvePath("/etc/passwd", ["/home/me"]), "/etc/passwd");
  assert.equal(resolvePath("x.ts", []), "x.ts");
});

test("a resolved relative traversal is still rejected", () => {
  const roots = ["C:\\proj"];
  const resolved = resolvePath("../../Windows/System32", roots);
  assert.equal(pathLooksInsideAny(resolved, roots), false);
});

// -------------------------------------------------------------------- ansi

test("strips colour, cursor, and title sequences", () => {
  assert.equal(stripAnsi("\u001B[32mok\u001B[0m"), "ok");
  assert.equal(stripAnsi("\u001B]0;title\u0007done"), "done");
  assert.equal(stripAnsi("a\u001B[2Kb"), "ab");
  assert.equal(stripAnsi("plain"), "plain");
});

// --------------------------------------------------------- terminal capture

const script = buildTerminalScript({
  command: "npm test",
  cwd: "C:/proj",
  terminalCwd: "C:/proj",
  shell: "PowerShell",
  token: "T1",
});

test("omits the cd when the terminal is already in the target directory", () => {
  assert.ok(!script.script.includes("cd "));
  const moved = buildTerminalScript({
    command: "ls",
    cwd: "C:/proj/sub",
    terminalCwd: "C:/proj",
    shell: "PowerShell",
    token: "T2",
  });
  assert.ok(moved.script.includes('cd "C:/proj/sub"'));
});

test("returns null until the end marker arrives", () => {
  assert.equal(parseTerminalOutput("some output\n", script), null);
  assert.equal(
    parseTerminalOutput(`PS> Write-Host "${script.endMarker}"\n`, script),
    null,
    "the echoed script line must not be mistaken for the marker",
  );
});

test("captures output between the markers and drops the shell echo", () => {
  const raw = [
    `PS C:\\proj> Write-Host "${script.beginMarker}"`,
    script.beginMarker,
    "PS C:\\proj> npm test",
    "all suites passed",
    `PS C:\\proj> Write-Host "${script.exitPrefix}..."`,
    `${script.exitPrefix}0__`,
    `PS C:\\proj> Write-Host "${script.endMarker}"`,
    script.endMarker,
    "PS C:\\proj> ",
  ].join("\r\n");

  const result = parseTerminalOutput(raw, script);
  assert.ok(result);
  assert.equal(result.exitCode, 0);
  assert.ok(result.output.includes("all suites passed"));
  assert.ok(
    !result.output.includes(script.exitPrefix),
    "the exit sentinel must not leak into model-visible output",
  );
  assert.ok(!result.output.includes(script.beginMarker));
});

test("reports a non-zero exit code as failure", () => {
  const raw = [
    script.beginMarker,
    "error TS2345: bad argument",
    `${script.exitPrefix}1__`,
    script.endMarker,
  ].join("\n");

  const result = parseTerminalOutput(raw, script);
  assert.ok(result);
  assert.equal(result.exitCode, 1);
  assert.ok(result.output.includes("error TS2345"));
});

test("reads negative exit codes", () => {
  const raw = [
    script.beginMarker,
    `${script.exitPrefix}-1073741510__`,
    script.endMarker,
  ].join("\n");
  assert.equal(parseTerminalOutput(raw, script)?.exitCode, -1073741510);
});

test("an unreadable sentinel yields null, never a success", () => {
  const raw = [script.beginMarker, "output only", script.endMarker].join("\n");
  const result = parseTerminalOutput(raw, script);
  assert.ok(result);
  assert.equal(
    result.exitCode,
    null,
    "a missing exit code must not be reported as 0",
  );
});

test("strips ansi before matching markers", () => {
  const raw = [
    `\u001B[32m${script.beginMarker}\u001B[0m`,
    "output",
    `${script.exitPrefix}0__`,
    `\u001B[32m${script.endMarker}\u001B[0m`,
  ].join("\n");
  const result = parseTerminalOutput(raw, script);
  assert.ok(result);
  assert.equal(result.exitCode, 0);
  assert.equal(result.output, "output");
});

test("cmd and sh scripts carry the same sentinels", () => {
  for (const shell of ["cmd", "bash"]) {
    const built = buildTerminalScript({
      command: "echo hi",
      cwd: "/w",
      terminalCwd: "/w",
      shell,
      token: "T3",
    });
    const raw = [
      built.beginMarker,
      "hi",
      `${built.exitPrefix}0__`,
      built.endMarker,
    ].join("\n");
    const result = parseTerminalOutput(raw, built);
    assert.ok(result, `${shell} capture`);
    assert.equal(result.exitCode, 0, `${shell} exit code`);
    assert.equal(result.output, "hi", `${shell} output`);
  }
});
