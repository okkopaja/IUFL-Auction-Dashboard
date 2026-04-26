import type { Metadata } from "next";
import { TournamentDetailView } from "@/components/teams-dist/TournamentDetailView";

export const metadata: Metadata = {
  title: "Tournament — Teams Draw",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function TournamentPage({ params }: Props) {
  const { id } = await params;
  return <TournamentDetailView tournamentId={id} />;
}
