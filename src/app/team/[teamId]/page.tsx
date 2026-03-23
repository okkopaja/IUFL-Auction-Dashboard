import { PageTransition } from "@/components/shared/PageTransition";
import { TeamDetailCard } from "@/components/team/TeamDetailCard";
import { MOCK_TEAMS } from "@/app/api/_mockData";
import { notFound, redirect } from "next/navigation";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  // Canonicalize legacy IDs like `t08` to readable slugs like `newcastle-united`.
  const team = MOCK_TEAMS.find((t) => t.id === teamId || t.slug === teamId);
  if (!team) notFound();
  if (teamId !== team.slug) redirect(`/team/${team.slug}`);

  return (
    <PageTransition className="flex-1 w-full min-h-[100dvh] flex flex-col relative bg-pitch-950 p-6 md:p-12">
      {/* Intense gradient */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full point-events-none z-0" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full point-events-none z-0" />

      <TeamDetailCard teamId={team.slug} />
    </PageTransition>
  );
}
