import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  autoFocus,
  "aria-label": ariaLabel,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [local, value, onChange]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? placeholder}
        className="h-8 pl-8 pr-7 text-[13px]"
      />
      {local.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setLocal("");
            onChange("");
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-standard hover:bg-accent hover:text-accent-foreground"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </div>
  );
}
