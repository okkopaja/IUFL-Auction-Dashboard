"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine, UploadCloud } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import type { Team, TeamRoleSlot } from "@/types";

const MAX_TEAM_ROLE_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

const TEAM_ROLE_FIELDS = [
  { key: "owner", label: "Owner" },
  { key: "coOwner", label: "Co-owner" },
  { key: "captain", label: "Captain" },
  { key: "marquee", label: "Marquee" },
] as const;

type TeamRoleFieldKey = (typeof TEAM_ROLE_FIELDS)[number]["key"];
type TeamRoleDraft = { name: string; imageUrl: string };
type TeamRoleFormState = Record<TeamRoleFieldKey, TeamRoleDraft>;
type TeamRoleFlagState = Record<TeamRoleFieldKey, boolean>;

const TEAM_ROLE_LABEL_BY_KEY: Record<TeamRoleFieldKey, string> = {
  owner: "Owner",
  coOwner: "Co-owner",
  captain: "Captain",
  marquee: "Marquee",
};

function fetchTeams() {
  return fetch("/api/teams").then((res) => res.json());
}

function isRoleConfigured(role?: TeamRoleSlot): boolean {
  return Boolean(role?.name?.trim() || role?.imageUrl?.trim());
}

function getTeamRole(
  team: Team,
  key: TeamRoleFieldKey,
): TeamRoleSlot | undefined {
  switch (key) {
    case "owner":
      return team.owner;
    case "coOwner":
      return team.coOwner;
    case "captain":
      return team.captain;
    case "marquee":
      return team.marquee;
    default:
      return undefined;
  }
}

function buildRoleFormState(team: Team): TeamRoleFormState {
  return {
    owner: {
      name: team.owner?.name ?? "",
      imageUrl: team.owner?.imageUrl ?? "",
    },
    coOwner: {
      name: team.coOwner?.name ?? "",
      imageUrl: team.coOwner?.imageUrl ?? "",
    },
    captain: {
      name: team.captain?.name ?? "",
      imageUrl: team.captain?.imageUrl ?? "",
    },
    marquee: {
      name: team.marquee?.name ?? "",
      imageUrl: team.marquee?.imageUrl ?? "",
    },
  };
}

function emptyRoleFormState(): TeamRoleFormState {
  return {
    owner: { name: "", imageUrl: "" },
    coOwner: { name: "", imageUrl: "" },
    captain: { name: "", imageUrl: "" },
    marquee: { name: "", imageUrl: "" },
  };
}

function emptyRoleFlagState(): TeamRoleFlagState {
  return {
    owner: false,
    coOwner: false,
    captain: false,
    marquee: false,
  };
}

function calculateTeamSquadCount(team: Team): number {
  const additional = [team.captain, team.marquee].reduce(
    (count, role) => (isRoleConfigured(role) ? count + 1 : count),
    0,
  );
  return team.playersOwnedCount + additional;
}

function parseWholeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function AdminTeamsBlock() {
  const qc = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [formState, setFormState] =
    useState<TeamRoleFormState>(emptyRoleFormState);
  const [uploadingByRole, setUploadingByRole] =
    useState<TeamRoleFlagState>(emptyRoleFlagState);
  const [draggingByRole, setDraggingByRole] =
    useState<TeamRoleFlagState>(emptyRoleFlagState);
  const [pointsDraftByTeamId, setPointsDraftByTeamId] = useState<
    Record<string, string>
  >({});
  const [savingPointsTeamId, setSavingPointsTeamId] = useState<string | null>(
    null,
  );
  const fileInputRefs = useRef<
    Record<TeamRoleFieldKey, HTMLInputElement | null>
  >({
    owner: null,
    coOwner: null,
    captain: null,
    marquee: null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: fetchTeams,
  });

  const teams: Team[] = data?.data || [];
  const isUploadingAnyImage = Object.values(uploadingByRole).some(Boolean);

  const { mutateAsync: updateRoles, isPending: isSavingRoles } = useMutation({
    mutationFn: async ({
      teamId,
      roles,
    }: {
      teamId: string;
      roles: TeamRoleFormState;
    }) => {
      const payload: Record<TeamRoleFieldKey, TeamRoleDraft> = {
        owner: roles.owner,
        coOwner: roles.coOwner,
        captain: roles.captain,
        marquee: roles.marquee,
      };

      const res = await fetch(`/api/admin/teams/${teamId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save team members");
      }

      return json.data;
    },
    onSuccess: async (_, variables) => {
      toast.success("Team members updated");
      setSelectedTeam(null);
      setFormState(emptyRoleFormState());
      setUploadingByRole(emptyRoleFlagState());
      setDraggingByRole(emptyRoleFlagState());

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-teams"] }),
        qc.invalidateQueries({ queryKey: ["teams"] }),
        qc.invalidateQueries({ queryKey: ["team", variables.teamId] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update team members",
      );
    },
  });

  const { mutateAsync: updateTeamPoints, isPending: isSavingPoints } =
    useMutation({
      mutationFn: async ({
        teamId,
        pointsTotal,
      }: {
        teamId: string;
        pointsTotal: number;
      }) => {
        const res = await fetch(`/api/admin/teams/${teamId}/points`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pointsTotal }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to update team points");
        }

        return json.data as {
          pointsTotal: number;
          pointsSpent: number;
          pointsRemaining: number;
        };
      },
      onSuccess: async (_, variables) => {
        toast.success("Team points updated");
        setPointsDraftByTeamId((prev) => ({
          ...prev,
          [variables.teamId]: String(variables.pointsTotal),
        }));

        await Promise.all([
          qc.invalidateQueries({ queryKey: ["admin-teams"] }),
          qc.invalidateQueries({ queryKey: ["teams"] }),
          qc.invalidateQueries({ queryKey: ["team", variables.teamId] }),
          qc.invalidateQueries({ queryKey: ["auction-current"] }),
        ]);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update team points",
        );
      },
    });

  const handleOpenEditor = (team: Team) => {
    setSelectedTeam(team);
    setFormState(buildRoleFormState(team));
    setUploadingByRole(emptyRoleFlagState());
    setDraggingByRole(emptyRoleFlagState());
  };

  const handleCloseEditor = () => {
    if (isSavingRoles || isUploadingAnyImage) return;
    setSelectedTeam(null);
    setFormState(emptyRoleFormState());
    setUploadingByRole(emptyRoleFlagState());
    setDraggingByRole(emptyRoleFlagState());
  };

  const handleRoleFieldChange = (
    key: TeamRoleFieldKey,
    field: keyof TeamRoleDraft,
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const setRoleUploadState = (key: TeamRoleFieldKey, value: boolean) => {
    setUploadingByRole((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const setRoleDragState = (key: TeamRoleFieldKey, value: boolean) => {
    setDraggingByRole((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const openRoleFilePicker = (key: TeamRoleFieldKey) => {
    if (isSavingRoles || uploadingByRole[key]) return;
    fileInputRefs.current[key]?.click();
  };

  const uploadRoleImage = async (key: TeamRoleFieldKey, file: File) => {
    if (!selectedTeam) return;

    if (file.size === 0) {
      toast.error("Selected image is empty");
      return;
    }

    if (file.size > MAX_TEAM_ROLE_IMAGE_UPLOAD_BYTES) {
      toast.error("Image is too large. Use a file up to 5MB.");
      return;
    }

    if (file.type && !file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    setRoleUploadState(key, true);

    try {
      const payload = new FormData();
      payload.append("role", key);
      payload.append("file", file);

      const response = await fetch(
        `/api/admin/teams/${selectedTeam.id}/roles/image`,
        {
          method: "POST",
          body: payload,
        },
      );

      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { imageUrl?: string };
        error?: string;
      } | null;

      if (!response.ok || !json?.success || !json.data?.imageUrl) {
        throw new Error(json?.error || "Failed to upload image");
      }

      handleRoleFieldChange(key, "imageUrl", json.data.imageUrl);
      toast.success(`${TEAM_ROLE_LABEL_BY_KEY[key]} image uploaded`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setRoleUploadState(key, false);
      setRoleDragState(key, false);
    }
  };

  const handleRoleFileChange = (
    key: TeamRoleFieldKey,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void uploadRoleImage(key, file);
  };

  const handleRoleDragOver = (
    key: TeamRoleFieldKey,
    event: DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    if (uploadingByRole[key] || isSavingRoles) return;
    if (!draggingByRole[key]) {
      setRoleDragState(key, true);
    }
  };

  const handleRoleDragLeave = (
    key: TeamRoleFieldKey,
    event: DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    setRoleDragState(key, false);
  };

  const handleRoleDrop = (
    key: TeamRoleFieldKey,
    event: DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    setRoleDragState(key, false);

    if (uploadingByRole[key] || isSavingRoles) return;

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    void uploadRoleImage(key, file);
  };

  const handleRemoveRoleImage = (key: TeamRoleFieldKey) => {
    if (uploadingByRole[key]) return;
    handleRoleFieldChange(key, "imageUrl", "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTeam) return;

    if (isUploadingAnyImage) {
      toast.error("Please wait for image uploads to finish");
      return;
    }

    await updateRoles({
      teamId: selectedTeam.id,
      roles: formState,
    });
  };

  const handleTeamPointsInputChange = (teamId: string, value: string) => {
    setPointsDraftByTeamId((prev) => ({
      ...prev,
      [teamId]: value,
    }));
  };

  const handleSaveTeamPoints = async (team: Team) => {
    const pointsInputValue =
      pointsDraftByTeamId[team.id] ?? String(team.pointsTotal);
    const parsedPointsTotal = parseWholeNumber(pointsInputValue);

    if (parsedPointsTotal === null) {
      toast.error("Points must be a non-negative whole number");
      return;
    }

    if (parsedPointsTotal < team.pointsSpent) {
      toast.error(
        `Points total cannot be below spent points (${team.pointsSpent.toLocaleString()})`,
      );
      return;
    }

    if (parsedPointsTotal === team.pointsTotal) {
      return;
    }

    setSavingPointsTeamId(team.id);
    try {
      await updateTeamPoints({
        teamId: team.id,
        pointsTotal: parsedPointsTotal,
      });
    } finally {
      setSavingPointsTeamId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 text-accent-gold animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">
            No teams available. Run prisma:seed during setup.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[68vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {teams.map((team) => {
              const pointsInputValue =
                pointsDraftByTeamId[team.id] ?? String(team.pointsTotal);
              const parsedPointsInput = parseWholeNumber(pointsInputValue);
              const isPointsBelowSpent =
                parsedPointsInput !== null &&
                parsedPointsInput < team.pointsSpent;
              const hasPointsChanged =
                parsedPointsInput !== null &&
                parsedPointsInput !== team.pointsTotal;
              const remainingPreview =
                parsedPointsInput !== null
                  ? parsedPointsInput - team.pointsSpent
                  : null;
              const isSavingCurrentTeamPoints =
                isSavingPoints && savingPointsTeamId === team.id;

              return (
                <div
                  key={team.id}
                  className="p-5 rounded-2xl border border-slate-800 bg-pitch-800/30 hover:bg-slate-800/50 transition-colors flex flex-col gap-5 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <TeamLogo
                        domain={team.domain}
                        name={team.name}
                        size={48}
                        className="rounded-xl border border-slate-700 bg-slate-800/80 p-1.5 group-hover:border-slate-500"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 text-base tracking-wide truncate">
                          {team.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {team.domain}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                      {team.shortCode}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {TEAM_ROLE_FIELDS.map((role) => {
                      const current = getTeamRole(team, role.key);
                      return (
                        <div
                          key={role.key}
                          className="bg-pitch-950/60 rounded-lg border border-slate-800/70 px-3 py-2.5"
                        >
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                            {role.label}
                          </p>
                          <p className="mt-1 text-sm text-slate-300 truncate">
                            {current?.name?.trim() ? current.name : "-"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-pitch-950/80 rounded-lg p-3 border border-slate-800/50 text-center shadow-inner">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">
                        Funds Remaining
                      </p>
                      <p className="text-base font-mono font-bold text-accent-gold tracking-tight">
                        {team.pointsRemaining.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-pitch-950/80 rounded-lg p-3 border border-slate-800/50 text-center shadow-inner flex flex-col items-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-semibold">
                        Squad
                      </p>
                      <p className="text-base font-mono font-bold text-slate-300">
                        <span className="text-slate-100">
                          {calculateTeamSquadCount(team)}
                        </span>
                        <span className="text-slate-600 ml-1 opacity-70">
                          / 16
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-pitch-950/50 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                        Edit Total Points
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Spent{" "}
                        <span className="font-mono text-slate-300">
                          {team.pointsSpent.toLocaleString()}
                        </span>
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={team.pointsSpent}
                        step={1}
                        inputMode="numeric"
                        value={pointsInputValue}
                        onChange={(event) =>
                          handleTeamPointsInputChange(
                            team.id,
                            event.target.value,
                          )
                        }
                        disabled={isSavingPoints}
                        className="w-full bg-pitch-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                      />

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60"
                        onClick={() => void handleSaveTeamPoints(team)}
                        disabled={
                          isSavingPoints ||
                          parsedPointsInput === null ||
                          isPointsBelowSpent ||
                          !hasPointsChanged
                        }
                      >
                        {isSavingCurrentTeamPoints ? (
                          <>
                            <Loader2 className="size-3.5 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>

                    {parsedPointsInput === null ? (
                      <p className="mt-2 text-[11px] text-rose-400">
                        Enter a whole number (0 or greater).
                      </p>
                    ) : isPointsBelowSpent ? (
                      <p className="mt-2 text-[11px] text-rose-400">
                        Total cannot be below spent points.
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Remaining after save:{" "}
                        <span className="font-mono text-slate-300">
                          {(remainingPreview ?? 0).toLocaleString()}
                        </span>
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-700 bg-slate-900/30 text-slate-300 hover:border-slate-500 hover:bg-slate-800/70"
                    onClick={() => handleOpenEditor(team)}
                  >
                    <PencilLine className="size-3.5 mr-1" />
                    Edit Team Members
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedTeam}
        onOpenChange={(open) => !open && handleCloseEditor()}
      >
        <DialogContent className="w-[min(96vw,1120px)] max-w-[min(96vw,1120px)] sm:max-w-[1120px] max-h-[92vh] bg-pitch-900 border-slate-800 text-slate-200 p-0 overflow-hidden sm:rounded-2xl shadow-2xl">
          {selectedTeam ? (
            <form onSubmit={handleSubmit} className="flex flex-col">
              <DialogHeader className="px-8 pt-7 pb-3 border-b border-slate-800/80 bg-pitch-950/35">
                <DialogTitle className="text-xl font-bold text-slate-100">
                  {selectedTeam.name} Team Members
                </DialogTitle>
                <DialogDescription className="text-slate-500">
                  Configure owner, co-owner, captain, and marquee details. Drop
                  an image in each role card to upload automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="px-8 py-4 grid grid-cols-1 lg:grid-cols-2 gap-5 max-h-[62vh] overflow-y-auto overflow-x-hidden">
                {TEAM_ROLE_FIELDS.map((role) => (
                  <div
                    key={role.key}
                    className="rounded-2xl border border-slate-800/80 bg-pitch-950/35 p-5"
                  >
                    <h4 className="text-base font-semibold text-slate-200 tracking-wide">
                      {role.label}
                    </h4>

                    <div className="mt-4 flex flex-col gap-2">
                      <label
                        htmlFor={`role-${role.key}-name`}
                        className="text-xs text-slate-500 uppercase tracking-widest"
                      >
                        Name
                      </label>
                      <input
                        id={`role-${role.key}-name`}
                        type="text"
                        value={formState[role.key].name}
                        onChange={(event) =>
                          handleRoleFieldChange(
                            role.key,
                            "name",
                            event.target.value,
                          )
                        }
                        placeholder={`${role.label} name`}
                        className="w-full bg-pitch-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">
                        Image
                      </p>

                      <input
                        ref={(node) => {
                          fileInputRefs.current[role.key] = node;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          handleRoleFileChange(role.key, event)
                        }
                      />

                      {toDisplayImageUrl(formState[role.key].imageUrl) ? (
                        <div className="rounded-xl border border-slate-700 bg-pitch-900 p-3.5">
                          <div className="flex items-start gap-3">
                            {/* biome-ignore lint/performance/noImgElement: Admin preview must render arbitrary existing URLs that may not be in Next remotePatterns. */}
                            <img
                              src={
                                toDisplayImageUrl(
                                  formState[role.key].imageUrl,
                                ) || ""
                              }
                              alt={`${role.label} preview`}
                              className="size-14 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-200">
                                Existing image preview
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Use Edit Image below to replace this upload.
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60"
                              onClick={() => openRoleFilePicker(role.key)}
                              disabled={
                                isSavingRoles || uploadingByRole[role.key]
                              }
                            >
                              {uploadingByRole[role.key] ? (
                                <>
                                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                "Edit Image"
                              )}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              className="text-slate-400 hover:text-slate-200"
                              onClick={() => handleRemoveRoleImage(role.key)}
                              disabled={
                                isSavingRoles || uploadingByRole[role.key]
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`w-full rounded-xl border border-dashed px-4 py-6 text-left transition-all ${
                            draggingByRole[role.key]
                              ? "border-accent-gold/70 bg-accent-gold/10"
                              : "border-slate-700 bg-pitch-900 hover:border-slate-500 hover:bg-pitch-900/80"
                          }`}
                          onClick={() => openRoleFilePicker(role.key)}
                          onDragOver={(event) =>
                            handleRoleDragOver(role.key, event)
                          }
                          onDragLeave={(event) =>
                            handleRoleDragLeave(role.key, event)
                          }
                          onDrop={(event) => handleRoleDrop(role.key, event)}
                          disabled={isSavingRoles || uploadingByRole[role.key]}
                        >
                          {uploadingByRole[role.key] ? (
                            <span className="inline-flex items-center text-sm text-slate-300">
                              <Loader2 className="size-3.5 mr-2 animate-spin" />
                              Uploading image...
                            </span>
                          ) : (
                            <div className="flex items-start gap-3">
                              <UploadCloud className="size-4 mt-0.5 text-slate-400" />
                              <div>
                                <p className="text-sm font-medium text-slate-300">
                                  Drag and drop image here
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Or click to choose file (max 5MB)
                                </p>
                              </div>
                            </div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-8 py-5 border-t border-slate-800 bg-pitch-950/50 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-400 hover:text-slate-200"
                  disabled={isSavingRoles || isUploadingAnyImage}
                  onClick={handleCloseEditor}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-accent-gold/20 border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/30 hover:border-accent-gold/70"
                  disabled={isSavingRoles || isUploadingAnyImage}
                >
                  {isSavingRoles
                    ? "Saving..."
                    : isUploadingAnyImage
                      ? "Uploading images..."
                      : "Save Team Members"}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
