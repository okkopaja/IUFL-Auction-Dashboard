# CSV Players Import (Admin Only) - Implementation Plan

This plan describes how to implement a CSV-based player import flow for the IUFL auction app. It is written to be executable by weaker models or junior engineers without needing to infer missing steps.

## Goal

Implement an admin-only CSV import feature that:
- Parses a CSV with specific headers.
- Lets admins preview and edit how data will be stored in Supabase.
- Allows removing players before saving.
- Replaces all existing players in the active session with the imported list.
- Clears transactions and resets team spend for that session.
- Ensures all app views fetch data from Supabase only.
- Removes all mock player data and any remaining mock dependencies.

## CSV Contract (Case Sensitive)

Exact header names (case sensitive):
- `NAME`
- `YEAR`
- `Whatsapp Number`
- `STREAM`
- `Primary Position`
- `Secondary Postion`
- `Attendance`

Notes:
- `Attendance` will be blank for now and should import as `null`.
- Keep `Whatsapp Number` as a string, not a number.
- `Secondary Postion` spelling must be supported exactly as written.

## Current Codebase Facts

Key files already in the repo:
- `prisma/schema.prisma` defines the Player model.
- `src/types/supabase.ts` is generated and reflects current DB schema.
- Admin UI shell is `src/components/admin/AdminDashboardView.tsx`.
- Player fetching uses `src/app/api/players/route.ts`.
- Auction next uses `src/app/api/auction/next/route.ts`.
- Team page still imports mock data from a non-existent file: `src/app/team/[teamId]/page.tsx`.

## Phase 1 - Schema Updates

### 1.1 Add new Player columns

Update `prisma/schema.prisma` to include:
- `whatsappNumber: String`
- `stream: String`
- `attendance: String?`
- `importOrder: Int`

Keep existing fields:
- `name`, `year`, `position1`, `position2`, `imageUrl`, `basePrice`, `status`, `teamId`, `sessionId`

Add indexes:
- index on `sessionId, importOrder`
- keep existing indexes on `status` and `sessionId`

### 1.2 Create SQL migration

Create a SQL migration in a new file (example name):
- `supabase/migrations/20260328_player_import.sql`

Migration should:
- Add new columns to `Player`.
- Backfill `importOrder` for existing rows with a stable deterministic order if needed.
- Ensure `importOrder` is non-null for new inserts.

### 1.3 Regenerate Supabase types

Update `src/types/supabase.ts` so the new columns appear in types.
- If you use a generator or manual update, ensure all new fields exist in Row, Insert, Update.

### 1.4 Update app types

Update `src/types/index.ts` Player interface to include:
- `whatsappNumber: string`
- `stream: string`
- `attendance?: string | null`
- `importOrder: number`

## Phase 2 - Shared Import Domain Code

Create a small feature module:
- `src/features/player-import/constants.ts`
- `src/features/player-import/types.ts`
- `src/features/player-import/normalize.ts`
- `src/features/player-import/validate.ts`
- `src/features/player-import/schema.ts`

Recommended data types:
- `RawCsvRow`: map of string -> string
- `ImportDraftRow`: normalized row + validation errors
- `ImportCommitPayload`: array of normalized rows ready for DB

Key rules:
- Trim all input.
- Blank strings -> `null` for nullable columns.
- `NAME`, `YEAR`, `Whatsapp Number`, `STREAM`, `Primary Position` are required.
- `Secondary Postion` optional.
- `Attendance` optional and may be blank.
- Detect duplicates by `(name + whatsappNumber)`.

Make constants for:
- `REQUIRED_HEADERS`
- `FIELD_MAPPING` (csv header -> DB field)

## Phase 3 - Admin Import API

Create a new admin-only route:
- `src/app/api/admin/player-import/replace/route.ts`

### 3.1 Auth

Use `requireAdmin()` at the top of the handler.

### 3.2 Server-side validation

Use Zod to validate the payload shape again on the server.
- Reject if any row still has validation errors.

### 3.3 Atomic replace logic

Do not do multiple independent calls that can partially fail.
Use a DB transaction and replace all data for the active session.

Steps in the DB transaction:
1. Resolve active `AuctionSession` (one active session expected).
2. Delete all `Transaction` rows for that session.
3. Reset `Team.pointsSpent` to `0` for that session.
4. Delete all `Player` rows for that session.
5. Insert imported players with:
   - `status = 'UNSOLD'`
   - `teamId = null`
   - `imageUrl = null`
   - `basePrice = 50`
   - `importOrder` from CSV row order

Prefer implementing this with a SQL function and calling via `supabase.rpc`.
If you cannot add a function, use Postgres SQL in one transaction server-side with the service role key.

Return response data:
- `importedCount`
- `removedPlayersCount`
- `removedTransactionsCount`
- `sessionId`

## Phase 4 - Admin UI: Import Control Center

Extend `src/components/admin/AdminDashboardView.tsx` by adding a new section for importing.

Create components (recommended):
- `src/components/admin/player-import/PlayerImportPanel.tsx`
- `src/components/admin/player-import/CsvUploadBox.tsx`
- `src/components/admin/player-import/ColumnMappingPanel.tsx`
- `src/components/admin/player-import/ImportPreviewTable.tsx`
- `src/components/admin/player-import/ImportSummaryCard.tsx`
- `src/components/admin/player-import/ImportConfirmDialog.tsx`

UI flow:
1. Upload CSV.
2. Parse locally with `papaparse`.
3. Auto-map headers if they match exactly.
4. If any header is missing, show manual mapping controls.
5. Normalize rows and build draft.
6. Show preview table in DB schema shape.
7. Allow inline edits and row removal.
8. Show validation errors per row.
9. Require confirmation before commit.
10. Commit draft to server.
11. Refresh all queries.

Preview table columns should be DB fields, not CSV headers:
- `name`, `year`, `whatsappNumber`, `stream`, `position1`, `position2`, `attendance`, `basePrice`, `status`, `importOrder`

## Phase 5 - Change Player Ordering

Currently players are ordered by name. Change to `importOrder` to preserve CSV order.

Modify:
- `src/app/api/players/route.ts`
- `src/app/api/auction/next/route.ts`

Update `.order('name')` to `.order('importOrder')`.

## Phase 6 - Remove Mock Data

There is an invalid mock-data import in:
- `src/app/team/[teamId]/page.tsx`

Fix this page to fetch team by real ID or slug from Supabase and remove any mock dependencies.

Also scan for any other mock references and delete them:
- use `rg -n "mock" src`

## Phase 7 - Tighten Admin Auth

The import endpoint and other destructive auction routes must be admin-only.

Ensure these routes use `requireAdmin()` instead of `requireAuth()`:
- `src/app/api/admin/player-import/replace/route.ts`
- `src/app/api/auction/next/route.ts`
- `src/app/api/auction/sell/route.ts`

## Phase 8 - Data Refresh

After successful import:
- Clear draft state.
- Invalidate React Query keys:
  - `teams`
  - `players`
  - `currentPlayer`
  - `auctionLog`
  - `auctionStats`

These keys are defined in `src/hooks/useAuction.ts`.

## Manual QA Checklist

1. Upload valid CSV with exact headers; preview renders correctly.
2. Upload CSV with one missing header; manual mapping fixes it.
3. Remove a player row; that player is not saved.
4. Blank Attendance imports as `null`.
5. Import twice; second import fully replaces first (players + transactions).
6. Auction and dashboard show only imported players.
7. Team pages still load without mock data.
8. Non-admin cannot hit the import endpoint.

## Definition of Done

- Admin can upload, preview, edit, and import CSV data.
- Import replaces all players in the active session.
- Transactions are cleared and team spend reset.
- No mock data remains in runtime paths.
- Player order matches CSV order.
- All changes use Supabase as source of truth.

