import { PageTransition } from "@/components/shared/PageTransition";
import { TeamDetailCard } from "@/components/team/TeamDetailCard";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;

  return (
    <PageTransition className="flex-1 w-full min-h-[100dvh] flex flex-col relative bg-pitch-950 p-6 md:p-12 overflow-x-hidden">
      {/* Intense gradient */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none z-0 overflow-hidden" />
      <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none z-0 overflow-hidden" />

      <TeamDetailCard teamId={teamId} />
    </PageTransition>
  );
}
