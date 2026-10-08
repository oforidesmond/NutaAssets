# AssetTrack — User guide

Plain-language help for branch officers and ICT admins. Dates and currency follow Ghana conventions (DD/MM/YYYY, GHS).

## 1. Add an asset (under 30 seconds)

1. Sign in and pick your **department** in the top bar if you have more than one.
2. Go to **Assets → Add asset** (or press **Ctrl+K** / **⌘K** and choose Add asset).
3. Required: **category**, **branch**, and **status**. Everything else can be blank.
4. Enter tag, serial, brand, and model when you know them. Leave unknown fields empty — do **not** type `*`, `N/A`, or `-`.
5. Optional: use **Scan to fill** to read a barcode into the tag or serial field.
6. Tap **Save**, or **Save & add another** to keep branch/category for the next device.

Tip: if the tag or serial already exists, the app warns you and can still save after you acknowledge. Duplicates appear in **Needs review**.

## 2. Import from Excel

1. Open **Import / Export**.
2. Choose your `.xlsx` or `.csv` file. Parsing happens in your browser (large files stay within Vercel’s request limits).
3. Confirm the detected header row and map columns (Asset Tag/Label → tag, User Assigned → assigned to, Location → branch when using the consolidated sheet).
4. Review normalisation: placeholders become empty; asset types map to categories; statuses map to your legend.
5. Resolve any unknown values, then import. Progress shows in chunks of 200 rows.
6. Read the result summary. Open **Needs review** for flagged duplicates or gaps.
7. Mistakes? Use **Undo import** on that job to soft-delete assets created by it.

## 3. Run a branch reconciliation

1. An admin creates an **exercise** under **Reconciliation** (name, dates, branches).
2. Open your **branch sheet** on a phone or laptop.
3. For each expected asset: **Found**, **Found – details differ**, or **Missing**. Scan a tag/serial to jump to the row.
4. Add any **unlisted** devices you find that are not on the register.
5. **Submit** when finished. A department admin opens the **diff preview**, then **Approves** to apply changes to the master register.
6. Export a legacy-style branch sheet from the exercise if auditors still want the old paper layout.

## 4. Export lists and print labels

1. On **Assets**, filter or multi-select rows, then export **Excel**, **CSV**, or **PDF**.
2. Or open **Reports** for ready-made printable lists (register by branch, needs attention, by assignee, warranty, data quality, reconciliation summary).
3. **Print labels** builds a PDF with a QR code (opens the asset in AssetTrack) plus the human-readable tag, branch, and category.
4. Use **legacy branch-sheet export** on Import when you need the original inventory sheet look.

## 5. Clear the “Needs review” queue

1. Open **Needs review** from the dashboard card or **Assets → Needs review**.
2. Read the reason badges (duplicate tag/serial, missing tag, placeholder value, etc.).
3. One-click fixes:
   - **Suggest tag** — fills the next tag from your template.
   - **Clear placeholders** — turns leftover `*` / `N/A` into empty fields.
   - **Open** — edit the asset fully or compare duplicates.
4. **Mark reviewed** when you are happy — clears the flag without deleting the asset.
5. Select many rows and **Mark selected reviewed** after a big import clean-up.

## Quick tips

- **Ctrl+K / ⌘K** — search assets and jump to pages.
- Soft-deleted assets live in **Admin → Recycle bin** until restored.
- Viewers can read and export but cannot change data.
- Ask a Super Admin for new departments, branches, categories, statuses, or custom fields — all configurable in **Admin** without a code deploy.
