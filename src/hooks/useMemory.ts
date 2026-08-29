import { useCallback, useEffect, useState } from "react";
import type { MemoryBank } from "@/lib/memory";
import { deleteMemoryBank, loadMemoryBank } from "@/lib/memory";

export interface UseMemoryResult {
  bank: MemoryBank | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  deleteAll: () => Promise<void>;
}

export function useMemory(): UseMemoryResult {
  const [bank, setBank] = useState<MemoryBank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadMemoryBank();
      setBank(loaded);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAll = useCallback(async () => {
    await deleteMemoryBank();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bank, loading, error, refresh, deleteAll };
}
