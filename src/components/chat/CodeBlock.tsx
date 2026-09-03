import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn, copyText } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const codeTheme = useSettingsStore((s) => s.settings.chat.codeTheme);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const documentDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const dark = codeTheme === "dark" || (codeTheme === "auto" && documentDark);
  const theme = dark ? themes.oneDark : themes.oneLight;

  const handleCopy = () => {
    void copyText(code);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border py-1 pl-3 pr-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={handleCopy}
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
