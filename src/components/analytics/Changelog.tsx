import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn, formatTimestamp } from "@/lib/utils";

interface Release {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  html_url: string;
  prerelease: boolean;
}

const REPO = "Yivani/Black-One";
const API_URL = `https://api.github.com/repos/${REPO}/releases`;

export function Changelog() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }
      const data = (await response.json()) as Release[];
      setReleases(
        data
          .filter((release) => !release.prerelease)
          .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
          .slice(0, 10),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReleases();
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <header className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/20 px-4 py-2.5 pr-12">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Updates</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh changelog"
          onClick={() => void fetchReleases()}
          disabled={loading}
          className="size-7 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
        </Button>
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {error && (
            <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchReleases()}>
                Try again
              </Button>
            </div>
          )}

          {!error && releases.length === 0 && !loading && (
            <div className="rounded-lg border border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
              No releases found.
            </div>
          )}

          {releases.map((release) => (
            <article
              key={release.id}
              className="rounded-lg border border-border/60 bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {release.name || release.tag_name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(Date.parse(release.published_at))}
                  </p>
                </div>
                <a
                  href={release.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Open release on GitHub"
                >
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </div>
              {release.body && (
                <div className="mt-3 border-t border-border/60 pt-3 text-sm">
                  <MarkdownRenderer content={release.body} />
                </div>
              )}
            </article>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
