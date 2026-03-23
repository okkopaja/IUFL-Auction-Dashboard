import { PlayerListView } from "@/components/dashboard/PlayerListView";

export const metadata = { title: "Unsold Players — IUFL 2026" };

export default function UnsoldPlayersPage() {
  return <PlayerListView status="UNSOLD" />;
}
