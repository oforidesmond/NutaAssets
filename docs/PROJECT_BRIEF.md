# BUILD PROMPT — ICT Asset Management System (AssetTrack)

## 0. How to work

You are a senior full-stack engineer. Build the system described below end to end. Work in **phases** (section 14). At the end of each phase: make sure `npm run build`, `npm run lint`, and `npm run typecheck` pass, summarise what was done, and list anything deferred. Do not stop to ask me questions unless truly blocked. Where something is ambiguous, pick the sensible default, record it in `docs/DECISIONS.md`, and keep going. Prefer boring, well-supported solutions over clever ones. Do not leave TODO stubs in finished features.

---

## 1. Context

I work in the ICT department of a community bank (the bank recently elevated to Community Bank status) in Ghana (asset tags look like `NRB/BK/EQ/1148`). We just completed a physical asset reconciliation across all branches to account for every computer, printer, and related device. We recorded everything in Excel (one sheet per branch, later consolidated). Going forward we want a **web app** to do this properly, and to be reusable by **other departments** (e.g. Operations, Finance, Admin/Facilities) who may want to track their own assets with their own fields.

### What the current Excel looks like (real structure — design around it)

Sheet title: `BRANCH ICT ASSET INVENTORY SHEET`

Header block (one per sheet): **Branch Name**, **Inventory Date**, **Prepared By**, and a **Status Legend**: `Active, Faulty, Disposed, In Repair, Lost, Retired`.

Table columns (header row is row 5):
`Asset Tag/Label | Asset Type | Brand | Model | Serial Number | User Assigned | Status | Location | Remarks`

Sample rows:
| Tag | Type | Brand | Model | Serial | User | Status | Location | Remarks |
|---|---|---|---|---|---|---|---|---|
| NRB/BK/EQ/1148 | PRINTER | CANON | MF3010 | FM00555SR12J1T0152 | RISK OFFICE | ACTIVE | MAGAZINE | |
| NRB/BH/DC/EQ/013 | LAPTOP | HP | HP PAVILION X360 CONVERTIBLE 15-CR0XXX | 8CG8327FBD | NANA YAA SAKKAH ADDAE | FAULTY | BAREKESE | Laptop in very old state and freezes randomly. Needs immediate change |
| N/A | SYSTEM UNIT | DELL | OPTIPLEX 990 | (blank) | AMINA BUKARI | ACTIVE | MAGAZINE | SYSTEM UNIT SLOW |
| * | UPS | * | * | * | ICT | ACTIVE | DATA CENTER | |

### Data-quality realities found in the sample (188 data rows) — the app must handle these gracefully

- **Asset types are free text and inconsistent:** MONITOR (50), SYSTEM UNIT (49), LAPTOP (43), PRINTER (22), CORE ROUTER (3), SERVER R730 / R630 / T320 / R320 (model baked into type), STAR LINK, EXTERNAL BACKUP, CISCO SWITCH, POE - SWITCH, TP LINK SWITCH, MTN - POE, UPS.
- **Placeholders for "unknown":** `*` and `N/A` used in tag, brand, model and serial columns (15 `*` brands, many `*` serials/tags). Blank serials: 14. Blank/empty rows: 9.
- **Duplicates:** ~19 duplicate serial numbers and ~11 duplicate asset tags across rows. Some are genuine data entry errors; the app must **flag, not silently reject**.
- **Statuses drift from the legend:** `INACTIVE` appears but is not in the legend; everything is UPPERCASE.
- **"Location" in the consolidated file is really the branch** (BAREKESE, BOHYEN, SAGOE LANE, ABUAKWA, ASUOFIA, OFFINSO, ANWIAM, MAGAZINE, TECH). So the app needs **Branch** as a first-class entity plus an optional finer-grained **Sub-location** (e.g. "Head Office","Cash Office", "Server Room", "Manager's Office").
- **Tag codes embed the branch** (`BK`=Barekese, `BH`=Bohyen, `AS`=Asuofia, `ABK`=Abuakwa, `SG`=Sagoe Lane, `OFF`=Offinso, `AN`=Anwiam, `MG`=Magazine, `TJ`, etc.). Each branch should have a short **code** so the app can suggest/auto-generate tags.
- A monitor, system unit and printer are often assigned to the same person → the system should make it easy to see "everything assigned to X".
- "User Assigned" is sometimes a person (`AMINA BUKARI`), sometimes a unit (`RISK OFFICE`, `ICT`). Model it as free-text **Assigned To** with an optional link to a **Person** record (see model).

---

## 2. Tech stack (fixed)

- **Next.js (latest stable, App Router)** + **TypeScript (strict)**
- **Prisma ORM** (latest stable) with **PostgreSQL**
- **Deployment: Vercel (Hobby/free)** with **Vercel's free Postgres option** (Neon via Vercel Marketplace / Storage tab). Use `DATABASE_URL` (pooled) for runtime and `DIRECT_URL` (non-pooled) for migrations. Follow the current Prisma + Neon/Vercel docs for the correct driver adapter setup.
- **Tailwind CSS + shadcn/ui** (Radix primitives), `lucide-react` icons
- **TanStack Table** for data grids, **React Hook Form + Zod** for forms and validation (share Zod schemas between client and server)
- **Auth.js (NextAuth v5)** with Credentials provider (email + password), hashed with `argon2` or `bcryptjs`. Session via JWT. No third-party SSO for v1, but structure code so Microsoft Entra ID/Google could be added later.
- **SheetJS (`xlsx`) or `exceljs`** for Excel import/export; **`papaparse`** for CSV
- **Recharts** for charts
- **`html5-qrcode`** (or native `BarcodeDetector` w/ fallback) for camera scanning; **`qrcode`** + **`jspdf`** (or react-pdf) for label sheets
- **Vitest** (unit) + **Playwright** (a few e2e smoke tests)
- **ESLint + Prettier**, Husky optional

### Vercel free-tier constraints you MUST design around
1. Serverless function default timeout is short (~10s on Hobby; set `maxDuration` where allowed) → **bulk operations must be chunked** (e.g. 200 rows per request) with a progress UI.
2. Request body limit ≈ 4.5 MB → **parse Excel files in the browser**, send validated JSON rows in chunks. Don't upload the raw file to a server action.
3. No persistent filesystem → no local file writes. Optional photo attachments go to **Vercel Blob** (feature-flagged; app must work without it).
4. Free Postgres has limited storage/compute (cold starts) → add proper indexes, paginate server-side, avoid N+1 queries, never load whole tables into memory.
5. Add `"postinstall": "prisma generate"` and use `prisma migrate deploy` in the Vercel build command. Don't instantiate multiple PrismaClients in dev (use the global singleton pattern).
6. All secrets via env vars; provide `.env.example`.

---

## 3. Product principles

1. **Easy first.** A branch ICT officer with basic computer skills should add an asset in under 30 seconds and understand every screen without training. Plain language, no jargon, helpful empty states, inline hints.
2. **Flexible by configuration, not code.** Admins add departments, branches, asset categories, statuses, and custom fields from the UI — never a deploy.
3. **Trustworthy data.** Soft-delete only, full audit trail, duplicate detection, validation, clear "needs attention" queues.
4. **Reconciliation is a first-class workflow**, not just a list — because that's the exercise we just did by hand.
5. **Mobile-friendly.** Officers will stand in branches with a phone. Everything core must work well at 375px width.

---

## 4. Roles & permissions (RBAC)

| Role | Scope | Can do |
|---|---|---|
| **Super Admin** | Global | Everything: users, departments, branches, categories, custom fields, statuses, settings, audit log, import/export, hard config |
| **Department Admin** | Own department(s) | Manage that department's categories, custom fields, statuses, users, assets, reconciliations, reports |
| **Editor / Officer** | Assigned department(s) and optionally restricted to assigned branch(es) | Create/edit assets, transfer, change status, run reconciliation counts, import, export |
| **Viewer / Auditor** | Assigned department(s) | Read-only incl. reports and audit log for their scope |

- Enforce permissions **server-side** in every server action/route handler via a central `authorize(user, action, resource)` helper. Never rely on hidden buttons alone.
- Users belong to one or more **departments** and optionally are restricted to specific **branches**.
- Admin UI for users: invite/create (set temp password, force change on first login), deactivate, reset password, change role. Rate-limit login attempts; lock after N failures.
- First-run: `prisma db seed` creates a Super Admin from env vars (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) and the default ICT department + starter config (below).

---

## 5. Data model (Prisma) — implement this, refine where sensible

Use `cuid()` ids, `createdAt/updatedAt` everywhere, and soft delete (`deletedAt`) on business entities.

```prisma
model Department {
  id          String   @id @default(cuid())
  name        String   @unique          // "ICT", "Operations"
  code        String   @unique          // "ICT", "OPS" – used in tag generation
  description String?
  isActive    Boolean  @default(true)
  // relations: users (via UserDepartment), categories, fieldDefs, statuses, assets, reconciliations
}

model Branch {
  id        String  @id @default(cuid())
  name      String  @unique             // "Barekese"
  code      String  @unique             // "BK" – matches tag convention NRB/BK/...
  type      BranchType @default(BRANCH) // BRANCH | HEAD_OFFICE | DATA_CENTER | OTHER
  address   String?
  isActive  Boolean @default(true)
  sortOrder Int     @default(0)
}

model Location {                         // optional sub-location inside a branch
  id       String @id @default(cuid())
  branchId String
  name     String                        // "Cash Office", "Server Room", "Magazine"
  @@unique([branchId, name])
}

model User {
  id, name, email @unique, passwordHash, role (SUPER_ADMIN|DEPT_ADMIN|EDITOR|VIEWER),
  isActive, mustChangePassword, failedLogins, lockedUntil, lastLoginAt
  // many-to-many: departments (UserDepartment), branches (UserBranch, optional restriction)
}

model Category {                         // replaces free-text "Asset Type"; scoped to a department
  id           String @id @default(cuid())
  departmentId String
  name         String                    // "Laptop", "Printer", "Monitor", "System Unit", "Server", "Router", "Switch", "UPS"
  code         String                    // "LT","PR","MN" – used for tag generation
  icon         String?                   // lucide icon name
  parentId     String?                   // optional hierarchy: Network > Switch
  isActive     Boolean @default(true)
  @@unique([departmentId, name])
}

model Status {                           // configurable per department; seeded from the legend
  id           String @id @default(cuid())
  departmentId String
  name         String                    // Active, Faulty, In Repair, Disposed, Lost, Retired, Inactive
  color        String                    // badge colour
  kind         StatusKind                // IN_USE | NOT_IN_USE | NEEDS_ATTENTION | END_OF_LIFE  (drives dashboard logic)
  isDefault    Boolean @default(false)
  sortOrder    Int
  @@unique([departmentId, name])
}

model Person {                           // optional staff directory so "assigned to" is consistent
  id, name, staffId?, email?, phone?, branchId?, unitOrRole? (e.g. "Risk Office"), isActive
}

model Asset {
  id             String   @id @default(cuid())
  departmentId   String
  categoryId     String
  branchId       String
  locationId     String?                 // sub-location
  assetTag       String?                 // nullable: many existing items have none ("N/A", "*")
  serialNumber   String?
  brand          String?
  model          String?
  statusId       String
  assignedToText String?                 // free text, e.g. "AMINA BUKARI" or "RISK OFFICE"
  assignedToId   String?                 // optional link to Person
  purchaseDate   DateTime?
  purchaseCost   Decimal?  @db.Decimal(12,2)
  warrantyExpiry DateTime?
  condition      Condition?              // NEW | GOOD | FAIR | POOR
  remarks        String?
  customFields   Json      @default("{}") // values keyed by FieldDefinition.key  (JSONB)
  needsReview    Boolean   @default(false) // set by import/duplicate checks
  reviewReasons  String[]                 // e.g. ["DUPLICATE_SERIAL","MISSING_TAG","PLACEHOLDER_BRAND"]
  deletedAt      DateTime?
  createdById, updatedById
  @@index([departmentId, branchId, statusId])
  @@index([serialNumber]) @@index([assetTag])
  // NOTE: do NOT make tag/serial globally unique at DB level (real data has duplicates and blanks).
  // Enforce uniqueness softly in the app: warn + require acknowledgement, and surface in "Needs Review".
}

model FieldDefinition {                  // admin-defined custom fields
  id            String @id @default(cuid())
  departmentId  String
  categoryId    String?                  // null = applies to all categories in the department
  key           String                   // machine key, slugified, immutable after creation
  label         String                   // "RAM", "Hostname", "IP Address", "Operating System"
  type          FieldType                // TEXT | LONG_TEXT | NUMBER | DECIMAL | DATE | BOOLEAN | SELECT | MULTI_SELECT | EMAIL | URL | PHONE
  options       Json?                    // for SELECT/MULTI_SELECT: [{value,label}]
  required      Boolean @default(false)
  unique        Boolean @default(false)
  helpText      String?
  placeholder   String?
  defaultValue  Json?
  showInList    Boolean @default(false)  // appears as optional column in the table
  searchable    Boolean @default(true)
  sortOrder     Int
  isActive      Boolean @default(true)   // archive instead of delete so historic values aren't lost
  @@unique([departmentId, key])
}

model AssetEvent {                       // asset history timeline
  id, assetId, type (CREATED|UPDATED|STATUS_CHANGED|TRANSFERRED|ASSIGNED|VERIFIED|NOTE|DISPOSED...),
  fromValue Json?, toValue Json?, note String?, userId, createdAt
}

model AuditLog {                         // system-wide: who did what, when, to which entity, before/after diff
  id, userId, action, entityType, entityId, before Json?, after Json?, ip?, userAgent?, createdAt
}

model ReconciliationExercise {           // = one "asset reconciliation campaign" like the one we just did
  id, departmentId, name ("2026 Annual ICT Reconciliation"), startDate, endDate?, status (DRAFT|IN_PROGRESS|COMPLETED|CANCELLED),
  scopeBranchIds String[], notes, createdById, completedAt
}

model ReconciliationEntry {              // a branch-level sheet within an exercise (replaces "one Excel per branch")
  id, exerciseId, branchId, preparedById, inventoryDate, status (NOT_STARTED|IN_PROGRESS|SUBMITTED|APPROVED|REJECTED), submittedAt, approvedById, comment
}

model ReconciliationItem {               // per-asset verification result
  id, entryId, assetId?, result (FOUND|FOUND_DIFFERENT|MISSING|NEW_UNLISTED), 
  observed Json?,                        // what was actually found (status, location, user, serial…)
  note, verifiedById, verifiedAt
}

model ImportJob { id, userId, fileName, mapping Json, totalRows, created, updated, skipped, flagged, errors Json?, createdAt }
model Setting   { key @id, value Json }  // org name, logo URL, tag format template, etc.
```

### Custom-field design rules
- Values live in `Asset.customFields` (JSONB) keyed by `FieldDefinition.key`, with a **GIN index** for filtering/search.
- Validate custom values on the server against the active `FieldDefinition`s for that asset's department + category using a dynamically built Zod schema.
- Renaming a label is free; **key is immutable**. Deleting a field = **archive** (hidden but data preserved, restorable). Changing a type is blocked once data exists unless it is a safe widening (e.g. NUMBER → TEXT).
- Fields can be scoped: whole department, or one category (e.g. "RAM" and "Hostname" only for Laptop/System Unit; "Page Counter" only for Printer; "IP Address" for network devices).
- Dynamic form renderer: one `<DynamicField />` component that renders any FieldDefinition type in forms, filters, table cells, import mapping, and exports.

---

## 6. Seed data (from the Excel legend and sample)

For the **ICT** department seed:
- **Statuses:** Active (IN_USE, green), Faulty (NEEDS_ATTENTION, red), In Repair (NEEDS_ATTENTION, amber), Inactive (NOT_IN_USE, grey), Retired (END_OF_LIFE, slate), Disposed (END_OF_LIFE, slate), Lost (END_OF_LIFE, dark red).
- **Categories:** Laptop, Desktop/System Unit, Monitor, Printer, Server, Core Router, Switch (Cisco / TP-Link / PoE as brand/model, not separate categories), UPS, External Backup, Satellite/Starlink, Other Network Device. Include a normalisation alias map used by the importer (e.g. `SYSTEM UNIT`→System Unit, `CISCO SWITCH|TP LINK SWITCH|POE - SWITCH`→Switch, `SERVER R730|R630|T320|R320`→Server with model captured from the suffix, `STAR LINK`→Satellite/Starlink, `MTN - POE`→Switch).
- **Branches** (code in brackets, editable): Barekese (BK), Bohyen (BH), Sagoe Lane (SG), Abuakwa (ABK), Asuofia (AS), Offinso (OFF), Anwiam (AN), Magazine (MG), Head Office (HO), Data Center (DC), Tech (TJ?) — mark uncertain codes in `docs/DECISIONS.md` for me to confirm.
- **Starter custom fields** (so the feature is demonstrably useful; all editable/removable): Laptop & System Unit → *Operating System* (select), *RAM (GB)* (number), *Storage (GB)* (number), *Hostname* (text), *Processor* (text); Printer → *Printer Type* (select: Laser/Inkjet/Multifunction), *IP Address*; Network devices → *IP Address*, *Firmware Version*.
- **Setting:** asset tag format template, default `NRB/{BRANCH}/EQ/{SEQ:4}` (configurable; `{BRANCH}`, `{DEPT}`, `{CAT}`, `{YEAR}`, `{SEQ:n}` tokens). Organisation name configurable.
- Optionally a second demo department (e.g. "Operations") disabled by default, to show multi-department behaviour.

---

## 7. Features (detailed)

### 7.1 Dashboard (landing page, scoped by department filter + user scope)
- KPI cards: total assets, in use, needs attention (faulty/in repair), end-of-life, **needs review** (data-quality flags), assets without tag, assets without serial.
- Charts: assets by branch (bar), by category (donut), by status (stacked bar by branch), age/warranty expiring in next 90 days (if data present), assets added over time.
- Panels: "Needs attention" (faulty/in repair with remarks), "Recently changed", "Active reconciliation progress by branch".
- Everything clickable → opens the Assets list pre-filtered.

### 7.2 Assets list (the main screen)
- Server-side pagination, sorting, and filtering (URL-synced query params so views are shareable/bookmarkable).
- Global search across tag, serial, brand, model, assigned-to, remarks, and searchable custom fields (case-insensitive, trigram/ILIKE; consider `pg_trgm` index).
- Filters: department, branch, sub-location, category, status, brand, assigned-to, condition, needs-review, has/hasn't tag/serial, date ranges, plus **any custom field** (dynamic filter UI by type).
- **Column chooser** (core columns + custom fields with `showInList`), saved **Views** per user (e.g. "Faulty laptops at Barekese").
- Row actions: view, edit, duplicate, change status, transfer, assign, print label, delete (soft).
- **Bulk actions** (multi-select): change status, transfer to branch/location, assign, set category, add remark, export selection, soft-delete, print labels.
- Dense/compact toggle; sticky header; responsive card layout on mobile.
- Empty states with guidance; skeleton loaders; optimistic updates where safe.

### 7.3 Add / edit asset
- Single clean form, grouped: *Identification* (category, tag, serial, brand, model) → *Placement* (branch, sub-location, assigned to) → *Status & condition* → *Purchase/Warranty* (collapsible) → *Custom fields* (rendered dynamically for the chosen category) → *Remarks*.
- **Smart helpers:** brand/model autocomplete from existing data (typeahead with "create new"), auto-suggest next tag using the configured template and branch/category, "Save & add another" (retains branch/location/category for fast batch entry), duplicate check on tag and serial as you type (show the conflicting asset with link; allow override with reason).
- Treat `*`, `N/A`, `NA`, `-`, `none` as **empty** (never store as a literal value).
- **Scan to fill:** button opens camera to scan barcode/QR for serial or tag; manual entry always available.
- Unsaved-changes warning. Validation messages in plain English.

### 7.4 Asset detail page
- Header with category icon, tag, status badge, branch; tabs: **Details**, **History** (timeline from AssetEvent), **Attachments** (optional/Blob), **Reconciliation history**.
- Quick actions: Change status (with required note for Faulty/Disposed/Lost/Retired), Transfer, Reassign, Print label, Mark as verified today.
- Show "other assets with same assignee" and "other assets with same serial/tag" (duplicates) panels.

### 7.5 Reconciliation workflow (key differentiator)
This replaces the "one Excel sheet per branch" process.
1. Admin creates an **Exercise** (name, department, dates, branches in scope). The system generates one **Branch Sheet** per branch pre-loaded with the assets *expected* at that branch.
2. Branch officer opens their sheet on a phone/laptop and, for each expected asset, taps **Found ✔ / Found – details differ ✎ / Missing ✖**; can **scan** a tag/serial to jump to or confirm an item; can **add unlisted assets found** (NEW_UNLISTED) via the normal add form.
3. When complete, officer **Submits**; Department Admin **Approves** (or returns with comments).
4. On approval, the app **applies the changes** (status, location, assignee, new assets) to the master register, writing AssetEvents/AuditLog, with a diff preview before applying.
5. Reports: per-branch completion %, found/missing/new counts, discrepancy list, exportable to Excel/PDF in a layout resembling the original sheet (title, Branch Name, Inventory Date, Prepared By, legend, table) so existing paper/audit habits still work.
- Support starting a **blank sheet** for a branch with no pre-existing register (like our first exercise) — enter assets directly into the branch sheet.

### 7.6 Import (Excel/CSV) — must handle our real messy data
- Wizard: **Upload → Choose sheet(s) → Map columns → Normalise → Preview & validate → Import → Result report**.
- Parse in the browser; send in chunks; show progress.
- **Auto-detect the header row** (our file has title/legend rows above the headers) and **auto-map** columns by fuzzy name (`Asset Tag/Label`→assetTag, `User Assigned`→assignedTo, etc.). Allow mapping to custom fields. Save mapping templates.
- Read **Branch Name / Inventory Date / Prepared By** from the header block when present, or let the user pick the branch/department for the whole file, or map a column to branch (as in the consolidated file where "Location" = branch).
- **Normalisation step:** trim, collapse whitespace, case-fold for matching (display in Title Case / keep brand uppercase option), convert `*`/`N/A`/blank to null, map asset types and statuses through the alias map, and show a **"Resolve unknown values"** screen (e.g. map `INACTIVE` → existing status or create it; map unknown type → existing category or create).
- Skip fully blank rows. Report row numbers for any rejected row with reason.
- **Duplicate handling options:** skip, update existing (match by serial, then tag), or import anyway **and flag as Needs Review**. Default: import and flag. Show duplicates found in-file and against DB before committing.
- Flag reasons stored on the asset: `DUPLICATE_SERIAL`, `DUPLICATE_TAG`, `MISSING_TAG`, `MISSING_SERIAL`, `PLACEHOLDER_VALUE`, `UNKNOWN_STATUS_MAPPED`, etc.
- Dry-run mode (validate only), and an **undo import** (soft-delete all assets created by an ImportJob).
- **Test requirement:** importing `docs/sample/ICT_Asset_Inventory_Sheet_Nwabiagya.xlsx` must succeed with ~179 non-empty rows imported, blank rows skipped, duplicates flagged, and a clear summary. Write an automated test for this.

### 7.7 Export & reports
- Export current filtered view (or selection) to **Excel (.xlsx)**, **CSV**, and **PDF**; include custom fields as columns. Excel export styled neatly (header row, freeze panes, column widths, status colours).
- **Original-format branch sheet export** (matches the legacy template).
- Prebuilt reports: Register by branch, Faulty/needs-attention list, Assets by assignee, Missing/unaccounted assets, Warranty expiring, Data-quality (needs-review), Assets without tag/serial, Reconciliation summary.
- Report pages are printable (clean print CSS).
- **Print labels:** generate a PDF label sheet with QR code (encodes a short URL `/a/{assetId or tag}`) + human-readable tag, branch, category, for selected assets; configurable label size.

### 7.8 Admin / Settings (all in-app, no code changes)
- **Departments:** add/edit/deactivate; on creation, optionally clone categories/statuses/fields from another department.
- **Branches & sub-locations:** CRUD, codes, order, active flag.
- **Categories:** CRUD, code, icon, parent, per department.
- **Statuses:** CRUD, colour, kind, order, default.
- **Custom fields manager:** drag-to-reorder, create/edit/archive, scope to department/category, live **form preview** while editing, option editor for selects, "show in list" toggle.
- **People directory** (optional): CRUD + import.
- **Users:** CRUD, roles, department/branch scope, reset password, deactivate.
- **Settings:** org name/logo, tag format template, placeholder values treated as empty, session timeout, enable/disable attachments.
- **Audit log viewer:** filter by user/entity/date/action, show before/after diff, export.
- Guard rails: can't delete a category/status/branch that is in use (offer **merge/reassign** instead); can't remove the last Super Admin.

### 7.9 Global UX
- Left sidebar nav (collapsible; bottom tab bar on mobile): Dashboard, Assets, Reconciliation, Reports, Import/Export, Admin.
- **Department switcher** in the top bar (persisted); "All my departments" option.
- Global quick-search (⌘/Ctrl+K command palette) for assets and pages.
- Light/dark mode. Accessible (WCAG AA contrast, keyboard navigable, labelled inputs, focus states).
- Toasts for success/errors; confirm dialogs for destructive actions; undo for soft deletes where feasible.
- Friendly error pages (404/403/500). Loading and empty states everywhere.
- Inline help: small "?" tooltips and a **Help / Guide page** explaining workflows (add asset, import, reconcile) in plain language.
- Number/date formatting for Ghana (en-GH, GHS currency, DD/MM/YYYY), timezone Africa/Accra.

---

## 8. Business rules & validation

- Asset requires: **department, category, branch, status**. Everything else optional (real-world data is incomplete) but surfaced in "Needs review"/data-quality reports.
- Normalise on save: trim; uppercase serials and tags for matching (store original display too if needed); empty-placeholder values → `null`.
- Duplicate policy: **soft warn + flag**, never hard block (unless admin enables "strict uniqueness" per department in settings).
- Status changes to *Faulty, In Repair, Disposed, Lost, Retired* require a note. Changing to an END_OF_LIFE kind records `retiredAt`.
- Transfers record from/to branch + location + date + reason in AssetEvent.
- Deleting is always soft; "Recycle bin" admin view to restore.
- Concurrency: use `updatedAt` optimistic check on edit to avoid silently overwriting another user's change.
- All writes inside transactions where multiple tables are touched (e.g. asset + event + audit log).

---

## 9. Architecture guidelines

- App Router, **Server Components by default**; Client Components only where interactivity needs it. Mutations via **Server Actions** (or route handlers for file/chunk endpoints), each wrapped with: auth check → authorize → Zod validate → transaction → audit → `revalidatePath/Tag`.
- Suggested structure:
  ```
  src/
    app/ (auth)/login, (app)/dashboard, assets, assets/[id], assets/new, reconciliation, reports, import, admin/*
    components/ (ui/, assets/, forms/, charts/, layout/)
    lib/ (db.ts, auth.ts, authorize.ts, audit.ts, tag-generator.ts, normalise.ts, dynamic-schema.ts, export/, import/)
    server/ (actions/, queries/, services/)
    schemas/ (zod)
  prisma/ schema.prisma, migrations/, seed.ts
  docs/ PROJECT_BRIEF.md, DECISIONS.md, USER_GUIDE.md, DEPLOYMENT.md, sample/
  ```
- Keep business logic in `server/services/*` (pure, testable), thin actions/components.
- Use `select`/`include` deliberately; index for common filters; use cursor or offset pagination with a total count query that doesn't time out.
- Add `middleware.ts` to protect `(app)` routes. Add security headers; CSRF is handled by Server Actions/Auth.js; sanitise any rendered user text; never render raw HTML from data.
- Environment validation at boot (e.g. `@t3-oss/env-nextjs` or a Zod env file).
- Logging: structured server logs for errors; no secrets/PII in logs.
- Rate limiting for login and import endpoints (simple DB- or in-memory-token approach acceptable on free tier; document limits).

---

## 10. Security checklist
Hashed passwords (argon2/bcrypt), password policy (min 10 chars), forced change on first login, login throttling/lockout, session expiry, role checks on **every** server mutation and query, department/branch scoping enforced in queries (not just UI), audit logging of auth events & admin changes, file-type/size validation on uploads, no secrets in client bundle, `.env.example` only, dependency audit in CI.

---

## 11. Testing & quality
- **Unit tests (Vitest):** normalisation (`*`, `N/A`, case, whitespace), alias mapping, tag generator, dynamic Zod schema builder, duplicate detection, authorization matrix, import row parsing.
- **Integration test:** run the importer against `docs/sample/ICT_Asset_Inventory_Sheet_Nwabiagya.xlsx` and assert counts (≈188 rows detected, 9 blank skipped, duplicates flagged, categories/statuses mapped).
- **E2E (Playwright) smoke:** login → add asset → add custom field → see it on the form → import sample → run a reconciliation to approval → export.
- GitHub Actions workflow: install, lint, typecheck, test, build.

---

## 12. Documentation to produce
- `README.md` (setup, scripts, env vars), `docs/DEPLOYMENT.md` (step-by-step Vercel + Vercel Postgres/Neon setup: create project, add Storage → Postgres, copy `DATABASE_URL`/`DIRECT_URL`, set `AUTH_SECRET`, `AUTH_URL`, seed admin env vars, build command `prisma migrate deploy && next build`, run seed once), `docs/USER_GUIDE.md` (plain-language, with the 5 most common tasks), `docs/DECISIONS.md` (assumptions & open questions, e.g. branch codes to confirm).

---

## 13. Out of scope for v1 (but don't block them architecturally)
SSO (Entra ID/Google), email notifications, offline-first PWA sync, depreciation accounting, procurement/purchase orders, maintenance tickets, REST/GraphQL public API, multi-tenant (multiple organisations). Leave clean seams (e.g. services layer, Auth.js providers) so these can be added later.

---

## 14. Delivery phases (stop and summarise after each)

**Phase 1 — Foundation:** project scaffold, Tailwind/shadcn, Prisma schema + migrations + seed, Auth.js login, RBAC helper, layout/navigation, department switcher, audit log plumbing, `.env.example`, CI.

**Phase 2 — Core register:** Branches/Locations/Categories/Statuses admin; Assets list (server-side table, search, filters, views, column chooser); Add/Edit/Detail pages with history timeline; soft delete + recycle bin; duplicate warnings; bulk actions.

**Phase 3 — Flexibility:** Custom field manager + dynamic form/filter/table/export rendering; multi-department support (clone config); users & roles admin; settings (tag template, placeholders).

**Phase 4 — Import/Export:** Import wizard with header detection, mapping, normalisation, duplicate handling, flags, undo; Excel/CSV/PDF export; legacy-format branch-sheet export; label printing with QR; scanning in forms.

**Phase 5 — Reconciliation:** Exercises, branch sheets, mobile-friendly verification UI, submit/approve flow, apply-changes with diff, reports.

**Phase 6 — Insights & polish:** Dashboard, prebuilt reports, data-quality centre ("Needs review" queue with one-click fixes), command palette, help page, accessibility pass, performance pass (indexes, query review), e2e tests, docs, final deployment walkthrough.

---

## 15. Definition of done (acceptance criteria)
- [ ] A non-technical branch officer can add an asset on a phone in < 30 seconds.
- [ ] A Super Admin can, **without code changes**, add a new department, new branch, new category, new status, and a new custom field (e.g. "Hostname") and immediately use it in forms, filters, table columns, import mapping and Excel export.
- [ ] Importing the provided Excel completes successfully, skipping blank rows, converting `*`/`N/A` to empty, normalising types/statuses, and flagging duplicates in a "Needs review" queue.
- [ ] A full reconciliation (create exercise → branch sheet → verify → submit → approve → changes applied) works and its report exports in the legacy-style sheet layout.
- [ ] Every create/update/delete/status change/transfer appears in the asset history and audit log with user and timestamp.
- [ ] Permissions are enforced server-side; a Viewer cannot mutate, and a user scoped to one department/branch cannot see or change others' data (verified by tests).
- [ ] App builds and runs on **Vercel free tier** with Vercel Postgres; no feature relies on local disk; long operations are chunked and show progress.
- [ ] Lint, typecheck, unit, integration and e2e tests pass in CI.
- [ ] Docs (README, DEPLOYMENT, USER_GUIDE, DECISIONS) are complete and accurate.
