import { PositionPlayersView } from "@/components/players/PositionPlayersView";

export const metadata = { title: "Attacker Players — IUFL 2026" };

export default function AttackerPlayersPage() {
  return <PositionPlayersView group="ATTACKER" title="Attacker" />;
}
