export type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
  conflict?: boolean;
  duplicates?: {
    reasons: string[];
    tagHits: { id: string; assetTag: string | null; serialNumber: string | null }[];
    serialHits: {
      id: string;
      assetTag: string | null;
      serialNumber: string | null;
    }[];
  };
};

/** Narrow helper so catch handlers can return typed ActionResults. */
export function fail<T = undefined>(
  result: ActionResult,
): ActionResult<T> {
  return result as ActionResult<T>;
}
