import { useState } from "react";
import {
  BookOpen,
  Bug,
  FileCode,
  Hammer,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Snippet {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  prompt: string;
}

const SNIPPETS: Snippet[] = [
  {
    id: "code-review",
    icon: MessageSquareQuote,
    title: "Code review",
    description: "Audit for bugs, edge cases, and missing tests.",
    prompt:
      "Review this code for bugs, edge cases, security issues, and missing tests. Be concise and actionable.",
  },
  {
    id: "refactor",
    icon: FileCode,
    title: "Refactor",
    description: "Clean up structure without changing behavior.",
    prompt:
      "Refactor this code to improve readability and maintainability without changing its behavior.",
  },
  {
    id: "explain",
    icon: BookOpen,
    title: "Explain this",
    description: "Walk through how the code or concept works.",
    prompt:
      "Explain how this works step by step. Keep it clear and assume I understand the basics.",
  },
  {
    id: "summarize",
    icon: Sparkles,
    title: "Summarize",
    description: "Short, focused summary of the key points.",
    prompt: "Summarize the key points in a few short paragraphs.",
  },
  {
    id: "tests",
    icon: ListChecks,
    title: "Write tests",
    description: "Generate unit tests for the selected code.",
    prompt:
      "Write focused unit tests for this code. Cover normal cases, edge cases, and error paths.",
  },
  {
    id: "fix",
    icon: Bug,
    title: "Fix bugs",
    description: "Identify issues and propose corrected code.",
    prompt:
      "Find and fix any bugs in this code. Explain what was wrong and show the corrected version.",
  },
  {
    id: "optimize",
    icon: Zap,
    title: "Optimize",
    description: "Improve performance or reduce complexity.",
    prompt:
      "Optimize this code for performance or reduced complexity. Explain the trade-offs.",
  },
  {
    id: "plan",
    icon: Target,
    title: "Implementation plan",
    description: "Outline an approach before touching code.",
    prompt:
      "Create a step-by-step implementation plan. Keep the scope focused and identify risks upfront.",
  },
  {
    id: "docs",
    icon: Hammer,
    title: "Write docs",
    description: "Add clear comments or documentation.",
    prompt:
      "Write clear documentation or comments for this code. Include usage examples if helpful.",
  },
  {
    id: "brainstorm",
    icon: Lightbulb,
    title: "Brainstorm",
    description: "Generate ideas and alternative approaches.",
    prompt:
      "Brainstorm ideas and alternative approaches. Be creative but practical.",
  },
];

interface PromptSnippetsProps {
  onInsert: (text: string) => void;
  disabled?: boolean;
}

export function PromptSnippets({ onInsert, disabled }: PromptSnippetsProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (snippet: Snippet) => {
    onInsert(snippet.prompt);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Prompt snippets"
          disabled={disabled}
        >
          <Sparkles className="size-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            Prompt snippets
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick a starter prompt to drop into the composer.
          </p>
        </div>
        <div
          role="listbox"
          aria-label="Prompt snippets"
          className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto p-2"
        >
          {SNIPPETS.map((snippet, index) => {
            const Icon = snippet.icon;
            return (
              <button
                key={snippet.id}
                type="button"
                role="option"
                tabIndex={0}
                onClick={() => handleSelect(snippet)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(snippet);
                  }
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-transparent p-2.5 text-left transition-standard",
                  "hover:border-border hover:bg-accent/50 focus-visible:border-ring focus-visible:outline-none",
                  index % 2 === 0 ? "bg-transparent" : "bg-muted/30",
                )}
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <Icon className="size-3.5 text-secondary-foreground" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">{snippet.title}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {snippet.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
