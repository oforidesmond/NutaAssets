import { matchKey } from "@/lib/normalise";

export type AliasMap = Record<string, string>;

function asAliasMap(value: unknown): AliasMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: AliasMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) {
      out[k.trim().toUpperCase()] = v.trim();
    }
  }
  return out;
}

export function parseAliasSetting(value: unknown): AliasMap {
  return asAliasMap(value);
}

/**
 * Resolve a raw value through an alias map, then against known names.
 * Returns the canonical name (or null if unresolved).
 */
export function resolveAlias(
  raw: string | null | undefined,
  aliases: AliasMap,
  knownNames: string[],
): { resolved: string | null; fromAlias: boolean; unknown: boolean } {
  if (!raw) return { resolved: null, fromAlias: false, unknown: false };

  const upper = raw.trim().toUpperCase();
  const knownByUpper = new Map(
    knownNames.map((n) => [n.trim().toUpperCase(), n]),
  );

  // Exact known name
  if (knownByUpper.has(upper)) {
    return {
      resolved: knownByUpper.get(upper)!,
      fromAlias: false,
      unknown: false,
    };
  }

  // Alias map
  if (aliases[upper]) {
    const aliased = aliases[upper]!;
    const known = knownByUpper.get(aliased.toUpperCase()) ?? aliased;
    return { resolved: known, fromAlias: true, unknown: !knownByUpper.has(aliased.toUpperCase()) && !knownByUpper.has(upper) };
  }

  // Fuzzy: strip punctuation and compare
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  for (const [key, name] of knownByUpper) {
    if (key.replace(/[^A-Z0-9]/g, "") === compact) {
      return { resolved: name, fromAlias: false, unknown: false };
    }
  }

  // Alias keys with fuzzy
  for (const [aliasKey, target] of Object.entries(aliases)) {
    if (aliasKey.replace(/[^A-Z0-9]/g, "") === compact) {
      const known = knownByUpper.get(target.toUpperCase()) ?? target;
      return {
        resolved: known,
        fromAlias: true,
        unknown: !knownByUpper.has(target.toUpperCase()),
      };
    }
  }

  return { resolved: null, fromAlias: false, unknown: true };
}

/** Extract model hint from types like "SERVER R730" when alias maps to Server. */
export function extractModelFromType(
  rawType: string | null | undefined,
  resolvedCategory: string | null,
): string | null {
  if (!rawType || !resolvedCategory) return null;
  const upper = rawType.trim().toUpperCase();
  if (!upper.startsWith("SERVER ")) return null;
  if (resolvedCategory.toUpperCase() !== "SERVER") return null;
  const suffix = rawType.trim().slice(7).trim();
  return suffix || null;
}

export function collectUnknownValues(
  values: Array<string | null>,
  aliases: AliasMap,
  knownNames: string[],
): string[] {
  const unknown = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const result = resolveAlias(v, aliases, knownNames);
    if (result.unknown || (!result.resolved && matchKey(v))) {
      unknown.add(v.trim());
    }
  }
  return Array.from(unknown).sort((a, b) => a.localeCompare(b));
}
