import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/utils";

/** How long a copy control shows its tick before the copy icon returns. */
const COPIED_FEEDBACK_MS = 1200;

/**
 * Copy to clipboard with short-lived confirmation.
 *
 * The timer is cleared on unmount, so a row that is deleted, re-sorted or
 * dragged away while the tick is up never sets state after it is gone.
 */
export function useCopyText(text: string): {
  copied: boolean;
  copy: () => void;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void copyText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    });
  }, [text]);

  return { copied, copy };
}
