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

## Open questions

1. Confirm **Tech** branch code (`TJ`?).
2. Confirm organisation display name (seeded as “Nuta Community Bank”).
3. Confirm default tag template `NRB/{BRANCH}/EQ/{SEQ:4}` vs including department/category tokens.
