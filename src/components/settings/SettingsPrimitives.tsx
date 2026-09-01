import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Shared settings rhythm.
 *
 * Every page is a stack of `SettingsSection`s and every control is one row with
 * the same label/description/control shape, so the modal reads as one document
 * instead of a dozen differently-built forms.
 */

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("border-b border-border pb-6 last:border-b-0 last:pb-0", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

interface RowProps {
  id: string;
  label: string;
  description?: string;
  children: ReactNode;
  /** Puts the control under the label instead of beside it. */
  stacked?: boolean;
}

export function SettingRow({ id, label, description, children, stacked }: RowProps) {
  if (stacked) {
    return (
      <div className="space-y-2">
        <div>
          <Label htmlFor={id}>{label}</Label>
          {description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow id={id} label={label} description={description}>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </SettingRow>
  );
}

export function SelectRow({
  id,
  label,
  description,
  value,
  options,
  onValueChange,
  width = "w-56",
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  width?: string;
}) {
  return (
    <SettingRow id={id} label={label} description={description}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className={width}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>
  );
}

export function SliderRow({
  id,
  label,
  description,
  value,
  min,
  max,
  step,
  format,
  onValueChange,
}: {
  id: string;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Rendered beside the label; defaults to the raw number. */
  format?: (value: number) => string;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      {description && (
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onValueChange(next)}
      />
    </div>
  );
}

interface Choice<T extends string> {
  id: T;
  label: string;
  description?: string;
  /** Rendered above the label — an emoji, a flag, or an icon element. */
  glyph?: ReactNode;
}

/**
 * A radio group rendered as cards. Used where the options carry a consequence
 * worth spelling out (permission modes, languages) rather than a bare list.
 */
export function ChoiceCards<T extends string>({
  label,
  value,
  choices,
  onChange,
  columns = 3,
}: {
  label: string;
  value: T;
  choices: ReadonlyArray<Choice<T>>;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}) {
  const grid =
    columns === 1 ? "grid-cols-1" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", grid)}>
      {choices.map((choice) => {
        const active = choice.id === value;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(choice.id)}
            className={cn(
              "rounded-lg border p-3 text-left transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-accent/40 ring-1 ring-primary"
                : "border-border hover:bg-accent/40",
            )}
          >
            {choice.glyph && (
              <div className="mb-2 text-xl leading-none" aria-hidden>
                {choice.glyph}
              </div>
            )}
            <div className="text-sm font-medium">{choice.label}</div>
            {choice.description && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {choice.description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Muted note used for caveats that are not a control. */
export function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
      {children}
    </p>
  );
}
