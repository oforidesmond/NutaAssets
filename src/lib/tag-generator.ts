export type TagGeneratorInput = {
  template: string;
  branchCode: string;
  departmentCode?: string;
  categoryCode?: string;
  year?: number;
  /** Existing tags in the same department (or globally) used to pick next SEQ. */
  existingTags: string[];
};

const SEQ_TOKEN = /\{SEQ:(\d+)\}/i;

/**
 * Build the next suggested asset tag from a format template.
 * Tokens: {BRANCH}, {DEPT}, {CAT}, {YEAR}, {SEQ:n}
 */
export function suggestNextTag(input: TagGeneratorInput): string {
  const year = input.year ?? new Date().getFullYear();
  const seqMatch = input.template.match(SEQ_TOKEN);
  const seqWidth = seqMatch ? Number(seqMatch[1]) : 4;

  const prefixTemplate = input.template
    .replace(/\{BRANCH\}/gi, input.branchCode)
    .replace(/\{DEPT\}/gi, input.departmentCode ?? "")
    .replace(/\{CAT\}/gi, input.categoryCode ?? "")
    .replace(/\{YEAR\}/gi, String(year));

  const prefixForMatch = prefixTemplate.replace(SEQ_TOKEN, "").toUpperCase();
  const escapedPrefix = escapeRegex(prefixForMatch);
  const seqPattern = new RegExp(
    `^${escapedPrefix}(\\d{1,${Math.max(seqWidth, 8)}})$`,
    "i",
  );

  let maxSeq = 0;
  for (const tag of input.existingTags) {
    if (!tag) continue;
    const m = tag.toUpperCase().match(seqPattern);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }

  const next = maxSeq + 1;
  const padded = String(next).padStart(seqWidth, "0");
  return prefixTemplate.replace(SEQ_TOKEN, padded);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTagFormatSetting(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "template" in value &&
    typeof (value as { template: unknown }).template === "string"
  ) {
    return (value as { template: string }).template;
  }
  return "NRB/{BRANCH}/EQ/{SEQ:4}";
}
