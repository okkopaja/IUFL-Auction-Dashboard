***

# 📄 Product Requirements Document

## UCL Fantasy Auction Dashboard

**Version:** 1.0
**Date:** March 23, 2026
**Prepared For:** AI IDE Agent (e.g., Cursor / Windsurf)
**Status:** Ready for Implementation

***

## 1. Project Overview

Build a **UCL (UEFA Champions League) themed fantasy football auction web application** where a group of users (representing different football clubs) can participate in a live player bidding/auction session. The app has three core views: a **Dashboard**, an **Auction Page**, and a **Team Detail Page**.

The experience should feel like a premium football game UI — think FIFA Ultimate Team meets a sleek modern web app. It should be **not overly gamey** but carry **sports energy**: dark backgrounds, bold typography, smooth transitions, and smart use of club identity (colors, logos). It should NOT look like a B2B SaaS product (no cold purple gradients, no generic dashboard cards).

***

## 2. Goals \& Success Criteria

| Goal | Success Criteria |
| :-- | :-- |
| Visual excellence | Resembles a premium sports app, not a generic dashboard |
| Functional auction | Bid increment/decrement, sell to team, transaction log all work correctly |
| Real-time feel | State updates immediately across components; optimistic UI |
| Brand authenticity | All 16 UCL team logos load via Brandfetch CDN |
| Lottie animations | Meaningful animations on sell events, page transitions, empty states |
| DB persistence | All auction state persists in PostgreSQL via Prisma |


***

## 3. Tech Stack

| Layer | Technology |
| :-- | :-- |
| Frontend Framework | Next.js 14+ (App Router) |
| UI Components | ShadCN UI + Tailwind CSS v3 |
| Backend | Node.js + Express.js (separate API server) |
| ORM | Prisma ORM |
| Database | PostgreSQL |
| Animations | `lottie-react` (lazy-loaded via Next.js dynamic import) |
| Logo Assets | Brandfetch Logo API CDN (`cdn.brandfetch.io`) |
| Icons | Lucide React |
| State Management | Zustand (client) + React Query / SWR (server state) |
| Form Validation | Zod + React Hook Form |
| HTTP Client | Axios |
| TypeScript | Yes — strict mode throughout |


***

## 4. The 16 UCL Teams

These are the teams to be seeded into the database and displayed on the dashboard. Use the Brandfetch Logo API CDN with these domains for logo rendering.


| Team Name | Brandfetch Domain | Short Code |
| :-- | :-- | :-- |
| Arsenal FC | `arsenal.com` | `ARS` |
| FC Inter Milan | `inter.it` | `INT` |
| S.L. Benfica | `slbenfica.pt` | `BEN` |
| Chelsea FC | `chelseafc.com` | `CHE` |
| Manchester City | `mancity.com` | `MCI` |
| FC Barcelona | `fcbarcelona.com` | `BAR` |
| Paris Saint-Germain | `psg.fr` | `PSG` |
| Newcastle United | `nufc.co.uk` | `NEW` |
| Atletico de Madrid | `atleticodemadrid.com` | `ATL` |
| Juventus FC | `juventus.com` | `JUV` |
| Liverpool FC | `liverpoolfc.com` | `LIV` |
| Real Madrid | `realmadrid.com` | `RMA` |
| Borussia Dortmund | `bvb.de` | `BVB` |
| Sporting CP | `sporting.pt` | `SCP` |
| AC Milan | `acmilan.com` | `ACM` |
| FC Bayern München | `fcbayern.com` | `BAY` |

### Brandfetch Logo CDN URL Pattern

```
https://cdn.brandfetch.io/{domain}/w96/h96/icon.png?c={BRANDFETCH_CLIENT_ID}
```

For Retina/HiDPI displays (renders at 48×48):

```
https://cdn.brandfetch.io/{domain}/w96/h96/icon.png?c={BRANDFETCH_CLIENT_ID}
```

Use `fallback=lettermark` for any domain that fails to resolve. Logos must be fetched at build time or on first render and cached. Add `BRANDFETCH_CLIENT_ID` to `.env`.

***

## 5. Environment Variables

```env
# .env (project root)
DATABASE_URL="postgresql://user:password@localhost:5432/ucl_auction"
BRANDFETCH_CLIENT_ID=your_client_id_here
BRANDFETCH_API_KEY=your_api_key_here
NEXT_PUBLIC_BRANDFETCH_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_API_URL=http://localhost:4000/api
PORT=4000
```


***

## 6. Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model AuctionSession {
  id          String   @id @default(cuid())
  name        String
  isActive    Boolean  @default(true)
  totalPoints Int      @default(1000)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  teams       Team[]
  players     Player[]
  transactions Transaction[]
}

model Team {
  id            String   @id @default(cuid())
  name          String
  shortCode     String   @unique
  domain        String   // for Brandfetch CDN
  pointsTotal   Int      @default(1000)
  pointsSpent   Int      @default(0)
  sessionId     String
  session       AuctionSession @relation(fields: [sessionId], references: [id])
  players       Player[]
  transactions  Transaction[]
  createdAt     DateTime @default(now())

  @@index([sessionId])
}

model Player {
  id          String      @id @default(cuid())
  name        String
  position1   String      // e.g. "ST", "CM", "GK"
  position2   String?     // secondary position
  year        Int?        // birth year or season year
  imageUrl    String?
  basePrice   Int         @default(50)
  status      PlayerStatus @default(UNSOLD)
  teamId      String?
  team        Team?       @relation(fields: [teamId], references: [id])
  sessionId   String
  session     AuctionSession @relation(fields: [sessionId], references: [id])
  transactions Transaction[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([sessionId])
  @@index([status])
}

enum PlayerStatus {
  UNSOLD
  SOLD
  IN_AUCTION
}

model Transaction {
  id          String   @id @default(cuid())
  playerId    String
  player      Player   @relation(fields: [playerId], references: [id])
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  sessionId   String
  session     AuctionSession @relation(fields: [sessionId], references: [id])
  amount      Int
  createdAt   DateTime @default(now())

  @@index([sessionId])
}
```


***

## 7. Folder Structure

```
ucl-auction/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout, ThemeProvider
│   ├── page.tsx                  # Redirects to /dashboard
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard Page
│   ├── auction/
│   │   └── page.tsx              # Auction Page
│   └── team/
│       └── [teamId]/
│           └── page.tsx          # Team Detail Page
│
├── components/
│   ├── ui/                       # ShadCN components (auto-generated)
│   ├── dashboard/
│   │   ├── TeamGrid.tsx          # 4-column grid of team logo bubbles
│   │   ├── TeamBubble.tsx        # Individual clickable team circle
│   │   ├── PlayerStatusButtons.tsx # "Unsold players" / "Sold players" pills
│   │   └── GoToAuctionButton.tsx # CTA button
│   ├── auction/
│   │   ├── AuctionLayout.tsx     # Parent layout split
│   │   ├── TeamSidebar.tsx       # Left sidebar team list
│   │   ├── PlayerCard.tsx        # Player photo + details card
│   │   ├── BidControls.tsx       # - | bid value | + and SELL
│   │   ├── TeamSelectPopup.tsx   # Popup to select buying team
│   │   └── TransactionLog.tsx    # Previous sale footer bar
│   ├── team/
│   │   └── TeamDetailCard.tsx    # Team stats display
│   ├── shared/
│   │   ├── TeamLogo.tsx          # Brandfetch CDN <img> wrapper
│   │   ├── LottiePlayer.tsx      # Lazy-loaded Lottie wrapper
│   │   └── PageTransition.tsx    # Framer Motion page wrapper
│   └── providers/
│       └── QueryProvider.tsx     # React Query provider
│
├── server/                       # Express backend
│   ├── index.ts
│   ├── routes/
│   │   ├── teams.ts
│   │   ├── players.ts
│   │   ├── auction.ts
│   │   └── transactions.ts
│   ├── controllers/
│   │   ├── teamController.ts
│   │   ├── playerController.ts
│   │   └── auctionController.ts
│   ├── middleware/
│   │   └── errorHandler.ts
│   └── prisma.ts                 # Prisma client singleton
│
├── lib/
│   ├── api.ts                    # Axios instance
│   ├── brandfetch.ts             # Logo URL builder helper
│   └── utils.ts                  # cn() and other utils
│
├── store/
│   └── auctionStore.ts           # Zustand store
│
├── hooks/
│   ├── useTeams.ts
│   ├── usePlayers.ts
│   └── useAuction.ts
│
├── types/
│   └── index.ts                  # Shared TypeScript types
│
├── public/
│   └── animations/               # Lottie JSON files
│       ├── sold-confetti.json
│       ├── empty-state.json
│       └── loading-ball.json
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                   # Seeds teams + sample players
│
├── .env
├── tailwind.config.ts
└── components.json               # ShadCN config
```


***

## 8. Page Specifications

### 8.1 Dashboard Page (`/dashboard`)

**Layout:** Full-width page, dark sports-themed background.

**Visual Design:**

- Background: Deep navy/charcoal (`#0D0F14` or similar), subtle hexagonal or grass texture overlay at very low opacity to give it a stadium feel
- Top bar: App name/logo left-aligned, session name center, action buttons right
- Main content: 4-column responsive grid of team bubbles

**Team Grid:**

- Renders all 16 UCL teams in a 4×4 grid
- Each team is a **circular avatar bubble**, ~100px diameter on desktop
- Inside each bubble: Brandfetch CDN `icon` type logo, centered
- On hover: Scale up slightly (`scale-110`), glow ring in the team's accent color (use a predefined color map per team), smooth 200ms transition
- On click: Navigates to `/team/[teamId]`
- Below each circle: Team short name label in small, clean sans-serif

**Right Panel (as shown in wireframe):**

- Two pill-shaped status badges: **"Unsold Players"** and **"Sold Players"** — these are clickable filters/modals that show a list of players in that state
    - Style: outlined pill buttons, not filled — use ShadCN `Badge` or `Button` variant="outline"
    - Clicking opens a ShadCN `Sheet` (slide-in panel) from the right showing a scrollable list
- A prominent **"GO TO AUCTION"** CTA button — bold, bordered, energetic (use red or gold accent, NOT default blue)
    - On click: navigates to `/auction`
    - Add a subtle pulse animation on idle

**Lottie Usage:**

- If no session is active (empty state): show a football/ball bouncing Lottie animation with a "No Active Session" message
- Loading state for teams grid: skeleton loaders (ShadCN `Skeleton`)

***

### 8.2 Auction Page (`/auction`)

This is the core feature page. Layout is split into two columns.

**Left Sidebar (25% width):**

- Header: "Teams" label
- Scrollable list of all 16 teams
- Each team row shows:
    - Team logo (Brandfetch, small 32×32)
    - Team name
    - Points remaining (e.g., `850 pts`)
    - Players owned count (e.g., `3 players`)
- Highlight the team that currently holds the highest bid in real-time
- Background: slightly lighter than main bg, subtle border-right

**Main Area (75% width):**

- **Player Card (center-left):**
    - Large rounded card with subtle gradient border
    - Top half: Player photo (`imageUrl` if available, else a football silhouette placeholder)
    - Bottom half:
        - Player Name (bold, large, white)
        - Position 1 badge + Position 2 badge (ShadCN `Badge` components)
        - Year (small muted text)
    - Card should have a glass-morphism feel: semi-transparent background, backdrop blur
- **Bid Controls (center-right):**
    - Large minus `−` button (circular, outlined)
    - Current bid value display (large, bold, accent colored — gold or green)
    - Large plus `+` button (circular, outlined)
    - Bid increments: default `+10`, allow configurable step
    - Minimum bid = player's `basePrice`
    - Below bid controls: **"Bought By: [Team Name]"** — shows currently selected buying team (updates via popup)
    - **SELL** button: large, full-width, bold red/gold CTA
        - On click: validates a team is selected + bid ≥ base price, then calls `POST /api/auction/sell`
        - Triggers Lottie confetti/sold animation on success
        - Updates player status to `SOLD`, deducts points from team
    - Clicking "Bought by" area or a dedicated "Select Team" link opens a **Team Select Popup**
- **Team Select Popup:**
    - ShadCN `Popover` or `Dialog`
    - Grid of all teams with logo + name
    - Currently selected team highlighted
    - On select: updates `boughtByTeam` in local state
- **Transaction Log (bottom bar):**
    - Single-line ticker-style bar at the bottom of the main area
    - Shows last transaction: `"[Player Name] bought by [Team Name] for [Amount] pts"`
    - Subtle slide-in animation on new entry
    - Optional: clickable to expand full history `Sheet`
- **Navigation between players:**
    - "Next Player" button or auto-advance after sell
    - Players queue is managed by the backend (`IN_AUCTION` → `SOLD` → next `UNSOLD`)

***

### 8.3 Team Page (`/team/[teamId]`)

**Layout:** Clean centered card or full-width panel.

**Content:**

- Team logo (large, 120×120, Brandfetch `icon` type)
- Team name (H1, bold)
- Stats row:
    - Total Points (initial budget)
    - Points Spent
    - Points Remaining
    - Players Owned count
- **Players Roster Table** (ShadCN `Table`):
    - Columns: Player Name | Position | Amount Paid
    - Empty state: Lottie empty-state animation + "No players acquired yet"
- Back button → `/dashboard`

***

## 9. API Endpoints (Express Backend)

### Base URL: `http://localhost:4000/api`

#### Teams

| Method | Path | Description |
| :-- | :-- | :-- |
| `GET` | `/teams` | Get all teams with stats |
| `GET` | `/teams/:id` | Get single team with players roster |
| `PUT` | `/teams/:id/points` | Update team points (internal, post-sell) |

#### Players

| Method | Path | Description |
| :-- | :-- | :-- |
| `GET` | `/players` | Get all players, supports `?status=UNSOLD\|SOLD\|IN_AUCTION` |
| `GET` | `/players/current` | Get currently active (IN_AUCTION) player |
| `POST` | `/players` | Create new player (admin) |
| `PUT` | `/players/:id` | Update player details |
| `PATCH` | `/players/:id/status` | Change player status |

#### Auction

| Method | Path | Description |
| :-- | :-- | :-- |
| `POST` | `/auction/sell` | Sell current player to a team at a price |
| `POST` | `/auction/next` | Advance to next unsold player |
| `GET` | `/auction/log` | Get full transaction history |
| `GET` | `/auction/stats` | Get aggregate stats (sold count, remaining, total spent) |

#### Request/Response Contracts

**`POST /auction/sell`**

```json
// Request body
{
  "playerId": "clxxx123",
  "teamId": "clxxx456",
  "amount": 150,
  "sessionId": "clxxx789"
}

// Success Response 200
{
  "success": true,
  "transaction": {
    "id": "...",
    "player": { "id": "...", "name": "Erling Haaland" },
    "team": { "id": "...", "name": "Manchester City" },
    "amount": 150
  },
  "teamPointsRemaining": 850
}

// Error Response 400
{
  "success": false,
  "error": "Insufficient points for this team"
}
```


***

## 10. UI Design System

### Color Palette

```ts
// tailwind.config.ts extension
colors: {
  pitch: {
    950: '#080A0F',
    900: '#0D0F14',
    800: '#13161E',
    700: '#1C2030',
  },
  accent: {
    gold:  '#F5C842',
    red:   '#E8353A',
    green: '#2ECC71',
    blue:  '#3B82F6',
  }
}
```


### Typography

- Headings: `Inter` or `Geist` (Next.js default), weight 700–900
- Body: `Inter`, weight 400–500
- Stat numbers: monospaced or tabular numerals via `font-variant-numeric: tabular-nums`


### Component Tokens (ShadCN overrides in `globals.css`)

```css
:root {
  --background: 222 47% 6%;       /* pitch-950 */
  --foreground: 210 40% 98%;
  --card: 222 40% 10%;
  --card-foreground: 210 40% 98%;
  --border: 217 33% 18%;
  --ring: 43 90% 62%;             /* gold accent */
  --primary: 43 90% 62%;
  --primary-foreground: 222 47% 6%;
}
```


### Transitions \& Motion

- Use `transition-all duration-200 ease-in-out` as the base CSS transition for all interactive elements
- Use **Framer Motion** for page-level transitions (`AnimatePresence` + `motion.div`)
- Team bubble hover: `whileHover={{ scale: 1.1 }}` + CSS box-shadow glow
- Sell success: Full-screen or overlay Lottie confetti animation (auto-dismiss after 2.5s)

***

## 11. Brandfetch Integration (`lib/brandfetch.ts`)

```ts
const CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;

export function getTeamLogoUrl(
  domain: string,
  options?: {
    width?: number;
    height?: number;
    type?: 'icon' | 'logo' | 'symbol';
    theme?: 'dark' | 'light';
    format?: 'png' | 'svg' | 'webp';
  }
): string {
  const { width = 96, height = 96, type = 'icon', theme = 'light', format = 'png' } = options ?? {};
  return `https://cdn.brandfetch.io/${domain}/w${width}/h${height}/theme${theme}/${type}.${format}?c=${CLIENT_ID}&fallback=lettermark`;
}
```


### `components/shared/TeamLogo.tsx`

```tsx
import Image from 'next/image';
import { getTeamLogoUrl } from '@/lib/brandfetch';

interface TeamLogoProps {
  domain: string;
  teamName: string;
  size?: number;
  className?: string;
}

export function TeamLogo({ domain, teamName, size = 48, className }: TeamLogoProps) {
  return (
    <Image
      src={getTeamLogoUrl(domain, { width: size * 2, height: size * 2 })}
      alt={`${teamName} logo`}
      width={size}
      height={size}
      className={className}
      unoptimized // Brandfetch CDN already optimized
    />
  );
}
```


***

## 12. Lottie Integration (`components/shared/LottiePlayer.tsx`)

Use `lottie-react` with `next/dynamic` to prevent SSR issues:[^1]

```tsx
'use client';
import dynamic from 'next/dynamic';
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface LottiePlayerProps {
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  onComplete?: () => void;
}

export function LottiePlayer({ animationData, loop = true, autoplay = true, className, onComplete }: LottiePlayerProps) {
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      onComplete={onComplete}
    />
  );
}
```


### Lottie Animation Placements

| Trigger | Animation | Location | Duration |
| :-- | :-- | :-- | :-- |
| Player sold successfully | Confetti burst (gold/red) | Overlay center-screen | 2.5s, auto-dismiss |
| No active session | Football bouncing | Dashboard center | Loop |
| Empty roster on Team Page | Empty net / sad ball | Table empty state | Loop |
| Loading players | Ball rolling | Any loading state | Until resolved |

Source Lottie files from **LottieFiles.com** (free tier). Suggested search terms: `"confetti"`, `"football bounce"`, `"empty state"`.

***

## 13. Zustand Store (`store/auctionStore.ts`)

```ts
import { create } from 'zustand';

interface AuctionState {
  currentPlayer: Player | null;
  currentBid: number;
  selectedTeam: Team | null;
  lastTransaction: Transaction | null;
  setCurrentPlayer: (player: Player) => void;
  setBid: (amount: number) => void;
  incrementBid: (step?: number) => void;
  decrementBid: (step?: number) => void;
  setSelectedTeam: (team: Team) => void;
  setLastTransaction: (tx: Transaction) => void;
  resetBid: () => void;
}

export const useAuctionStore = create<AuctionState>((set, get) => ({
  currentPlayer: null,
  currentBid: 50,
  selectedTeam: null,
  lastTransaction: null,
  setCurrentPlayer: (player) => set({ currentPlayer: player, currentBid: player.basePrice }),
  setBid: (amount) => set({ currentBid: amount }),
  incrementBid: (step = 10) => set((s) => ({ currentBid: s.currentBid + step })),
  decrementBid: (step = 10) =>
    set((s) => ({
      currentBid: Math.max(s.currentPlayer?.basePrice ?? 0, s.currentBid - step),
    })),
  setSelectedTeam: (team) => set({ selectedTeam: team }),
  setLastTransaction: (tx) => set({ lastTransaction: tx }),
  resetBid: () => set((s) => ({ currentBid: s.currentPlayer?.basePrice ?? 50 })),
}));
```


***

## 14. Seed Data (`prisma/seed.ts`)

The seed file should:

1. Create one `AuctionSession` named `"UCL Fantasy Auction 2026"`
2. Create all 16 teams from the table in Section 4 with `pointsTotal: 1000`
3. Create at least 30 sample players with varied positions (`GK`, `CB`, `LB`, `RB`, `CM`, `CAM`, `LW`, `RW`, `ST`) and `status: UNSOLD`

Run with: `npx prisma db seed`

***

## 15. Implementation Notes for the AI IDE Agent

1. **Start with backend first**: Set up Express + Prisma, run `prisma migrate dev`, run seed
2. **Then scaffold Next.js pages**: Dashboard → Auction → Team pages in that order
3. **Install ShadCN components needed**: `npx shadcn-ui@latest add button badge card sheet dialog popover table skeleton`
4. **Brandfetch logos**: Never hardcode logo URLs — always use the `getTeamLogoUrl()` helper from `lib/brandfetch.ts`. Add `cdn.brandfetch.io` to `next.config.js` `images.domains`
5. **No purple gradients**: If tempted to use `from-purple-600`, stop. Use `from-pitch-900 to-pitch-800` or gold accents
6. **Responsive**: Sidebar collapses on mobile (< 768px) — use a drawer instead. Team grid goes 2×8 on mobile
7. **Error handling**: All API calls must have `try/catch`. Show ShadCN `Toast` on errors
8. **Type safety**: Generate Prisma types and use them throughout — no `any`
9. **next.config.js** must whitelist Brandfetch CDN:

```js
images: { domains: ['cdn.brandfetch.io'] }
```

10. **Team color map**: Define a `TEAM_COLORS` constant mapping each `shortCode` to a hex glow color for hover effects (e.g., Arsenal → `#EF0107`, Chelsea → `#034694`, etc.)

***

## 16. Out of Scope (v1.0)

- User authentication / multi-user roles
- WebSocket real-time sync across multiple browsers
- Mobile native app
- Player image upload UI (seed with placeholder URLs only)
- Admin panel for managing sessions

***

This PRD covers the complete specification needed for an AI IDE agent to implement the entire UCL Fantasy Auction Dashboard from scratch — including the database schema, Brandfetch logo integration, Lottie animation placements, ShadCN UI component usage, and the full Express + Prisma backend.[^2][^3][^4][^5][^1]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.yokesh.in/blog/lottie-animation-best-practices-for-web/

[^2]: SKILL-brandfetch-3.md

[^3]: https://ui.shadcn.com/docs/installation/next

[^4]: https://thenile.dev/docs/getting-started/languages/prisma

[^5]: https://www.prisma.io/docs/orm/overview/databases/postgresql

[^6]: image-2.jpg

[^7]: image-3.jpg

[^8]: https://insight.akarinti.tech/best-practices-for-using-shadcn-ui-in-next-js-2134108553ae

[^9]: https://lottiefiles.com/tutorials/dev/easy!-lottie-animation-actions-using-react-hooks-modern-way-to-add-animation-to-ios-react-nextjs-8jBeB4FoYuQ

[^10]: https://www.yokesh.in/blog/lottie-animation-best-practices-for-web

[^11]: https://www.youtube.com/watch?v=htgktwXYw6g

[^12]: https://blog.openreplay.com/integrate-shadcn-nextjs/

[^13]: https://github.com/prisma/prisma/issues/298

[^14]: https://www.youtube.com/watch?v=hhudoSMM0yU

[^15]: https://www.newline.co/courses/sleek-nextjs-applications-with-shadcn-ui/animations-in-shadcnui

[^16]: https://www.linkedin.com/posts/abhishekkumar878_backendengineering-prisma-postgresql-activity-7419976904637726720-kd56

[^17]: https://www.youtube.com/watch?v=WvpU44tyyis

[^18]: https://www.youtube.com/watch?v=2Eqg6Ea45cY

