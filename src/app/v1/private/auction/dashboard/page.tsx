import { AuctionLayout } from "@/components/auction/AuctionLayout";
import { PageTransition } from "@/components/shared/PageTransition";

export default function AuctionDashboardPage() {
  return (
    <PageTransition className="flex w-full min-h-dvh overflow-x-hidden bg-[#0a0a0a] text-slate-200 font-sans">
      <AuctionLayout />
    </PageTransition>
  );
}
