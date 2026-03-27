"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Gavel,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayerImportPanel } from "./player-import/PlayerImportPanel";
import { AdminPlayersBlock } from "./players/AdminPlayersBlock";
import { AdminTeamsBlock } from "./teams/AdminTeamsBlock";

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

  const handleSignOut = () => {
    signOut({ redirectUrl: "/dashboard" });
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

            {/* Placeholder — extend as needed */}
            <button
              type="button"
              disabled
              title="Coming soon"
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                bg-slate-800/60 border border-slate-700/60 text-slate-500
                cursor-not-allowed text-sm font-semibold tracking-wide
              "
            >
              <AlertCircle className="size-4" />
              Reset Session (soon)
            </button>
          </div>
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
            <AdminTeamsBlock />
          </div>

          {/* ── Players ────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-800 bg-pitch-900/50 backdrop-blur-md p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Users className="size-5 text-accent-gold" />
              Players Registry
            </div>
            <AdminPlayersBlock />
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

          {/* Table */}
          <div className="overflow-x-auto">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-widest font-mono border-b border-slate-800/60">
                    <th className="px-6 py-3 text-left">Player</th>
                    <th className="px-6 py-3 text-left">Team</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-right hidden md:table-cell">
                      Time
                    </th>
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
                      <td className="px-6 py-3 text-right text-slate-600 text-xs font-mono hidden md:table-cell">
                        {new Date(tx.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
