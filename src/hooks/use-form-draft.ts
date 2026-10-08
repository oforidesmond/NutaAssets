"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import {
  clearFormDraft,
  draftStorageKey,
  readFormDraft,
  writeFormDraft,
} from "@/lib/form-draft";

type UseFormDraftOptions<T> = {
  draftKey: string;
  values: T;
  enabled?: boolean;
  isEmpty?: (values: T) => boolean;
  onRestore: (values: T) => void;
  debounceMs?: number;
};

/**
 * Silently persist form values in localStorage and restore on remount.
 * No UI — callers wire clearDraft() after a successful save.
 */
export function useFormDraft<T>({
  draftKey,
  values,
  enabled = true,
  isEmpty,
  onRestore,
  debounceMs = 400,
}: UseFormDraftOptions<T>): { clearDraft: () => void } {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const ready = enabled && status === "authenticated" && Boolean(userId);
  const storageKey =
    ready && userId ? draftStorageKey(userId, draftKey) : null;

  const restoredForKey = useRef<string | null>(null);
  const skipWrites = useRef(true);
  const valuesRef = useRef(values);
  const onRestoreRef = useRef(onRestore);
  const isEmptyRef = useRef(isEmpty);
  valuesRef.current = values;
  onRestoreRef.current = onRestore;
  isEmptyRef.current = isEmpty;

  // Stable dependency — ignore new object identities with the same content
  const serialized = JSON.stringify(values);

  useEffect(() => {
    if (!storageKey) {
      skipWrites.current = true;
      return;
    }
    if (restoredForKey.current === storageKey) {
      skipWrites.current = false;
      return;
    }

    restoredForKey.current = storageKey;
    skipWrites.current = true;

    const draft = readFormDraft<T>(storageKey);
    const empty = draft == null || (isEmptyRef.current?.(draft) ?? false);
    if (!empty && draft != null) {
      onRestoreRef.current(draft);
    }

    const t = window.setTimeout(() => {
      skipWrites.current = false;
    }, debounceMs);
    return () => window.clearTimeout(t);
  }, [storageKey, debounceMs]);

  useEffect(() => {
    if (!storageKey || skipWrites.current) return;

    const t = window.setTimeout(() => {
      if (skipWrites.current || !storageKey) return;
      const current = valuesRef.current;
      const empty = isEmptyRef.current?.(current) ?? false;
      if (empty) {
        clearFormDraft(storageKey);
      } else {
        writeFormDraft(storageKey, current);
      }
    }, debounceMs);

    return () => window.clearTimeout(t);
  }, [serialized, storageKey, debounceMs]);

  const clearDraft = useCallback(() => {
    if (storageKey) clearFormDraft(storageKey);
  }, [storageKey]);

  return { clearDraft };
}
