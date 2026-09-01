import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanNotes,
  compareVersions,
  displayVersion,
  formatBytes,
  isNewerVersion,
  parseVersion,
  pickInstaller,
  toPlatform,
  type ReleaseAsset,
} from "./updateCore.ts";

const asset = (name: string, size = 1024): ReleaseAsset => ({
  name,
  url: `https://github.com/Yivani/Black-One/releases/download/v1.2.0/${name}`,
  size,
});

// ================================================================ versions

test("reads the tag shapes GitHub actually produces", () => {
  assert.deepEqual(parseVersion("v1.2.3"), { parts: [1, 2, 3], prerelease: "" });
  assert.deepEqual(parseVersion("1.2.3"), { parts: [1, 2, 3], prerelease: "" });
  assert.deepEqual(parseVersion(" v2.0 "), { parts: [2, 0, 0], prerelease: "" });
  assert.deepEqual(parseVersion("v1.2.3-beta.1"), {
    parts: [1, 2, 3],
    prerelease: "beta.1",
  });
});

test("refuses anything that is not a version", () => {
  for (const value of ["", "latest", "nightly", "v", null, undefined]) {
    assert.equal(parseVersion(value), null, String(value));
  }
});

test("orders versions numerically, not alphabetically", () => {
  // "1.10.0" < "1.9.0" as strings, which is exactly the trap.
  const older = parseVersion("1.9.0")!;
  const newer = parseVersion("1.10.0")!;
  assert.equal(compareVersions(older, newer), -1);
  assert.equal(compareVersions(newer, older), 1);
  assert.equal(compareVersions(newer, parseVersion("v1.10.0")!), 0);
});

test("a prerelease is older than the release it leads to", () => {
  const beta = parseVersion("1.2.0-beta.1")!;
  const final = parseVersion("1.2.0")!;
  assert.equal(compareVersions(beta, final), -1);
  assert.equal(compareVersions(final, beta), 1);
  assert.equal(compareVersions(beta, parseVersion("1.2.0-beta.2")!), -1);
});

test("only a genuinely newer release counts as an update", () => {
  assert.equal(isNewerVersion("v1.2.0", "1.1.0"), true);
  assert.equal(isNewerVersion("v1.10.0", "1.9.0"), true);
  assert.equal(isNewerVersion("v1.1.0", "1.1.0"), false, "same version");
  assert.equal(isNewerVersion("1.1.0", "1.1.0"), false, "same, tagged without v");
  assert.equal(isNewerVersion("v1.0.9", "1.1.0"), false, "an older release");
  assert.equal(isNewerVersion("v1.1.0-rc.1", "1.1.0"), false, "a release candidate");
});

test("an unreadable tag never prompts an update", () => {
  // The old check compared strings, so a tag like "nightly" read as an update
  // forever. Silence is the right answer when the tag says nothing.
  assert.equal(isNewerVersion("nightly", "1.1.0"), false);
  assert.equal(isNewerVersion(null, "1.1.0"), false);
  assert.equal(isNewerVersion("v2.0.0", null), false);
});

// ================================================================== assets

const WINDOWS_RELEASE = [
  asset("Black.One_1.2.0_x64-setup.exe", 8_400_000),
  asset("Black.One_1.2.0_x64-setup.exe.sig", 200),
  asset("Black.One_1.2.0_x64_en-US.msi", 9_100_000),
  asset("Black.One_1.2.0_aarch64-setup.exe", 8_200_000),
];

test("picks the Windows installer, not its signature", () => {
  const picked = pickInstaller(WINDOWS_RELEASE, "windows", "x86_64");
  assert.equal(picked?.name, "Black.One_1.2.0_x64-setup.exe");
});

test("picks the build for this machine's architecture", () => {
  assert.equal(
    pickInstaller(WINDOWS_RELEASE, "windows", "aarch64")?.name,
    "Black.One_1.2.0_aarch64-setup.exe",
  );
});

test("prefers the setup executable over the msi", () => {
  const picked = pickInstaller(
    [asset("app_1.2.0_x64_en-US.msi"), asset("app_1.2.0_x64-setup.exe")],
    "windows",
    "x86_64",
  );
  assert.equal(picked?.name, "app_1.2.0_x64-setup.exe");
});

test("falls back down the list when the preferred kind is absent", () => {
  assert.equal(
    pickInstaller([asset("app_1.2.0_x64_en-US.msi")], "windows", "x86_64")?.name,
    "app_1.2.0_x64_en-US.msi",
  );
});

test("knows the mac and linux artifacts too", () => {
  const mac = [asset("Black.One_1.2.0_aarch64.dmg"), asset("Black.One.app.tar.gz")];
  assert.equal(pickInstaller(mac, "macos", "aarch64")?.name, "Black.One_1.2.0_aarch64.dmg");
  const linux = [asset("black-one_1.2.0_amd64.deb"), asset("black-one_1.2.0_amd64.AppImage")];
  assert.equal(
    pickInstaller(linux, "linux", "x86_64")?.name,
    "black-one_1.2.0_amd64.AppImage",
  );
});

test("a release with nothing for this platform picks nothing", () => {
  assert.equal(pickInstaller(WINDOWS_RELEASE, "macos", "aarch64"), null);
  assert.equal(pickInstaller([], "windows", "x86_64"), null);
  assert.equal(pickInstaller(WINDOWS_RELEASE, "unknown"), null);
});

test("checksums and manifests are never offered as a download", () => {
  const noise = [
    asset("latest.json"),
    asset("SHA256SUMS.txt"),
    asset("Black.One_1.2.0_x64-setup.exe.sig"),
  ];
  assert.equal(pickInstaller(noise, "windows", "x86_64"), null);
});

test("an unlabelled installer is preferred over one for another chip", () => {
  const mixed = [asset("app-arm64-setup.exe"), asset("app-setup.exe")];
  assert.equal(pickInstaller(mixed, "windows", "x86_64")?.name, "app-setup.exe");
});

test("reads the platform the backend reports", () => {
  assert.equal(toPlatform("windows"), "windows");
  assert.equal(toPlatform("macos"), "macos");
  assert.equal(toPlatform("linux"), "linux");
  assert.equal(toPlatform("freebsd"), "unknown");
  assert.equal(toPlatform(null), "unknown");
});

// ================================================================= display

test("sizes are readable at a glance", () => {
  assert.equal(formatBytes(8_400_000), "8 MB");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1_572_864), "1.5 MB");
  assert.equal(formatBytes(0), "");
  assert.equal(formatBytes(Number.NaN), "");
});

test("the version is shown without its tag prefix", () => {
  assert.equal(displayVersion("v1.2.0"), "1.2.0");
  assert.equal(displayVersion("1.2.0"), "1.2.0");
  assert.equal(displayVersion(null), "");
});

test("release notes lose GitHub's boilerplate tail", () => {
  const notes = [
    "## What's new",
    "",
    "- Faster terminals",
    "",
    "## New Contributors",
    "* @someone made their first contribution",
    "",
    "**Full Changelog**: https://github.com/a/b/compare/v1.1.0...v1.2.0",
  ].join("\n");
  const cleaned = cleanNotes(notes);
  assert.ok(cleaned.includes("Faster terminals"));
  assert.ok(!cleaned.includes("Full Changelog"));
  assert.ok(!cleaned.includes("New Contributors"));
});

test("a very long body is cut rather than filling the dialog", () => {
  const cleaned = cleanNotes("x".repeat(9000), 100);
  assert.equal(cleaned.length, 101, "100 characters plus the ellipsis");
  assert.ok(cleaned.endsWith("…"));
});

test("empty notes stay empty", () => {
  assert.equal(cleanNotes(null), "");
  assert.equal(cleanNotes("   "), "");
});
