import { AuctionLayout } from "@/components/auction/AuctionLayout";
import { PageTransition } from "@/components/shared/PageTransition";

export default function AuctionPage() {
  return (
    <PageTransition className="flex-1 w-full min-h-[100dvh] overflow-hidden flex flex-col relative bg-pitch-950">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none z-0" />

      <AuctionLayout />
    </PageTransition>
  );
}
