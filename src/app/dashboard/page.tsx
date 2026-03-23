import { DashboardView } from "@/components/dashboard/DashboardView";
import { PageTransition } from "@/components/shared/PageTransition";

export default function DashboardPage() {
  return (
    <PageTransition className="flex-1 w-full flex flex-col items-center justify-start p-6 md:p-12 relative overflow-hidden min-h-screen">
      {/* Premium Sports Background Accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full point-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full point-events-none" />
      <div className="absolute top-[30%] left-[40%] w-[20%] h-[20%] bg-accent-gold/5 blur-[100px] rounded-full point-events-none" />

      <DashboardView />
    </PageTransition>
  );
}
