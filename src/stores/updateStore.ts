import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { GITHUB_REPO_URL } from "@/lib/constants";
import { ipc, isTauri } from "@/lib/ipc";
import {
  cleanNotes,
  displayVersion,
  isNewerVersion,
  pickInstaller,
  toPlatform,
  type ReleaseAsset,
} from "@/lib/updateCore";

/**
 * What the app knows about the newest release.
 *
 * The check reads the GitHub releases page and stops there. Nothing is
 * downloaded, and nothing is installed: the builds are not signed with an
 * updater key, so an auto-update could only ever fail halfway. The user is
 * shown what changed and handed the installer.
 */
interface UpdateState {
  /** True only when the published release is genuinely newer than this build. */
  hasUpdate: boolean;
  latestVersion: string | null;
  releaseName: string | null;
  notes: string;
  publishedAt: string | null;
  pageUrl: string;
  commitSha: string | null;
  /** The file this machine should download, when the release has one. */
  installer: ReleaseAsset | null;
  checking: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  /** Whether the "what's new" dialog is open. */
  dialogOpen: boolean;

  checkNow: () => Promise<boolean>;
  openDialog: () => void;
  closeDialog: () => void;
  dismiss: () => void;
}

function shortCommit(sha: string | null | undefined): string | null {
  if (!sha) return null;
  // `target_commitish` is a branch name on most releases; only show it when it
  // is actually a commit.
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
  return sha.slice(0, 7);
}

const RELEASES_PAGE = `${GITHUB_REPO_URL}/releases`;

export const useUpdateStore = create<UpdateState>()(
  immer((set) => ({
    hasUpdate: false,
    latestVersion: null,
    releaseName: null,
    notes: "",
    publishedAt: null,
    pageUrl: RELEASES_PAGE,
    commitSha: null,
    installer: null,
    checking: false,
    error: null,
    lastCheckedAt: null,
    dialogOpen: false,

    checkNow: async () => {
      if (!isTauri) return false;
      set((state) => {
        state.checking = true;
        state.error = null;
      });
      try {
        const release = await ipc.checkForUpdates();
        const newer = isNewerVersion(release.tag, release.currentVersion);
        set((state) => {
          state.checking = false;
          state.lastCheckedAt = Date.now();
          state.error = release.status === "error" ? (release.error ?? "Update check failed.") : null;
          state.hasUpdate = newer;
          state.latestVersion = newer ? displayVersion(release.tag) : null;
          state.releaseName = newer ? (release.name ?? null) : null;
          state.notes = newer ? cleanNotes(release.notes) : "";
          state.publishedAt = newer ? (release.publishedAt ?? null) : null;
          state.pageUrl = release.pageUrl || RELEASES_PAGE;
          state.commitSha = newer ? shortCommit(release.commitSha) : null;
          state.installer = newer
            ? pickInstaller(
                release.assets ?? [],
                toPlatform(release.platform),
                release.arch,
              )
            : null;
        });
        return newer;
      } catch (error) {
        set((state) => {
          state.checking = false;
          state.error =
            error instanceof Error ? error.message : "Update check failed.";
        });
        return false;
      }
    },

    openDialog: () =>
      set((state) => {
        state.dialogOpen = true;
      }),

    closeDialog: () =>
      set((state) => {
        state.dialogOpen = false;
      }),

    dismiss: () =>
      set((state) => {
        state.hasUpdate = false;
        state.dialogOpen = false;
      }),
  })),
);
