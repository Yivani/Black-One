import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/constants";

export type RightPanelTab = "sources" | "files" | "preview" | "agent";

export type LayoutId = "default" | "focus" | "terminal" | "quad" | string;

export type TitleBarItemId =
  | "sidebar"
  | "identity"
  | "views"
  | "layout"
  | "haptics"
  | "settings"
  | "rightPanel"
  | "theme";

export type TitleBarZone = "left" | "center" | "right" | "hidden";

export type TitleBarLayout = Record<TitleBarZone, TitleBarItemId[]>;

export const DEFAULT_TITLE_BAR_LAYOUT: TitleBarLayout = {
  left: ["sidebar", "identity"],
  center: ["views"],
  right: ["layout", "haptics", "settings", "rightPanel", "theme"],
  hidden: [],
};

function cloneTitleBarLayout(layout: TitleBarLayout): TitleBarLayout {
  return {
    left: [...layout.left],
    center: [...layout.center],
    right: [...layout.right],
    hidden: [...layout.hidden],
  };
}

export interface SavedLayout {
  id: LayoutId;
  name: string;
  zenMode: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  sidebarPosition: "left" | "right";
  rightPanelPosition: "left" | "right";
  titleBarLayout?: TitleBarLayout;
}

export const LAYOUT_PRESETS: SavedLayout[] = [
  { id: "default", name: "Default", zenMode: false, rightPanelOpen: false, rightPanelTab: "sources", sidebarPosition: "left", rightPanelPosition: "left" },
  { id: "focus", name: "Focus", zenMode: true, rightPanelOpen: false, rightPanelTab: "sources", sidebarPosition: "left", rightPanelPosition: "left" },
  { id: "terminal", name: "Terminal deck", zenMode: true, rightPanelOpen: true, rightPanelTab: "agent", sidebarPosition: "left", rightPanelPosition: "left" },
  { id: "quad", name: "Quad", zenMode: false, rightPanelOpen: true, rightPanelTab: "files", sidebarPosition: "left", rightPanelPosition: "right" },
];

export type SettingsCategory =
  | "model"
  | "chat"
  | "appearance"
  | "safety"
  | "memory"
  | "advanced"
  | "notifications"
  | "haptics"
  | "providers"
  | "shortcuts"
  | "tools"
  | "archive"
  | "about";

interface UiState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  rightPanelTab: RightPanelTab;
  zenMode: boolean;
  sidebarPosition: "left" | "right";
  rightPanelPosition: "left" | "right";
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  commandPaletteOpen: boolean;
  sidebarSearch: string;
  /** Incremented to request composer focus from anywhere. */
  composerFocusSignal: number;
  /** Incremented to trigger the composer's file/folder pickers. */
  attachFileSignal: number;
  attachFolderSignal: number;
  /** Incremented to load the last user message into the composer for editing. */
  editLastMessageSignal: number;
  /** Active citation/message preview shown in the right panel. */
  previewMessageId: string | null;
  /** Currently active layout preset or saved layout id. */
  layout: LayoutId;
  /** User-saved custom arrangements. */
  savedLayouts: SavedLayout[];
  /** Current top-level view mode. */
  viewMode: "chat" | "code" | "agent";
  /** Currently selected agent preset in the Agent workspace. */
  selectedAgentPresetId: string | null;
  /** Whether the inline layout editor is active. */
  layoutEditing: boolean;
  titleBarLayout: TitleBarLayout;

  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  openRightPanel: (tab: RightPanelTab) => void;
  toggleZenMode: () => void;
  setZenMode: (enabled: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSidebarPosition: (position: "left" | "right") => void;
  setRightPanelPosition: (position: "left" | "right") => void;
  applyLayout: (id: LayoutId) => void;
  saveCurrentLayout: (name: string, patch?: Partial<SavedLayout>) => void;
  deleteSavedLayout: (id: LayoutId) => void;
  setViewMode: (mode: "chat" | "code" | "agent") => void;
  setSelectedAgentPresetId: (id: string | null) => void;
  openSettings: (category?: SettingsCategory) => void;
  closeSettings: () => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSidebarSearch: (query: string) => void;
  requestComposerFocus: () => void;
  requestAttachFile: () => void;
  requestAttachFolder: () => void;
  requestEditLastMessage: () => void;
  setPreviewMessageId: (id: string | null) => void;
  setLayoutEditing: (editing: boolean) => void;
  setTitleBarLayout: (layout: TitleBarLayout) => void;
  moveTitleBarItem: (
    item: TitleBarItemId,
    zone: TitleBarZone,
    before?: TitleBarItemId,
  ) => void;
}

function readInitial<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writePersisted(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in hardened contexts; UI state is non-critical.
  }
}

const initialLayoutId = readInitial<LayoutId>("ui:layout", "default");
const initialSavedLayouts = readInitial<SavedLayout[]>("ui:savedLayouts", []);
const initialLayoutConfig: SavedLayout =
  LAYOUT_PRESETS.find((p) => p.id === initialLayoutId) ??
  initialSavedLayouts.find((l) => l.id === initialLayoutId) ??
  LAYOUT_PRESETS[0];

export const useUiStore = create<UiState>()(
  immer((set) => ({
    sidebarCollapsed: readInitial("ui:sidebarCollapsed", false),
    sidebarWidth: readInitial("ui:sidebarWidth", SIDEBAR_DEFAULT_WIDTH),
    rightPanelOpen: initialLayoutConfig.rightPanelOpen,
    rightPanelWidth: readInitial(
      "ui:rightPanelWidth",
      RIGHT_PANEL_DEFAULT_WIDTH,
    ),
    rightPanelTab: initialLayoutConfig.rightPanelTab,
    zenMode: initialLayoutConfig.zenMode,
    sidebarPosition: initialLayoutConfig.sidebarPosition,
    rightPanelPosition: initialLayoutConfig.rightPanelPosition,
    settingsOpen: false,
    settingsCategory: "model",
    commandPaletteOpen: false,
    sidebarSearch: "",
    composerFocusSignal: 0,
    attachFileSignal: 0,
    attachFolderSignal: 0,
    editLastMessageSignal: 0,
    previewMessageId: null,
    layout: initialLayoutId,
    savedLayouts: initialSavedLayouts,
    viewMode: "chat",
    selectedAgentPresetId: null,
    layoutEditing: false,
    titleBarLayout: readInitial(
      "ui:titleBarLayout",
      cloneTitleBarLayout(DEFAULT_TITLE_BAR_LAYOUT),
    ),

    toggleSidebar: () =>
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        state.zenMode = false;
        writePersisted("ui:sidebarCollapsed", state.sidebarCollapsed);
      }),

    setSidebarWidth: (width) =>
      set((state) => {
        const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
        state.sidebarWidth = clamped;
        state.sidebarCollapsed = clamped <= SIDEBAR_COLLAPSED_WIDTH;
        writePersisted("ui:sidebarWidth", state.sidebarWidth);
      }),

    setRightPanelWidth: (width) =>
      set((state) => {
        const clamped = Math.min(
          RIGHT_PANEL_MAX_WIDTH,
          Math.max(RIGHT_PANEL_MIN_WIDTH, width),
        );
        state.rightPanelWidth = clamped;
        writePersisted("ui:rightPanelWidth", state.rightPanelWidth);
      }),

    toggleRightPanel: () =>
      set((state) => {
        state.rightPanelOpen = !state.rightPanelOpen;
      }),

    setRightPanelTab: (tab) =>
      set((state) => {
        state.rightPanelTab = tab;
      }),

    openRightPanel: (tab) =>
      set((state) => {
        state.rightPanelOpen = true;
        state.rightPanelTab = tab;
      }),

    toggleZenMode: () =>
      set((state) => {
        state.zenMode = !state.zenMode;
      }),

    setZenMode: (enabled) =>
      set((state) => {
        state.zenMode = enabled;
      }),

    setRightPanelOpen: (open) =>
      set((state) => {
        state.rightPanelOpen = open;
      }),

    setSidebarPosition: (position) =>
      set((state) => {
        state.sidebarPosition = position;
      }),

    setRightPanelPosition: (position) =>
      set((state) => {
        state.rightPanelPosition = position;
      }),

    applyLayout: (id) =>
      set((state) => {
        const preset = LAYOUT_PRESETS.find((p) => p.id === id);
        const saved = state.savedLayouts.find((l) => l.id === id);
        const config = preset ?? saved;
        if (!config) return;
        state.layout = id;
        state.zenMode = config.zenMode;
        state.rightPanelOpen = config.rightPanelOpen;
        state.rightPanelTab = config.rightPanelTab;
        state.sidebarPosition = config.sidebarPosition;
        state.rightPanelPosition = config.rightPanelPosition;
        if (config.titleBarLayout) {
          state.titleBarLayout = cloneTitleBarLayout(config.titleBarLayout);
          writePersisted("ui:titleBarLayout", state.titleBarLayout);
        }
        writePersisted("ui:layout", id);
      }),

    saveCurrentLayout: (name, patch) =>
      set((state) => {
        const id = `custom-${Date.now()}`;
        state.savedLayouts.push({
          id,
          name,
          zenMode: state.zenMode,
          rightPanelOpen: state.rightPanelOpen,
          rightPanelTab: state.rightPanelTab,
          sidebarPosition: state.sidebarPosition,
          rightPanelPosition: state.rightPanelPosition,
          titleBarLayout: cloneTitleBarLayout(state.titleBarLayout),
          ...patch,
        });
        state.layout = id;
        writePersisted("ui:savedLayouts", state.savedLayouts);
        writePersisted("ui:layout", id);
      }),

    deleteSavedLayout: (id) =>
      set((state) => {
        state.savedLayouts = state.savedLayouts.filter((l) => l.id !== id);
        if (state.layout === id) {
          state.layout = "default";
        }
        writePersisted("ui:savedLayouts", state.savedLayouts);
        writePersisted("ui:layout", state.layout);
      }),

    setViewMode: (mode) =>
      set((state) => {
        state.viewMode = mode;
      }),

    setSelectedAgentPresetId: (id) =>
      set((state) => {
        state.selectedAgentPresetId = id;
      }),

    openSettings: (category) =>
      set((state) => {
        state.settingsOpen = true;
        if (category) state.settingsCategory = category;
      }),

    closeSettings: () =>
      set((state) => {
        state.settingsOpen = false;
      }),

    setSettingsCategory: (category) =>
      set((state) => {
        state.settingsCategory = category;
      }),

    setCommandPaletteOpen: (open) =>
      set((state) => {
        state.commandPaletteOpen = open;
      }),

    setSidebarSearch: (query) =>
      set((state) => {
        state.sidebarSearch = query;
      }),

    requestComposerFocus: () =>
      set((state) => {
        state.composerFocusSignal += 1;
      }),

    requestAttachFile: () =>
      set((state) => {
        state.attachFileSignal += 1;
      }),

    requestAttachFolder: () =>
      set((state) => {
        state.attachFolderSignal += 1;
      }),

    requestEditLastMessage: () =>
      set((state) => {
        state.editLastMessageSignal += 1;
      }),

    setPreviewMessageId: (id) =>
      set((state) => {
        state.previewMessageId = id;
      }),

    setLayoutEditing: (editing) =>
      set((state) => {
        state.layoutEditing = editing;
      }),

    setTitleBarLayout: (layout) =>
      set((state) => {
        state.titleBarLayout = cloneTitleBarLayout(layout);
        writePersisted("ui:titleBarLayout", state.titleBarLayout);
      }),

    moveTitleBarItem: (item, zone, before) =>
      set((state) => {
        for (const currentZone of ["left", "center", "right", "hidden"] as const) {
          state.titleBarLayout[currentZone] = state.titleBarLayout[currentZone].filter(
            (current) => current !== item,
          );
        }
        const target = state.titleBarLayout[zone];
        const index = before ? target.indexOf(before) : -1;
        target.splice(index < 0 ? target.length : index, 0, item);
        writePersisted("ui:titleBarLayout", state.titleBarLayout);
      }),
  })),
);
