import { cache } from "react";

import { configurePlaceholders } from "@/lib/normalise";
import { getSettingsSnapshot } from "@/server/services/admin-settings";

/** Load placeholders from Settings and configure normalise for this request. */
export const loadPlaceholdersIntoNormalise = cache(async () => {
  const settings = await getSettingsSnapshot();
  configurePlaceholders(settings.placeholders);
  return settings.placeholders;
});
