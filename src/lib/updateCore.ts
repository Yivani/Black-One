/**
 * Deciding whether a GitHub release is worth telling the user about, and which
 * file they should download.
 *
 * Black One does not auto-update. The installer is not signed with an updater
 * key, so a background download-and-install can never succeed — pretending
 * otherwise produced a "Download & Install" button that failed every time. The
 * honest flow is the one here: read the release, show what changed, and hand
 * over the installer.
 *
 * Import-free so version comparison and asset picking are unit-tested.
 */

export interface ReleaseAsset {
  name: string;
  url: string;
  /** Bytes, as GitHub reports them. */
  size: number;
}

export interface Release {
  /** Tag, usually `v1.2.0`. */
  tag: string | null;
  /** Release title, when the author set one. */
  name: string | null;
  /** Markdown body. */
  notes: string | null;
  publishedAt: string | null;
  pageUrl: string | null;
  commitSha: string | null;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export type Platform = "windows" | "macos" | "linux" | "unknown";

// ---------------------------------------------------------------- versions

export interface Version {
  parts: number[];
  /** The `-beta.2` tail, empty for a final release. */
  prerelease: string;
}

/** Reads `v1.2.0`, `1.2`, `v2.0.0-rc.1`. Returns null for anything else. */
export function parseVersion(raw: string | null | undefined): Version | null {
  if (!raw) return null;
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.+))?$/.exec(raw.trim());
  if (!match) return null;
  return {
    parts: [match[1], match[2], match[3]].map((part) => Number(part ?? 0)),
    prerelease: match[4] ?? "",
  };
}

/**
 * Orders two versions: -1 if `a` is older, 1 if newer, 0 if the same.
 *
 * Follows semver on one point that matters here: a prerelease sorts *below*
 * the release it leads to, so 1.2.0-beta.1 must never look newer than 1.2.0.
 */
export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) {
    const left = a.parts[i] ?? 0;
    const right = b.parts[i] ?? 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

/**
 * Whether the release is genuinely newer than what is installed.
 *
 * The old check was `tag !== "v" + current`, which called *any* difference an
 * update — including a release older than the running build, and including the
 * same version tagged without its `v`.
 */
export function isNewerVersion(
  latestTag: string | null | undefined,
  currentVersion: string | null | undefined,
): boolean {
  const latest = parseVersion(latestTag);
  const current = parseVersion(currentVersion);
  if (!latest || !current) return false;
  return compareVersions(latest, current) > 0;
}

// ------------------------------------------------------------------ assets

/** Files that are never what a person wants to download. */
const NOT_AN_INSTALLER = /\.(sig|sha256|blockmap|txt|json|asc|pem)$/i;

/**
 * Installer extensions per platform, best first.
 *
 * Windows leads with the NSIS `-setup.exe` because that is what this project
 * publishes; the others are there so a future release with a different
 * artifact still resolves to something.
 */
const INSTALLERS: Record<Platform, RegExp[]> = {
  windows: [/-setup\.exe$/i, /\.msi$/i, /\.exe$/i],
  macos: [/\.dmg$/i, /\.app\.tar\.gz$/i, /\.pkg$/i],
  linux: [/\.appimage$/i, /\.deb$/i, /\.rpm$/i, /\.tar\.gz$/i],
  unknown: [],
};

/** Tokens a release file uses to name the architecture it is built for. */
const ARCH_TOKENS: Record<string, RegExp> = {
  x86_64: /(?:x64|x86[_-]?64|amd64)/i,
  aarch64: /(?:arm64|aarch64)/i,
};

/**
 * The file this machine should download.
 *
 * Returns null when the release has no installer for this platform, which the
 * UI shows as "open the releases page" rather than a broken download.
 */
export function pickInstaller(
  assets: readonly ReleaseAsset[],
  platform: Platform,
  arch?: string,
): ReleaseAsset | null {
  const usable = assets.filter(
    (asset) => asset.name && asset.url && !NOT_AN_INSTALLER.test(asset.name),
  );
  const wanted = arch ? ARCH_TOKENS[arch] : undefined;

  for (const pattern of INSTALLERS[platform] ?? []) {
    const matches = usable.filter((asset) => pattern.test(asset.name));
    if (matches.length === 0) continue;
    // Prefer a file that names this architecture; a file that names none is
    // assumed to be universal and is still better than one for another chip.
    const forThisArch = wanted && matches.filter((asset) => wanted.test(asset.name));
    if (forThisArch && forThisArch.length > 0) return forThisArch[0];
    const unlabelled = matches.filter(
      (asset) => !Object.values(ARCH_TOKENS).some((token) => token.test(asset.name)),
    );
    return unlabelled[0] ?? matches[0];
  }
  return null;
}

/** Maps what the backend reports to the platform names used above. */
export function toPlatform(value: string | null | undefined): Platform {
  switch ((value ?? "").toLowerCase()) {
    case "windows":
    case "win32":
      return "windows";
    case "macos":
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

// ------------------------------------------------------------------ display

/** `12.4 MB`. Sizes are shown so nobody starts a download blind. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

/** Version without the leading `v`, for putting in a sentence. */
export function displayVersion(tag: string | null | undefined): string {
  return (tag ?? "").trim().replace(/^v/i, "");
}

/**
 * Tidies release notes for display.
 *
 * GitHub's generated notes end with a compare link and a contributors block
 * that say nothing to someone deciding whether to update, and the body can be
 * arbitrarily long. Both are trimmed here rather than in the component.
 */
export function cleanNotes(notes: string | null | undefined, maxChars = 6000): string {
  if (!notes) return "";
  let text = notes.replace(/\r\n/g, "\n").trim();
  text = text.replace(/\n+\*\*Full Changelog\*\*:.*$/s, "");
  text = text.replace(/\n+## New Contributors\n[\s\S]*$/s, "");
  text = text.trim();
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars).trimEnd()}…`;
  }
  return text;
}
