import { Component, type ReactNode } from "react";
import { Copy, RefreshCw, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/lib/ipc";
import { GITHUB_REPO_URL } from "@/lib/constants";
import { createGitHubIssueUrl, errorReportText, reportAppError } from "@/lib/errors";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    this.setState({ componentStack: info.componentStack ?? null });
    reportAppError(error, {
      category: "render",
      source: "React error boundary",
      details: info.componentStack ?? undefined,
    });
    // eslint-disable-next-line no-console
    console.error("React error boundary caught an error:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private closeWindow = async () => {
    if (isTauri) {
      try {
        await getCurrentWindow().close();
        return;
      } catch {
        // Fall through to DOM close.
      }
    }
    window.close();
  };

  private copyDetails = async () => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const text = errorReportText({
      id: "crash",
      category: "render",
      message: error.message,
      source: "React error boundary",
      stack: error.stack,
      details: componentStack ?? undefined,
      occurredAt: Date.now(),
      occurrences: 1,
    });
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Some environments block clipboard; ignore.
    }
  };

  private openIssues = () => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const url = createGitHubIssueUrl(GITHUB_REPO_URL, {
      id: "crash",
      category: "render",
      message: error.message,
      source: "React error boundary",
      stack: error.stack,
      details: componentStack ?? undefined,
      occurredAt: Date.now(),
      occurrences: 1,
    });
    if (isTauri) {
      void import("@tauri-apps/plugin-opener").then((m) =>
        m.openUrl(url),
      );
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  render(): ReactNode {
    if (this.state.error) {
      const { error, componentStack } = this.state;
      const errorText = error.stack ?? error.message;
      const isDev = import.meta.env.DEV;

      return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <Terminal className="size-4" aria-hidden />
              <span>Black One encountered an error</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={this.reload}>
                <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                Reload
              </Button>
              <Button variant="ghost" size="sm" onClick={this.closeWindow}>
                <X className="mr-1.5 size-3.5" aria-hidden />
                Close
              </Button>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6 sm:p-8">
            <section className="space-y-3">
              <h1 className="text-lg font-semibold">Something went wrong</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Black One hit an unexpected error. The details below can help diagnose it. You can
                reload the app, close the window, or copy the error to share it.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={this.copyDetails}>
                  <Copy className="mr-1.5 size-3.5" aria-hidden />
                  Copy error
                </Button>
                <Button variant="outline" size="sm" onClick={this.openIssues}>
                  Report issue
                </Button>
              </div>
            </section>

            <section className="min-h-0 flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Error details
                </span>
                {isDev && (
                  <span className="text-xs text-muted-foreground">Development build</span>
                )}
              </div>
              <pre className="h-full min-h-48 overflow-auto rounded-lg border border-border bg-muted/50 p-4 font-mono text-xs leading-relaxed">
                <code>{errorText}</code>
                {componentStack && (
                  <>
                    {"\n\n"}
                    <span className="text-muted-foreground">Component stack:</span>
                    {componentStack}
                  </>
                )}
              </pre>
            </section>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
