"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormDraft } from "@/hooks/use-form-draft";
import { updateSettingsAction } from "@/server/actions/admin";
import type { SettingsSnapshot } from "@/server/services/admin-settings";

type SettingsDraft = {
  orgName: string;
  orgLogoUrl: string;
  tagFormat: string;
  placeholders: string;
  attachmentsEnabled: boolean;
};

function snapshotToDraft(initial: SettingsSnapshot): SettingsDraft {
  return {
    orgName: initial.orgName,
    orgLogoUrl: initial.orgLogoUrl ?? "",
    tagFormat: initial.tagFormat,
    placeholders: initial.placeholders.join("\n"),
    attachmentsEnabled: initial.attachmentsEnabled,
  };
}

export function SettingsForm({ initial }: { initial: SettingsSnapshot }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => snapshotToDraft(initial));
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(snapshotToDraft(initial)),
  );

  const restoreDraft = useCallback((draft: SettingsDraft) => {
    setForm({
      orgName: draft.orgName ?? "",
      orgLogoUrl: draft.orgLogoUrl ?? "",
      tagFormat: draft.tagFormat ?? "",
      placeholders: draft.placeholders ?? "",
      attachmentsEnabled: Boolean(draft.attachmentsEnabled),
    });
  }, []);

  const { clearDraft } = useFormDraft({
    draftKey: "admin:settings",
    values: form,
    isEmpty: (v) => JSON.stringify(v) === baseline,
    onRestore: restoreDraft,
  });

  const canSave = useMemo(
    () => Boolean(form.orgName.trim() && form.tagFormat.trim()),
    [form.orgName, form.tagFormat],
  );

  function save() {
    startTransition(async () => {
      const result = await updateSettingsAction({
        orgName: form.orgName,
        orgLogoUrl: form.orgLogoUrl || null,
        tagFormat: form.tagFormat,
        placeholders: form.placeholders,
        attachmentsEnabled: form.attachmentsEnabled,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not save settings");
        return;
      }
      clearDraft();
      setBaseline(JSON.stringify(form));
      toast.success("Settings saved");
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Organisation</h3>
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Display name</Label>
          <Input
            id="org-name"
            value={form.orgName}
            onChange={(e) =>
              setForm((f) => ({ ...f, orgName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-logo">Logo URL (optional)</Label>
          <Input
            id="org-logo"
            value={form.orgLogoUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, orgLogoUrl: e.target.value }))
            }
            placeholder="https://…"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Asset tag format</h3>
        <div className="space-y-1.5">
          <Label htmlFor="tag-format">Template</Label>
          <Input
            id="tag-format"
            value={form.tagFormat}
            onChange={(e) =>
              setForm((f) => ({ ...f, tagFormat: e.target.value }))
            }
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Tokens: {"{BRANCH}"}, {"{DEPT}"}, {"{CAT}"}, {"{YEAR}"}, {"{SEQ:n}"}{" "}
            (e.g. NRB/{"{BRANCH}"}/EQ/{"{SEQ:4}"})
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Empty placeholders</h3>
        <div className="space-y-1.5">
          <Label htmlFor="placeholders">
            Values treated as empty (one per line)
          </Label>
          <Textarea
            id="placeholders"
            rows={5}
            value={form.placeholders}
            onChange={(e) =>
              setForm((f) => ({ ...f, placeholders: e.target.value }))
            }
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Matching values in tag, brand, model, serial, etc. are stored as
            blank.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Attachments</h3>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.attachmentsEnabled}
            onCheckedChange={(c) =>
              setForm((f) => ({ ...f, attachmentsEnabled: c === true }))
            }
          />
          Enable photo attachments (requires Vercel Blob — optional)
        </label>
      </section>

      <Button onClick={save} disabled={pending || !canSave}>
        Save settings
      </Button>
    </div>
  );
}
