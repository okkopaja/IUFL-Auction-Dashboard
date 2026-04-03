"use client";

import { Users, UserX } from "lucide-react";
import { useState } from "react";
import { usePlayers } from "@/hooks/useAuction";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

function formatSoldAmount(amount: number | null | undefined): string {
  return typeof amount === "number" ? `${amount}` : "-";
}

export function PlayerStatusSheets({
  soldCount,
  unsoldCount,
  totalPlayers = 0,
}: {
  soldCount?: number;
  unsoldCount?: number;
  totalPlayers?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Badge
        variant="outline"
        className="h-7 w-fit px-3 bg-pitch-950/40 border-slate-700 text-slate-200 font-mono text-xs tracking-widest uppercase"
      >
        Total Players: {totalPlayers}
      </Badge>
      <PlayerListSheet
        status="SOLD"
        title="Sold Players"
        count={soldCount}
        icon={<Users className="w-4 h-4 mr-2" />}
      />
      <PlayerListSheet
        status="UNSOLD"
        title="Unsold Players"
        count={unsoldCount}
        icon={<UserX className="w-4 h-4 mr-2" />}
      />
    </div>
  );
}

function PlayerListSheet({
  status,
  title,
  count,
  icon,
}: {
  status: "SOLD" | "UNSOLD";
  title: string;
  count?: number;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full h-14 px-5 text-base font-bold justify-start border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white",
        )}
      >
        <span className="flex items-center w-full">
          <span className="inline-flex items-center">
            {icon} {title}
          </span>
          {typeof count === "number" ? (
            <span className="ml-auto font-mono text-sm text-slate-400">
              {count}
            </span>
          ) : null}
        </span>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-pitch-900 border-l border-slate-800 w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl text-slate-100 font-heading">
            {title}
          </SheetTitle>
        </SheetHeader>
        <PlayerListContent status={status} open={open} />
      </SheetContent>
    </Sheet>
  );
}

function PlayerListContent({
  status,
  open,
}: {
  status: "SOLD" | "UNSOLD";
  open: boolean;
}) {
  const { data: players, isLoading } = usePlayers(status);

  if (!open) return null;
  if (isLoading)
    return (
      <div className="p-4 text-slate-400 animate-pulse">Loading list...</div>
    );
  if (!players || players.length === 0)
    return (
      <div className="p-4 text-slate-500">
        No {status.toLowerCase()} players found.
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => (
        <div
          key={p.id}
          className="p-3 rounded bg-pitch-800/50 border border-slate-800/50 flex justify-between items-center hover:bg-pitch-800 transition-colors"
        >
          <div>
            <div className="font-medium text-slate-200">{p.name}</div>
            <div className="text-xs text-slate-400">
              {[p.position1, p.position2].filter(Boolean).join(" / ")}
              {p.year ? ` • ${p.year}` : ""}
            </div>
          </div>
          {status === "SOLD" ? (
            <span className="font-mono text-accent-gold">
              {formatSoldAmount(p.transactionAmount)}
            </span>
          ) : (
            <span className="font-mono text-slate-500">{p.basePrice}</span>
          )}
        </div>
      ))}
    </div>
  );
}
