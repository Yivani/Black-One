import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { useTranslation } from "@/hooks/useTranslation";

/** How long a copy control shows its tick before the copy icon returns. */
const COPIED_FEEDBACK_MS = 1200;

/**
 * Copy to clipboard with short-lived confirmation.
 *
 * The tick only appears when the clipboard actually took the text; a refused
 * copy says so instead of looking like it worked, and `onCopied` runs only on
 * the successful path. The timer is cleared on unmount, so a row that is
 * deleted, re-sorted or dragged away while the tick is up never sets state
 * after it is gone.
 */
export function useCopyText(
  text: string,
  options: { onCopied?: () => void } = {},
): {
  copied: boolean;
  copy: () => void;
} {
  const { onCopied } = options;
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void copyText(text).then((ok) => {
      if (!ok) {
        toast.error(t("common.copyFailed"));
        return;
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      onCopied?.();
    });
  }, [text, t, onCopied]);

  return { copied, copy };
}
