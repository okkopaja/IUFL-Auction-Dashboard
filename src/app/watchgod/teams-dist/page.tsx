import type { Metadata } from "next";
import { WatchdogTeamsDist } from "@/components/watchgod/WatchdogTeamsDist";
import { tdPrisma } from "@/lib/teams-dist/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchgod — Teams Distribution Control",
  description: "Superadmin draw control panel for IUFL teams distribution.",
  robots: { index: false, follow: false },
};

/** Resolve the current draw tournament and its configuration. */
async function getActiveTournament() {
  return tdPrisma.tournament.findFirst({
    where: {
      status: { in: ["TEAMS_READY", "DRAW_IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      numberOfGroups: true,
      teamsPerGroup: true,
    },
  });
}

async function getTournaments() {
  return tdPrisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      numberOfGroups: true,
      teamsPerGroup: true,
    },
  });
}

export default async function WatchdogTeamsDistPage() {
  const [tournament, tournaments] = await Promise.all([
    getActiveTournament(),
    getTournaments(),
  ]);
  return <WatchdogTeamsDist tournament={tournament} tournaments={tournaments} />;
}
