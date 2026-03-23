# UCL Fantasy Auction Dashboard Implementation Plan

## Document Purpose

This plan translates [`docs/setup-PRD.md`](E:\iufl-auction-dashboard\docs\setup-PRD.md) into an implementation sequence that fits the current repository.

Use this document as the source of truth for execution. A weaker model should follow the order here, avoid improvising architecture, and only deviate when a blocking incompatibility is discovered in the repo.

## Current Repo Baseline

- The repo is still the default scaffold.
- Frontend stack already present: Next.js `16.2.1`, React `19.2.4`, TypeScript strict mode, Tailwind CSS `4`, Biome.
- Current app lives in `src/app`, not root `app`.
- No Prisma, Express server, ShadCN, Zustand, React Query, or domain code exists yet.
- `next.config.ts` is nearly empty.
- `docs/implementation plans/` already exists and is the correct destination for planning docs.

## Non-Negotiable Decisions

These decisions remove ambiguity. Follow them exactly unless the user explicitly changes them.

1. Keep Next.js `16` and React `19`. Do not downgrade to match older examples in the PRD.
2. Keep Tailwind CSS `4`. Do not downgrade to Tailwind `3`.
3. Keep the App Router under `src/app`.
4. Build the persistent backend as a separate Express server under `server/`, because that is required by the PRD.
5. Do not duplicate the core auction REST API in Next route handlers. Next route handlers are unnecessary here and would create two backends.
6. Use Prisma + PostgreSQL for all persisted auction state.
7. Use TanStack React Query for server state. Do not use SWR.
8. Use Zustand only for ephemeral UI state on the auction screen, not as the source of truth for persisted data.
9. Use `next/image` for all logos and player images. Configure Brandfetch via `remotePatterns` in `next.config.ts`.
10. Translate PRD color tokens into Tailwind 4 theme variables in `src/app/globals.css` instead of relying on a Tailwind v3-style `tailwind.config.ts`.
11. Use the current `shadcn` CLI, not the deprecated `shadcn-ui` package name shown in the PRD.
12. All page-level UI must match the sports-first direction in the PRD: dark pitch palette, gold/red energy accents, crisp typography, restrained glass effects, no generic SaaS purple gradient look.

## Skills Applied

- `next-best-practices`: used to keep the plan aligned with App Router, Next 16 async conventions, image handling, and route boundaries.
- `ui-ux-pro-max`: used to lock the visual direction around premium sports UI, clear interaction hierarchy, accessibility, and meaningful motion.
- `responsive-design`: used to define mobile-first behavior and prevent the desktop auction layout from collapsing poorly on smaller screens.

## Target Architecture

```text
src/
  app/
    layout.tsx
    page.tsx                       -> redirect to /dashboard
    dashboard/
      page.tsx
      loading.tsx
      error.tsx
    auction/
      page.tsx
      loading.tsx
      error.tsx
    team/
      [teamId]/
        page.tsx
        loading.tsx
        error.tsx
    not-found.tsx
    global-error.tsx
    globals.css
  components/
    auction/
    dashboard/
    providers/
    shared/
    team/
    ui/
  hooks/
  lib/
  store/
  types/
server/
  controllers/
  middleware/
  routes/
  services/
  prisma.ts
  index.ts
prisma/
  schema.prisma
  seed.ts
public/
  animations/
```

### Architecture Notes

- `src/app/*/page.tsx` files should stay thin. Heavy interactive UI belongs in client components under `src/components/*`.
- Use React Query hooks in `src/hooks`.
- Keep all shared request/response types in `src/types/index.ts`.
- Keep backend business rules in `server/services/*` instead of bloating controllers.
- Prisma remains the only DB access layer.

## Design System Decisions

These are locked so implementation stays visually consistent.

- Background palette:
  - `pitch-950: #080A0F`
  - `pitch-900: #0D0F14`
  - `pitch-800: #13161E`
  - `pitch-700: #1C2030`
- Accent palette:
  - `accent-gold: #F5C842`
  - `accent-red: #E8353A`
  - `accent-green: #2ECC71`
  - `accent-blue: #3B82F6`
- Typography:
  - Keep `Geist` for headings and body because it is already integrated cleanly with Next.
  - Use `Geist Mono` or tabular numerals for point values and bids.
- Motion:
  - Base interaction duration `150ms` to `250ms`.
  - Use transform and opacity, not layout-shifting animations.
  - Respect reduced-motion preferences.
- Visual language:
  - Dark stadium-like surfaces with subtle texture or gradient depth.
  - Strong but controlled glow effects tied to club colors.
  - One primary CTA per screen.
  - Hover is enhancement only; all important interactions must work clearly on touch devices.

## Critical Product Rules

1. The app operates around one active `AuctionSession`.
2. Teams start with `pointsTotal = 1000`.
3. `pointsRemaining` is derived as `pointsTotal - pointsSpent`; do not store it separately.
4. All 16 PRD teams must be seeded exactly once with correct `name`, `shortCode`, and Brandfetch `domain`.
5. Seed at least 30 players with realistic football positions.
6. Only one player may be `IN_AUCTION` at a time.
7. `SELL` must fail if:
   - no team is selected
   - bid is below `basePrice`
   - player is not currently in auction
   - team lacks enough remaining points
8. Selling a player must be atomic via `prisma.$transaction`.
9. After a successful sale, the backend must advance the queue to the next `UNSOLD` player or return `null` if none remain.
10. The frontend must never hardcode Brandfetch URLs. Always use the shared helper.

## Phase Plan

Proceed in order. Do not start UI-heavy phases until the backend contract is stable.

### Phase 0: Project Setup and Dependency Alignment

#### Goal

Prepare the scaffold so implementation can proceed without later rewrites.

#### Tasks

1. Add runtime dependencies:
   - `express`
   - `cors`
   - `dotenv`
   - `prisma`
   - `@prisma/client`
   - `axios`
   - `zod`
   - `zustand`
   - `@tanstack/react-query`
   - `react-hook-form`
   - `@hookform/resolvers`
   - `lucide-react`
   - `framer-motion`
   - `lottie-react`
   - `clsx`
   - `tailwind-merge`
2. Add dev dependencies:
   - `tsx`
   - `concurrently`
   - `@types/express`
   - `@types/cors`
   - `@types/node` if version updates are needed
3. Initialize Prisma.
4. Initialize ShadCN with Tailwind 4-compatible setup.
5. Add or update scripts in `package.json`:
   - `dev:web`
   - `dev:api`
   - `dev`
   - `build:web`
   - `build:api` if needed
   - `lint`
   - `format`
   - `prisma:migrate`
   - `prisma:seed`
6. Create `.env.example` using the PRD variables.
7. Update `next.config.ts` to allow Brandfetch images via `remotePatterns`.
8. Replace the default app metadata in `src/app/layout.tsx`.
9. Replace the starter page in `src/app/page.tsx` with a redirect to `/dashboard`.

#### Exit Criteria

- `npm install` completes cleanly.
- Prisma CLI is available.
- ShadCN is initialized.
- `npm run dev` can boot both web and API processes once backend files exist.
- No default starter UI remains.

### Phase 1: Prisma Schema and Seed Data

#### Goal

Create the persistent data model exactly once and make it trustworthy.

#### Tasks

1. Create `prisma/schema.prisma` from the PRD models:
   - `AuctionSession`
   - `Team`
   - `Player`
   - `Transaction`
   - `PlayerStatus` enum
2. Keep the schema close to the PRD, but derive remaining points instead of storing it.
3. Create the first migration.
4. Add `prisma/seed.ts`.
5. Seed:
   - one active session named `UCL Fantasy Auction 2026`
   - all 16 UCL teams from the PRD
   - at least 30 players with varied positions and placeholder image URLs
6. Ensure seed behavior is idempotent enough for repeated local runs, or document that the DB should be reset before reseeding.

#### Seed Rules

- Use the exact 16 teams from the PRD.
- Include short codes and domains exactly.
- Base prices should vary enough to make the auction interesting.
- Set all seeded players to `UNSOLD`.
- Do not seed a sold transaction initially.
- Optionally promote the first player to `IN_AUCTION` at seed time. If not, the backend must promote the first player lazily.

#### Exit Criteria

- `npx prisma migrate dev` succeeds.
- `npx prisma db seed` succeeds.
- Prisma Studio shows one session, 16 teams, and 30+ players.

### Phase 2: Backend API Foundation

#### Goal

Build the Express API and lock the data contracts before frontend assembly.

#### Tasks

1. Create backend bootstrap:
   - `server/index.ts`
   - `server/prisma.ts`
   - `server/middleware/errorHandler.ts`
2. Add route modules:
   - `server/routes/teams.ts`
   - `server/routes/players.ts`
   - `server/routes/auction.ts`
   - `server/routes/transactions.ts`
3. Add controllers:
   - `server/controllers/teamController.ts`
   - `server/controllers/playerController.ts`
   - `server/controllers/auctionController.ts`
   - `server/controllers/transactionController.ts`
4. Add service modules for business logic:
   - `server/services/teamService.ts`
   - `server/services/playerService.ts`
   - `server/services/auctionService.ts`
5. Add shared validation schemas with Zod for request bodies and query params.
6. Add CORS support for the Next frontend origin.
7. Add health logging and explicit server start output.

#### API Contract Decisions

Implement the PRD endpoints with these clarifications:

- `GET /api/teams`
  - returns all teams for the active session
  - include derived `pointsRemaining`
  - include `playersOwnedCount`
- `GET /api/teams/:id`
  - returns team details plus roster rows
  - include amount paid for each player
- `PUT /api/teams/:id/points`
  - implement last, after core flows
  - treat as an internal correction endpoint, not a normal UI action
- `GET /api/players`
  - supports optional `status`
  - default sort should be stable and predictable
- `GET /api/players/current`
  - if no `IN_AUCTION` player exists and unsold players remain, promote the next unsold player and return it
- `POST /api/players`
  - backend-only helper, not required in UI
- `PUT /api/players/:id`
  - update editable player fields
- `PATCH /api/players/:id/status`
  - allow controlled status changes
- `POST /api/auction/sell`
  - the core mutation
  - must create a transaction, assign player to team, update team spend, mark player sold, and advance the queue atomically
- `POST /api/auction/next`
  - if a current player exists and was not sold, move them back to `UNSOLD`
  - promote the next unsold player to `IN_AUCTION`
- `GET /api/auction/log`
  - return newest-first transaction history
- `GET /api/auction/stats`
  - return sold count, unsold count, total spent, and total teams

#### Backend Business Rules

- `AuctionSession.isActive = true` determines the active session.
- Reject all team or player lookups that are outside the active session.
- Selling must use `prisma.$transaction`.
- Remaining points must be validated from current DB values inside the transaction.
- The current player cannot be sold twice.
- `highest bid` in the UI maps to the currently selected team and current bid because there is no multi-user live bidding in v1.

#### Exit Criteria

- Every endpoint responds with stable JSON.
- Error responses use consistent `{ success: false, error: string }` style.
- Core happy path works in Postman or `Invoke-RestMethod`.
- Selling a player updates all affected records correctly.

### Phase 3: Frontend Foundation and Shared Utilities

#### Goal

Create a reusable frontend base before page assembly.

#### Tasks

1. Create shared frontend folders:
   - `src/components`
   - `src/hooks`
   - `src/lib`
   - `src/store`
   - `src/types`
2. Add `src/lib/utils.ts` with `cn`.
3. Add `src/lib/api.ts` with an Axios instance using `NEXT_PUBLIC_API_URL`.
4. Add `src/lib/brandfetch.ts` using the PRD helper pattern.
5. Add `src/lib/constants.ts` for:
   - `TEAM_COLORS`
   - auction bid step default
   - route names
   - session display strings
6. Add `src/types/index.ts` for frontend-safe API types.
7. Add `src/components/providers/QueryProvider.tsx`.
8. Add app-level toaster provider.
9. Add shared presentation components:
   - `src/components/shared/TeamLogo.tsx`
   - `src/components/shared/LottiePlayer.tsx`
   - `src/components/shared/PageTransition.tsx`
10. Replace the current `globals.css` with Tailwind 4 theme tokens that match the PRD palette.
11. Add route-level `loading.tsx`, `error.tsx`, and root `global-error.tsx` / `not-found.tsx`.

#### Tailwind 4 Implementation Rule

Do not try to recreate the PRD's `tailwind.config.ts` literally. In this repo:

- define theme tokens in `src/app/globals.css`
- keep reusable semantic classes and CSS variables there
- use Tailwind utilities plus CSS variables in components

#### Image Rules

- Use `next/image` for logos and player images.
- Brandfetch URLs must come from `getTeamLogoUrl`.
- Configure `sizes` when using `fill`.
- Use `unoptimized` only if needed for Brandfetch behavior.

#### Exit Criteria

- Shared providers mount cleanly.
- Theme tokens are visible in the app.
- Team logo helper renders correctly.
- Errors and loading states have designated files instead of ad hoc inline fallbacks.

### Phase 4: Query Hooks and Auction Store

#### Goal

Define the frontend state contract once, before page features multiply.

#### Tasks

1. Build hooks:
   - `useTeams`
   - `useTeam`
   - `usePlayers`
   - `useCurrentPlayer`
   - `useAuctionLog`
   - `useAuctionStats`
   - `useSellPlayer`
   - `useNextPlayer`
2. Standardize React Query keys in one place.
3. Create `src/store/auctionStore.ts`.
4. Store only ephemeral auction UI state:
   - current bid
   - selected team
   - last transaction
   - selected bid step if configurable
   - popup open state if useful
5. Reset bid and selected team when the current player changes.
6. On successful sale:
   - update `lastTransaction`
   - reset local selection
   - invalidate relevant queries

#### Guardrails

- Do not mirror full team or player lists into Zustand.
- React Query owns server data.
- Zustand owns view-local interaction state.

#### Exit Criteria

- Hooks work against the live Express API.
- Store updates are predictable when player changes.
- No duplicated server truth exists in local state.

### Phase 5: Dashboard Page

#### Goal

Implement the `/dashboard` page exactly as the PRD describes.

#### Tasks

1. Create `src/app/dashboard/page.tsx`.
2. Create dashboard components:
   - `TeamGrid`
   - `TeamBubble`
   - `PlayerStatusButtons`
   - `GoToAuctionButton`
3. Render all 16 teams in a responsive grid:
   - mobile: 2 columns
   - tablet: 3 columns if it fits cleanly
   - desktop: 4 columns
4. Each team bubble must:
   - show logo
   - show short code or short label
   - scale and glow on hover/focus
   - navigate to `/team/[teamId]`
5. Add right-side actions:
   - unsold players sheet
   - sold players sheet
   - go-to-auction CTA
6. Add loading skeletons for grid and action area.
7. Add empty active-session state with Lottie.

#### UX Requirements

- Team bubbles must remain touch-friendly on mobile.
- Glow color must come from `TEAM_COLORS`.
- The CTA must feel primary without using generic blue.
- Sheets must be keyboard accessible.

#### Exit Criteria

- Dashboard looks like a sports interface, not starter-template UI.
- All seeded teams render.
- Sold and unsold sheets open and list correct players.

### Phase 6: Auction Page

#### Goal

Implement the core auction workflow cleanly and safely.

#### Tasks

1. Create `src/app/auction/page.tsx`.
2. Create auction components:
   - `AuctionLayout`
   - `TeamSidebar`
   - `PlayerCard`
   - `BidControls`
   - `TeamSelectPopup`
   - `TransactionLog`
3. Load:
   - current player
   - teams
   - recent transactions
   - aggregate stats if useful
4. Sidebar rows must show:
   - logo
   - team name
   - points remaining
   - players owned count
5. Main area must show:
   - player image or placeholder
   - position badges
   - year
   - current bid
   - team selection
   - sell button
   - next player control
6. Implement bid behavior:
   - initialize to `basePrice`
   - increment and decrement by default step `10`
   - never go below `basePrice`
7. Implement team selection via popover or dialog.
8. Implement sell flow:
   - validate selected team
   - validate current bid
   - call `POST /api/auction/sell`
   - show success animation
   - update log
   - refresh teams and current player
9. Implement next-player flow:
   - call `POST /api/auction/next`
   - reset local state
10. Add full-page or focused loading states.
11. Add error toasts for failed actions.

#### Mobile/Responsive Requirements

- The desktop two-column layout should collapse to stacked sections on mobile.
- Team sidebar becomes a drawer or sheet below `md`.
- Bottom transaction bar must not hide interactive controls.
- Use `min-h-dvh` instead of `100vh`.

#### Behavioral Details

- Disable sell button while mutation is pending.
- Clear `selectedTeam` when a new current player is returned.
- The highlighted team row in the sidebar should reflect the currently selected buyer.
- If the queue is exhausted, show a graceful end-of-auction state instead of a broken empty card.

#### Exit Criteria

- A full sell cycle works from UI to DB and back.
- Points decrement correctly.
- Transaction log updates correctly.
- Next player flow works even when no sale occurs.

### Phase 7: Team Detail Page

#### Goal

Implement the `/team/[teamId]` page with a clear roster view.

#### Tasks

1. Create `src/app/team/[teamId]/page.tsx`.
2. Because this repo uses Next 16, keep the route wrapper compatible with async params.
3. Build `TeamDetailCard`.
4. Show:
   - large logo
   - team name
   - total points
   - points spent
   - points remaining
   - players owned count
5. Add roster table using ShadCN table primitives.
6. Include player name, position, and amount paid.
7. Add empty roster state with Lottie.
8. Add a back action to `/dashboard`.

#### Exit Criteria

- Direct navigation to a team page works.
- Invalid team IDs resolve to a clean error or not-found state.
- Table and empty state both look intentional.

### Phase 8: Motion, Assets, and Finish Work

#### Goal

Add the presentation polish required by the PRD after functionality is stable.

#### Tasks

1. Add Lottie files under `public/animations/`:
   - `sold-confetti.json`
   - `empty-state.json`
   - `loading-ball.json`
2. Add page transition wrapper using Framer Motion.
3. Add subtle background gradients or texture overlays.
4. Add reduced-motion handling.
5. Refine hover, focus, pressed, and disabled states across all major controls.
6. Ensure remote logos and images do not cause layout shift.

#### Exit Criteria

- Motion reinforces state changes instead of distracting from them.
- Empty, loading, and success states all feel deliberate.
- No page looks like leftover scaffold UI.

### Phase 9: Verification and Hardening

#### Goal

Prove that the implementation meets the PRD.

#### Commands

- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npx prisma migrate dev`
- `npx prisma db seed`

#### Manual Backend Checks

- `GET /api/teams`
- `GET /api/teams/:id`
- `GET /api/players?status=UNSOLD`
- `GET /api/players/current`
- `POST /api/auction/sell`
- `POST /api/auction/next`
- `GET /api/auction/log`
- `GET /api/auction/stats`

#### Manual UI Checks

1. Dashboard loads all teams and logos.
2. Team bubble navigation works.
3. Sold and unsold sheets show correct lists.
4. Auction page loads a current player.
5. Bid cannot go below base price.
6. Sell fails cleanly without a team.
7. Sell succeeds with a valid team and amount.
8. Team budget updates immediately after sale.
9. Team page shows the purchased player and amount paid.
10. Empty states render without layout breakage.
11. Mobile layout remains usable on narrow screens.

#### Exit Criteria

- No TypeScript errors.
- No broken route transitions.
- No data integrity issues after repeated sell/next flows.
- PRD core success criteria are visibly met.

## Recommended File-by-File Delivery Order

This is the safest implementation sequence for a weaker model.

1. `package.json`
2. `.env.example`
3. `next.config.ts`
4. `prisma/schema.prisma`
5. `prisma/seed.ts`
6. `server/prisma.ts`
7. `server/index.ts`
8. `server/middleware/errorHandler.ts`
9. `server/services/*.ts`
10. `server/controllers/*.ts`
11. `server/routes/*.ts`
12. `src/lib/utils.ts`
13. `src/lib/api.ts`
14. `src/lib/brandfetch.ts`
15. `src/lib/constants.ts`
16. `src/types/index.ts`
17. `src/components/providers/QueryProvider.tsx`
18. `src/store/auctionStore.ts`
19. `src/hooks/*.ts`
20. `src/app/layout.tsx`
21. `src/app/page.tsx`
22. `src/app/globals.css`
23. `src/components/shared/*`
24. `src/components/dashboard/*`
25. `src/app/dashboard/*`
26. `src/components/auction/*`
27. `src/app/auction/*`
28. `src/components/team/*`
29. `src/app/team/[teamId]/*`
30. `public/animations/*`
31. final polish and verification

## Delegation Map

This plan is designed so the user can delegate the detail work safely.

### Work Packet A: Foundation

- Ownership:
  - `package.json`
  - `.env.example`
  - `next.config.ts`
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - `src/app/globals.css`
- Must finish before most other frontend tasks.

### Work Packet B: Data Layer

- Ownership:
  - `prisma/schema.prisma`
  - `prisma/seed.ts`
  - `server/prisma.ts`
- Must finish before API work.

### Work Packet C: API Server

- Ownership:
  - `server/index.ts`
  - `server/routes/*`
  - `server/controllers/*`
  - `server/services/*`
  - `server/middleware/errorHandler.ts`
- Depends on Work Packet B.

### Work Packet D: Shared Frontend Infrastructure

- Ownership:
  - `src/lib/*`
  - `src/types/index.ts`
  - `src/hooks/*`
  - `src/store/auctionStore.ts`
  - `src/components/providers/*`
  - `src/components/shared/*`
- Depends on Work Packet C endpoint stability.

### Work Packet E: Dashboard UI

- Ownership:
  - `src/components/dashboard/*`
  - `src/app/dashboard/*`
- Depends on Work Packet D.

### Work Packet F: Auction UI

- Ownership:
  - `src/components/auction/*`
  - `src/app/auction/*`
- Depends on Work Packet D.

### Work Packet G: Team Detail UI

- Ownership:
  - `src/components/team/*`
  - `src/app/team/[teamId]/*`
- Depends on Work Packet D.

### Work Packet H: Motion and Asset Polish

- Ownership:
  - `public/animations/*`
  - final animation and polish edits across existing UI files
- Should happen after E, F, and G are functionally complete.

## Common Failure Modes to Avoid

1. Do not create the REST API in `src/app/api`. The Express server is the API.
2. Do not downgrade Tailwind just to match the PRD examples.
3. Do not keep the starter homepage and add new pages beside it.
4. Do not use raw `<img>` tags for Brandfetch logos.
5. Do not keep duplicate copies of teams or players in Zustand.
6. Do not mutate `pointsTotal` during sales. Only `pointsSpent` changes.
7. Do not forget to reset `currentBid` when `currentPlayer` changes.
8. Do not leave multiple players in `IN_AUCTION`.
9. Do not hardcode team accent colors inside components; use `TEAM_COLORS`.
10. Do not rely on hover alone for state communication.
11. Do not let the bottom log or mobile drawer cover critical buttons.
12. Do not skip route-level loading and error states.

## Definition of Done

The project is done for v1 when all statements below are true:

- The seeded UCL session, teams, and players exist in PostgreSQL.
- The Express API fully supports the PRD auction workflow.
- `/dashboard`, `/auction`, and `/team/[teamId]` all work.
- Brandfetch logos render for all 16 teams.
- Sell and next-player flows persist correctly.
- The UI looks like a premium sports product rather than a generic dashboard.
- Loading, empty, success, and error states all exist.
- The app passes lint and build.

## Final Guidance for the Implementing Model

Implement in small, verifiable increments. After each phase, run the relevant command or manual check before moving on. If a choice is not explicitly defined, prefer the option that preserves the PRD behavior while matching the existing repo's Next 16 + Tailwind 4 reality.
