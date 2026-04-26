import type { Metadata } from "next";
import { WatchdogTeamsDist } from "@/components/watchgod/WatchdogTeamsDist";
import { tdPrisma } from "@/lib/teams-dist/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchgod — Teams Distribution Control",
  description: "Superadmin draw control panel for IUFL teams distribution.",
  robots: { index: false, follow: false },
};

/** Resolve the first active/ready tournament automatically */
async function getActiveTournament() {
  return tdPrisma.tournament.findFirst({
    where: {
      status: { in: ["TEAMS_READY", "DRAW_IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function WatchdogTeamsDistPage() {
  const tournament = await getActiveTournament();
  return <WatchdogTeamsDist tournament={tournament} />;
}
