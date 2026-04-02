# IUFL Auction Dashboard

Next.js dashboard for running and managing the IUFL player auction.

## Tech Stack

- Next.js 16 (App Router)
- Supabase (runtime database access)
- Prisma (schema, migrations, and setup-time seeding)
- Clerk (authentication + admin checks)
- Brandfetch CDN (team logo rendering)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DIRECT_URL=
NEXT_PUBLIC_BRANDFETCH_CLIENT_ID=
PLAYER_IMAGES_BUCKET=player-images
ICON_IMAGES_BUCKET=icon-images

# Clerk (required by @clerk/nextjs)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Notes:

- `DIRECT_URL` must point to the direct Postgres connection used by Prisma migrations.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is only needed if you are not using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
- `PLAYER_IMAGES_BUCKET` defaults to `player-images` and is used by Player Import image ingestion.
- `ICON_IMAGES_BUCKET` defaults to `icon-images` and is used by Icons Import role image uploads.

3. Run database setup:

```bash
npm run prisma:migrate
npm run prisma:seed
```

The seed step creates or activates the auction session and upserts the canonical 16 auction teams.

4. Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Team Seeding and Logos

- Canonical teams are defined in `src/lib/auctionTeams.ts`.
- Team logos are generated with Brandfetch in `src/lib/brandfetch.ts` and rendered by `src/components/shared/TeamLogo.tsx`.
- Team provisioning happens via setup-time seeding with Prisma; there is no runtime bootstrap endpoint.

## Scripts

- `npm run dev` - start web app in development.
- `npm run build:web` - build web app.
- `npm run start` - run production build.
- `npm run lint` - run Biome checks.
- `npm run format` - format files with Biome.
- `npm run prisma:migrate` - run Prisma migrations.
- `npm run prisma:seed` - run Prisma seed script.
