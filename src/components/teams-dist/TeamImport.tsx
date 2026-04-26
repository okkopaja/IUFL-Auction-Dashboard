"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2, Plus } from "lucide-react";
import { useAddTeam, useImportTeams } from "@/hooks/useTeamsDist";
import type { TeamCsvRow, TdTeam } from "@/types/teams-dist";
import { toast } from "sonner";

// ── CSV Upload ────────────────────────────────────────────────────────────────

function CsvUpload({
  tournamentId,
  onSuccess,
}: {
  tournamentId: string;
  onSuccess: () => void;
}) {
  const [preview, setPreview] = useState<TeamCsvRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportTeams(tournamentId);

  function handleFile(file: File) {
    setParseError(null);
    Papa.parse<TeamCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data;
        if (rows.length !== 16) {
          setParseError(`Expected 16 rows, found ${rows.length}`);
          setPreview(null);
          return;
        }
        const names = rows.map((r) => r.team_name?.trim() ?? "");
        const empty = names.findIndex((n) => !n);
        if (empty !== -1) {
          setParseError(`Row ${empty + 1} is missing a team_name`);
          setPreview(null);
          return;
        }
        const uniq = new Set(names.map((n) => n.toLowerCase()));
        if (uniq.size !== 16) {
          setParseError("Duplicate team names found");
          setPreview(null);
          return;
        }
        setPreview(rows);
      },
      error: (err) => setParseError(err.message),
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleCommit() {
    if (!preview) return;
    importMutation.mutate(preview, {
      onSuccess: () => {
        toast.success("16 teams imported successfully");
        setPreview(null);
        onSuccess();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/30 py-10 px-6 text-center hover:border-violet-600/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <UploadCloud className="size-10 text-slate-600" />
        <div>
          <p className="text-sm font-medium text-slate-300">
            Drop CSV or click to upload
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Columns: team_name, short_name, country, seed_pot, crest_url
          </p>
        </div>
      </div>

      {parseError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          {parseError}
        </div>
      )}

      {/* Preview table */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <CheckCircle2 className="size-4" />
                {preview.length} teams ready to import
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b border-slate-800 bg-slate-900">
                  <tr>
                    {["#", "Name", "Short", "Country", "Pot"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-semibold text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: preview rows
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                      <td className="px-3 py-2 font-mono text-slate-600">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-200">{row.team_name}</td>
                      <td className="px-3 py-2 text-slate-500">{row.short_name ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{row.country ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{row.seed_pot ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={importMutation.isPending}
              onClick={handleCommit}
              className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {importMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {importMutation.isPending ? "Importing…" : "Commit 16 Teams"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Manual add form ───────────────────────────────────────────────────────────

function ManualAddForm({
  tournamentId,
  teamCount,
}: {
  tournamentId: string;
  teamCount: number;
}) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const addMutation = useAddTeam(tournamentId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addMutation.mutate(
      { name: name.trim(), country: country.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`"${name.trim()}" added`);
          setName("");
          setCountry("");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  const atMax = teamCount >= 16;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Team name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={atMax}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-violet-500 disabled:opacity-40 transition-colors"
        />
        <input
          type="text"
          placeholder="Country (optional)"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={atMax}
          className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-violet-500 disabled:opacity-40 transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={!name.trim() || atMax || addMutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
      >
        {addMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        {atMax ? "16 / 16 — Maximum reached" : "Add Team"}
      </button>
    </form>
  );
}

// ── Team list ─────────────────────────────────────────────────────────────────

function TeamList({ teams }: { teams: TdTeam[] }) {
  if (teams.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-600 italic">
        No teams imported yet.
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800">
      <table className="w-full text-xs">
        <thead className="sticky top-0 border-b border-slate-800 bg-slate-900">
          <tr>
            {["#", "Name", "Country", "Group"].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, i) => (
            <tr key={team.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
              <td className="px-3 py-2 font-mono text-slate-600">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-slate-200">{team.name}</td>
              <td className="px-3 py-2 text-slate-500">{team.country ?? "—"}</td>
              <td className="px-3 py-2">
                {team.groupAssignment ? (
                  <span className="rounded-full bg-violet-900/50 px-2 py-0.5 text-violet-300 font-semibold">
                    {team.groupAssignment.groupName}
                  </span>
                ) : (
                  <span className="text-slate-700 italic">Undrawn</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Combined export ───────────────────────────────────────────────────────────

export function TeamImport({
  tournamentId,
  teams,
  onImported,
}: {
  tournamentId: string;
  teams: TdTeam[];
  onImported: () => void;
}) {
  const [mode, setMode] = useState<"csv" | "manual">("csv");
  const drawStarted = teams.some((t) => t.groupAssignment);

  return (
    <div className="flex flex-col gap-5">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1 w-fit">
        {(["csv", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              mode === m
                ? "bg-violet-600 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {m === "csv" ? "CSV Upload" : "Manual"}
          </button>
        ))}
      </div>

      {drawStarted && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-800/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          <AlertCircle className="size-4 shrink-0" />
          Draw has started — re-importing will be blocked.
        </div>
      )}

      {mode === "csv" ? (
        <CsvUpload tournamentId={tournamentId} onSuccess={onImported} />
      ) : (
        <ManualAddForm tournamentId={tournamentId} teamCount={teams.length} />
      )}

      {teams.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Current Teams ({teams.length} / 16)
          </p>
          <TeamList teams={teams} />
        </div>
      )}
    </div>
  );
}
