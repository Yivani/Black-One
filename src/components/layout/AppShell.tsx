import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { ChatArea } from "@/components/layout/ChatArea";
import { LayoutEditor } from "@/components/layout/LayoutEditor";
import { RightPanel } from "@/components/layout/RightPanel";
import { Sidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/layout/TitleBar";

const AgentView = lazy(() =>
  import("@/components/views/AgentView").then((module) => ({
    default: module.AgentView,
  })),
);
const CodeView = lazy(() =>
  import("@/components/views/CodeView").then((module) => ({
    default: module.CodeView,
  })),
);

function ViewFallback() {
  return (
    <div
      className="h-full min-w-0 flex-1 animate-pulse bg-muted/20"
      aria-label="Loading view"
    />
  );
}

function MainContent() {
  const viewMode = useUiStore((s) => s.viewMode);
  switch (viewMode) {
    case "agent":
      return (
        <Suspense fallback={<ViewFallback />}>
          <AgentView key="agent-view" />
        </Suspense>
      );
    case "code":
      return (
        <Suspense fallback={<ViewFallback />}>
          <CodeView key="code-view" />
        </Suspense>
      );
    case "chat":
    default:
      return <ChatArea key="chat-area" />;
  }
}

export function AppShell() {
  const zenMode = useUiStore((s) => s.zenMode);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const sidebarPosition = useUiStore((s) => s.sidebarPosition);
  const rightPanelPosition = useUiStore((s) => s.rightPanelPosition);
  const layoutEditing = useUiStore((s) => s.layoutEditing);

  const sidebar = zenMode ? null : <Sidebar key="sidebar" />;
  const rightPanel = rightPanelOpen ? (
    <RightPanel key="right-panel" position={rightPanelPosition} />
  ) : null;

  const elements: React.ReactNode[] = [];
  if (rightPanelPosition === "left" && rightPanel) elements.push(rightPanel);
  if (sidebarPosition === "left" && sidebar) elements.push(sidebar);
  elements.push(<MainContent key="main-content" />);
  if (sidebarPosition === "right" && sidebar) elements.push(sidebar);
  if (rightPanelPosition === "right" && rightPanel) elements.push(rightPanel);

  const shell = (
    <TooltipProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <TitleBar />
        <div className="flex min-h-0 flex-1">{elements}</div>
      </div>
    </TooltipProvider>
  );

  return layoutEditing ? <LayoutEditor>{shell}</LayoutEditor> : shell;
}
