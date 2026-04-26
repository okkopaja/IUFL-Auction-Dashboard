"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  DrawRequest,
  DrawResult,
  TdTeam,
  TdTournament,
  TeamCsvRow,
} from "@/types/teams-dist";

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = "/api/teams-dist/tournaments";

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? "Request failed");
  return json.data as T;
}

// ── Tournaments ───────────────────────────────────────────────────────────────

export function useTournaments() {
  return useQuery<TdTournament[]>({
    queryKey: ["td", "tournaments"],
    queryFn: () => apiFetch(`${BASE}`),
    staleTime: 30_000,
  });
}

export function useTournament(id: string) {
  return useQuery<TdTournament>({
    queryKey: ["td", "tournament", id],
    queryFn: () => apiFetch(`${BASE}/${id}`),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation<TdTournament, Error, { name: string }>({
    mutationFn: (data) =>
      apiFetch(`${BASE}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["td", "tournaments"] });
    },
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["td", "tournaments"] });
    },
  });
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export function useTeams(tournamentId: string) {
  return useQuery<TdTeam[]>({
    queryKey: ["td", "teams", tournamentId],
    queryFn: () => apiFetch(`${BASE}/${tournamentId}/teams`),
    staleTime: 10_000,
    enabled: !!tournamentId,
  });
}

export function useAddTeam(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<TdTeam, Error, Partial<TdTeam>>({
    mutationFn: (data) =>
      apiFetch(`${BASE}/${tournamentId}/teams`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["td", "teams", tournamentId] });
      qc.invalidateQueries({ queryKey: ["td", "tournament", tournamentId] });
    },
  });
}

export function useImportTeams(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<TdTeam[], Error, TeamCsvRow[]>({
    mutationFn: (teams) =>
      apiFetch(`${BASE}/${tournamentId}/teams/import`, {
        method: "POST",
        body: JSON.stringify({ teams }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["td", "teams", tournamentId] });
      qc.invalidateQueries({ queryKey: ["td", "tournament", tournamentId] });
      qc.invalidateQueries({ queryKey: ["td", "groups", tournamentId] });
    },
  });
}

// ── Groups ────────────────────────────────────────────────────────────────────

export interface GroupBoardData {
  groups: Array<{
    groupName: string;
    teams: TdTeam[];
    isFull: boolean;
    capacity: number;
  }>;
  unassigned: TdTeam[];
  canUndo: boolean;
  canDrawSingle: boolean;
  canDrawBatch: boolean;
  isComplete: boolean;
}

export function useGroupBoard(tournamentId: string) {
  return useQuery<GroupBoardData>({
    queryKey: ["td", "groups", tournamentId],
    queryFn: () => apiFetch(`${BASE}/${tournamentId}/groups`),
    staleTime: 5_000,
    enabled: !!tournamentId,
  });
}

// ── Draw ──────────────────────────────────────────────────────────────────────

export function useDraw(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation<DrawResult, Error, DrawRequest>({
    mutationFn: (payload) =>
      apiFetch(`${BASE}/${tournamentId}/draw`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["td", "groups", tournamentId] });
      qc.invalidateQueries({ queryKey: ["td", "tournament", tournamentId] });
    },
  });
}
