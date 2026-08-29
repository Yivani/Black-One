import { isValidElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

const components: Components = {
  h1: ({ children }) => <h1 className="text-lg font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
  p: ({ children }) => <p className="message-body">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="message-body">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  table: ({ children }) => <table className="w-full text-xs">{children}</table>,
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  hr: () => <hr className="border-border" />,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    if (match) {
      return <CodeBlock language={match[1]} code={extractText(children).replace(/\n$/, "")} />;
    }
    return (
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    );
  },
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("message-body space-y-2 text-sm", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
