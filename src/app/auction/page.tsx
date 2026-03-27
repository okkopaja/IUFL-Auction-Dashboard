import { AuctionLayout } from "@/components/auction/AuctionLayout";
import { PageTransition } from "@/components/shared/PageTransition";

export default function AuctionPage() {
  return (
    <PageTransition className="flex w-full min-h-[100dvh] overflow-hidden bg-[#0a0a0a] text-slate-200 font-sans">
      <AuctionLayout />
    </PageTransition>
  );
}
