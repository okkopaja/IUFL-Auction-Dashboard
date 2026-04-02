import { PlayerListView } from "@/components/dashboard/PlayerListView";

export const metadata = { title: "Sold Players — IUFL 2026" };

export default function SoldPlayersPage() {
  return <PlayerListView status="SOLD" />;
}
