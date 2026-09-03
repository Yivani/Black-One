import { Check, Copy } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { Button } from "@/components/ui/button";
import { useCopyText } from "@/hooks/useCopyText";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const codeTheme = useSettingsStore((s) => s.settings.chat.codeTheme);
  const { copied, copy } = useCopyText(code);

  const documentDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const dark = codeTheme === "dark" || (codeTheme === "auto" && documentDark);
  const theme = dark ? themes.oneDark : themes.oneLight;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border py-1 pl-3 pr-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <Check className="size-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <Copy className="size-3.5 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </div>
      <Highlight theme={theme} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(className, "overflow-x-auto p-3 font-mono text-xs")}
            style={{ ...style, backgroundColor: "transparent" }}
          >
            {tokens.map((line, lineIndex) => (
              <div key={lineIndex} {...getLineProps({ line })}>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
