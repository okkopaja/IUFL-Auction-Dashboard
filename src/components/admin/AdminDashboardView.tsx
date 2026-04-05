"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  FileSpreadsheet,
  Gavel,
  Image,
  LogOut,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTES } from "@/lib/constants";
import { IconsImportPanel } from "./icons-import/IconsImportPanel";
import { TeamWiseExportPanel } from "./player-export/TeamWiseExportPanel";
import { PlayerImportPanel } from "./player-import/PlayerImportPanel";

interface TransactionLog {
  id: string;
  amount: number;
  createdAt: string;
  player: { name: string; role?: string } | null;
  team: { name: string; shortCode: string } | null;
}

interface AuctionStats {
  soldCount: number;
  unsoldCount: number;
  totalSpent: number;
  totalTeams: number;
}

async function postJson(url: string, body?: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export function AdminDashboardView() {
  const { signOut } = useAuth();
  const qc = useQueryClient();

  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [stats, setStats] = useState<AuctionStats | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [isRemovingIcons, setIsRemovingIcons] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [logsLoading, setLogsLoading] = useState(true);

  // ── Data fetching ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLogsLoading(true);
    try {
      const [logRes, statsRes] = await Promise.all([
        fetch("/api/auction/log").then((r) => r.json()),
        fetch("/api/auction/stats").then((r) => r.json()),
      ]);
      if (logRes.success) setLogs(logRes.data ?? []);
      if (statsRes.success) setStats(statsRes.data);
    } catch {
      toast.error("Failed to load auction data");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleAdvancePlayer = async () => {
    setIsAdvancing(true);
    try {
      const res = await postJson("/api/auction/next");
      if (!res.success) throw new Error(res.error);
      const name = res.data?.nextPlayer?.name;
      toast.success(
        name ? `Now auctioning: ${name}` : "No more unsold players",
      );
      qc.invalidateQueries({ queryKey: ["auction-current"] });
      await fetchData();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to advance player",
      );
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleResetDialogChange = (open: boolean) => {
    if (isResettingSession) return;
    setIsResetDialogOpen(open);
    if (!open) {
      setResetPassword("");
    }
  };

  const handleResetSession = async () => {
    if (resetPassword.length === 0) {
      toast.error("Enter your password to confirm reset");
      return;
    }

    setIsResettingSession(true);
    try {
      const res = await postJson("/api/admin/auction/reset", {
        password: resetPassword,
      });
      if (!res.success) throw new Error(res.error);

      toast.success("Auction session reset. All players are now unsold.");

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auction-current"] }),
        qc.invalidateQueries({ queryKey: ["teams"] }),
        qc.invalidateQueries({ queryKey: ["team"] }),
        qc.invalidateQueries({ queryKey: ["players"] }),
        qc.invalidateQueries({ queryKey: ["currentPlayer"] }),
        qc.invalidateQueries({ queryKey: ["auctionLog"] }),
        qc.invalidateQueries({ queryKey: ["auctionStats"] }),
        qc.invalidateQueries({ queryKey: ["admin-teams"] }),
      ]);

      await fetchData();
      setIsResetDialogOpen(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset session",
      );
    } finally {
      setIsResettingSession(false);
      setResetPassword("");
    }
  };

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  const handleRemoveIconsFromPlayerbase = async () => {
    const confirmed = confirm(
      "This will remove UNSOLD players whose names match IUFL icon profiles (Captain/Marquee/Owner/Co-Owner). Continue?",
    );
    if (!confirmed) return;

    setIsRemovingIcons(true);
    try {
      const res = await postJson("/api/admin/player-import/remove-icons");
      if (!res.success) throw new Error(res.error);

      const removedCount = Number(res.data?.removedCount ?? 0);
      const blockedCount = Number(res.data?.blockedCount ?? 0);

      if (removedCount === 0 && blockedCount === 0) {
        toast.success("No IUFL icon names were found in the playerbase.");
      } else if (blockedCount > 0) {
        toast.warning(
          `Removed ${removedCount} icon player(s). ${blockedCount} player(s) were not removed because they are not UNSOLD.`,
        );
      } else {
        toast.success(
          `Removed ${removedCount} IUFL icon player(s) from the playerbase.`,
        );
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["players"] }),
        qc.invalidateQueries({ queryKey: ["admin-players"] }),
        qc.invalidateQueries({ queryKey: ["currentPlayer"] }),
        qc.invalidateQueries({ queryKey: ["auction-current"] }),
        qc.invalidateQueries({ queryKey: ["auctionLog"] }),
        qc.invalidateQueries({ queryKey: ["auctionStats"] }),
      ]);

      await fetchData();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to remove IUFL icons from playerbase",
      );
    } finally {
      setIsRemovingIcons(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-pitch-950 text-slate-100">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-pitch-950/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-accent-gold/10 border border-accent-gold/30">
              <Shield className="size-4 text-accent-gold" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-mono leading-none">
                IUFL 2026
              </p>
              <p className="text-sm font-bold text-slate-100 leading-tight">
                Admin Panel
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchData}
              title="Refresh data"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500 text-xs font-medium transition-all"
            >
              <RefreshCw className="size-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <UserButton
              appearance={{
                elements: {
                  avatarBox:
                    "size-8 ring-2 ring-accent-gold/40 hover:ring-accent-gold/80 transition-all duration-200 rounded-full",
                },
              }}
            />

            <button
              type="button"
              id="admin-sign-out-btn"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 text-xs font-medium transition-all"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
        {/* Page title */}
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-6 text-accent-gold" />
          <div>
            <h1 className="text-2xl font-bold font-heading">
              Auction <span className="text-accent-gold">Control Centre</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Restricted access — authenticated admin only
            </p>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Sold",
              value: stats?.soldCount ?? "—",
              color: "text-accent-green",
              bg: "bg-accent-green/10 border-accent-green/20",
            },
            {
              label: "Unsold",
              value: stats?.unsoldCount ?? "—",
              color: "text-slate-300",
              bg: "bg-slate-800/60 border-slate-700/60",
            },
            {
              label: "Total Spent",
              value: stats ? `${(stats.totalSpent / 1000).toFixed(1)}K` : "—",
              color: "text-accent-gold",
              bg: "bg-accent-gold/10 border-accent-gold/20",
            },
            {
              label: "Teams",
              value: stats?.totalTeams ?? "—",
              color: "text-accent-blue",
              bg: "bg-accent-blue/10 border-accent-blue/20",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border px-5 py-4 ${s.bg} backdrop-blur-md`}
            >
              <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
                {s.label}
              </p>
              <p className={`text-3xl font-bold font-heading mt-1 ${s.color}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Action panel ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Gavel className="size-5 text-accent-gold" />
            Auction Controls
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Advance next player */}
            <button
              type="button"
              id="admin-advance-btn"
              onClick={handleAdvancePlayer}
              disabled={isAdvancing}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-accent-gold/20 border border-accent-gold/40 text-accent-gold
                hover:bg-accent-gold/30 hover:border-accent-gold/70
                font-semibold text-sm tracking-wide
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              <ChevronRight
                className={`size-4 ${isAdvancing ? "animate-spin" : ""}`}
              />
              {isAdvancing ? "Advancing…" : "Advance Next Player"}
            </button>

            <button
              type="button"
              id="admin-reset-session-btn"
              onClick={() => setIsResetDialogOpen(true)}
              disabled={isResettingSession}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-red-500/20 border border-red-500/40 text-red-200
                hover:bg-red-500/30 hover:border-red-400
                text-sm font-semibold tracking-wide
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              <RotateCcw
                className={`size-4 ${isResettingSession ? "animate-spin" : ""}`}
              />
              {isResettingSession ? "Resetting…" : "Reset Session"}
            </button>

            <button
              type="button"
              id="admin-remove-icons-playerbase-btn"
              onClick={handleRemoveIconsFromPlayerbase}
              disabled={isRemovingIcons}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-amber-500/20 border border-amber-500/40 text-amber-200
                hover:bg-amber-500/30 hover:border-amber-400
                text-sm font-semibold tracking-wide
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              <Trash2
                className={`size-4 ${isRemovingIcons ? "animate-spin" : ""}`}
              />
              {isRemovingIcons
                ? "Removing Icons…"
                : "Remove IUFL Icons from Playerbase"}
            </button>
          </div>
        </div>

        <Dialog open={isResetDialogOpen} onOpenChange={handleResetDialogChange}>
          <DialogContent
            showCloseButton={!isResettingSession}
            className="max-w-lg bg-pitch-900 border-slate-800 text-slate-200 p-0 overflow-hidden sm:rounded-2xl shadow-2xl"
          >
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-xl font-bold text-slate-100">
                Reset Auction Session
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                This action is destructive and cannot be undone. Confirm your
                password to proceed.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleResetSession();
              }}
              className="px-6 pb-6 flex flex-col gap-4"
            >
              <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                <p className="font-semibold flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-300" />
                  This will immediately reset the active auction session.
                </p>
                <p className="mt-2 text-red-200/90">
                  All sold players will be reverted to unsold, all team spending
                  will reset, and every transaction log entry will be deleted.
                </p>
                <p className="mt-2 text-red-200/90">
                  Teams, player records, and owner/co-owner/captain/marquee role
                  profiles will be preserved.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reset-session-password"
                  className="text-xs text-slate-500 uppercase tracking-widest"
                >
                  Confirm your password
                </label>
                <input
                  id="reset-session-password"
                  type="password"
                  autoComplete="current-password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  disabled={isResettingSession}
                  placeholder="Enter your account password"
                  className="w-full bg-pitch-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-400/60 focus:ring-1 focus:ring-red-400/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleResetDialogChange(false)}
                  disabled={isResettingSession}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingSession || resetPassword.length === 0}
                  className="px-4 py-2 rounded-lg border border-red-500/50 bg-red-500/20 text-red-200 hover:bg-red-500/30 hover:border-red-400 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResettingSession ? "Resetting…" : "Reset Session"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Team-wise Player Export ───────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <FileSpreadsheet className="size-5 text-accent-blue" />
            Team-wise Player Export
          </div>
          <TeamWiseExportPanel />
        </div>

        {/* ── Icons Import ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Image className="size-5 text-accent-gold" />
            Icons Import
          </div>
          <IconsImportPanel />
        </div>

        {/* ── Player Import ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Users className="size-5 text-accent-gold" />
            Player Import
          </div>
          <PlayerImportPanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── Teams ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Shield className="size-5 text-accent-blue" />
              Teams
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              Team member editing now lives in a dedicated Teams section with
              drag-and-drop image upload, previews, and role configuration.
            </p>

            <Link href={ROUTES.ADMIN_TEAMS} className="block w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-slate-700 bg-slate-900/30 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60 justify-between"
              >
                Open Teams Section
                <ChevronRight className="size-4 text-accent-gold" />
              </Button>
            </Link>
          </div>

          {/* ── Players ────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Users className="size-5 text-accent-gold" />
              Players Registry
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              Player editing now lives in a dedicated Players section with image
              upload, name updates, and position management.
            </p>

            <Link href={ROUTES.ADMIN_PLAYERS} className="block w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-slate-700 bg-slate-900/30 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60 justify-between"
              >
                Open Players Section
                <ChevronRight className="size-4 text-accent-gold" />
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Transaction log ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Activity className="size-5 text-accent-blue" />
              Transaction Log
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {logs.length} records
            </span>
          </div>

          {/* Log Views (Table for desktop, Cards for mobile) */}
          <div className="w-full">
            {logsLoading ? (
              <div className="px-6 py-10 text-center text-slate-500 text-sm animate-pulse">
                Loading transactions…
              </div>
            ) : logs.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <Users className="size-8 opacity-30" />
                No transactions yet
              </div>
            ) : (
              <>
                {/* Mobile Card List */}
                <div className="md:hidden flex flex-col gap-2 p-4">
                  {logs.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-pitch-900/50 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-slate-200">
                            {tx.player?.name ?? "—"}
                          </div>
                          {tx.player?.role && (
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {tx.player.role}
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-accent-gold font-mono text-lg">
                          {tx.amount.toLocaleString()} pts
                        </div>
                      </div>
                      <div className="flex justify-between items-end border-t border-slate-800/40 pt-2 mt-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                            {tx.team?.shortCode ?? "?"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {tx.team?.name ?? "Unknown"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono">
                          {new Date(tx.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-widest font-mono border-b border-slate-800/60">
                        <th className="px-6 py-3 text-left">Player</th>
                        <th className="px-6 py-3 text-left">Team</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                        <th className="px-6 py-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((tx, i) => (
                        <tr
                          key={tx.id}
                          className={`border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors ${
                            i % 2 === 0 ? "" : "bg-pitch-900/30"
                          }`}
                        >
                          <td className="px-6 py-3 font-medium text-slate-200">
                            {tx.player?.name ?? "—"}
                            {tx.player?.role && (
                              <span className="ml-2 text-xs text-slate-600 font-mono">
                                {tx.player.role}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                {tx.team?.shortCode ?? "?"}
                              </span>
                              <span className="text-slate-300">
                                {tx.team?.name ?? "Unknown"}
                              </span>
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-accent-gold font-mono">
                            {tx.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-600 text-xs font-mono">
                            {new Date(tx.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
