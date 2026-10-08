# Decisions & open questions

Assumptions made during implementation. Confirm or correct anything marked **OPEN**.

## Phase 1

| ID | Decision | Rationale |
|---|---|---|
| D1 | Password hashing with **bcryptjs** (not argon2) | Portable on Vercel serverless; no native binary issues. |
| D2 | Auth.js **JWT sessions** (no Prisma Auth adapter) | Credentials provider pairs cleanly with JWT; middleware can check session without DB. |
| D3 | Full Prisma schema shipped in Phase 1; **SavedView** deferred to Phase 2 | Avoid early empty feature tables; schema still covers assets/recon/import. |
| D4 | Tech branch code = **TJ** | Provisional from sample tags; **OPEN — please confirm**. |
| D5 | Head Office = **HO**, Data Center = **DC** | Sensible defaults matching tag conventions; editable in Admin later. |
| D6 | Custom field keys scoped per category in seed (`hostname__lt`, etc.) | Same label can exist on Laptop and System Unit without unique-key collisions. |
| D7 | Super Admin seeded with `mustChangePassword: true` | Forces password change on first login. |
| D8 | Operations department seeded `isActive: false` | Demonstrates multi-department without cluttering the switcher. |
| D9 | Department switcher stored in cookie `assettrack_department` | Readable by Server Components for scoped queries. |
| D10 | Prisma 7 + `@prisma/adapter-pg` | Matches current Neon/Vercel Postgres guidance. |
| D11 | Disabled Next.js `cacheComponents` for Phase 1 | Conflicts with authenticated layouts / cookies; revisit later. |
| D12 | Keep `middleware.ts` for now (Next 16 warns about `proxy`) | Auth.js JWT gate works; migrate to `proxy.ts` when Auth.js docs catch up. |

## Phase 2

| ID | Decision | Rationale |
|---|---|---|
| D13 | Phase 2 asset forms omit custom-field rendering (`customFields: {}`) | Dynamic fields belong to Phase 3; avoids half-built DynamicField. |
| D14 | Duplicate policy = soft warn + acknowledge + flag `needsReview` | Matches brief §8; no strict-uniqueness settings UI yet. |
| D15 | Delete of in-use branch/category/status blocked with a clear error | Merge/reassign UI deferred; prevents orphaning assets. |
| D16 | `SavedView` stores filter/column/sort JSON mirroring URL params | Shareable list state without a second query language. |
| D17 | Bulk mutation chunk size = **200** | Vercel Hobby serverless timeout budget. |
| D18 | Status note required for Faulty, In Repair, Disposed, Lost, Retired | Matches brief §8; checked by status name. |
| D19 | Pin `@tanstack/react-table` to **v8** | v9 renames core APIs; v8 matches brief examples and is stable. |

## Phase 3

| ID | Decision | Rationale |
|---|---|---|
| D20 | Phase 3 export = **CSV** of current filtered view/selection (incl. custom fields) | Proves dynamic export rendering; styled Excel/PDF/labels stay Phase 4. |
| D21 | Field reorder via **@dnd-kit** | Standard accessible drag-and-drop with shadcn tables. |
| D22 | Placeholders loaded from `Setting.placeholders` with hardcoded fallback | Admins can edit empty-tokens without deploy; tests keep default set. |
| D23 | Department clone copies **categories, statuses, FieldDefinitions** only | Config reuse without copying assets/users. |
| D24 | Custom column ids use prefix `cf:` + field `key` | Avoid collisions with core column ids in list/saved views. |
| D25 | Department CRUD/clone is **Super Admin only** | Hard org config; Dept Admins manage within their dept. |

## Phase 4

| ID | Decision | Rationale |
|---|---|---|
| D26 | Parse Excel with **xlsx (SheetJS)** in the browser; styled Excel export with **exceljs**; CSV via **papaparse**; PDF/labels with **jspdf + qrcode**; camera scan with **html5-qrcode** | Matches brief stack choices; parse stays client-side for the 4.5 MB body limit. |
| D27 | Import chunks = **200** rows; dry-run validates only; commit creates `ImportJob` then processes chunks | Same timeout budget as bulk mutations (D17). |
| D28 | Undo = soft-delete assets with `importJobId`; default duplicate policy = **import and flag** (`needsReview`) | Enables undo without hard deletes; matches brief default. |
| D29 | Mapping templates in `Setting.import_mappings`; status aliases in `Setting.status_aliases` | No new tables; editable later from Admin if needed. |
| D30 | QR labels encode `/a/{assetId}`; sample file path uses a **space** (`ICT_Asset_Inventory_Sheet Nwabiagya.xlsx`) | Short public redirect under auth; tests use the real on-disk filename. |
| D31 | Import rate limit = **30 chunk requests / user / minute** (in-memory) | Cheap Hobby-tier guard; resets on cold start. |

## Open questions

1. Confirm **Tech** branch code (`TJ`?).
2. Confirm organisation display name (seeded as “Nuta Community Bank”).
3. Confirm default tag template `NRB/{BRANCH}/EQ/{SEQ:4}` vs including department/category tokens.
