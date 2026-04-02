import { PositionPlayersView } from "@/components/players/PositionPlayersView";

export const metadata = { title: "GK Players — IUFL 2026" };

export default function GoalkeepersPage() {
  return <PositionPlayersView group="GK" title="GK" />;
}
