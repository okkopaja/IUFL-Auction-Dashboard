"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UploadCloud, User } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toDisplayImageUrl } from "@/lib/imageUrl";
import type { Player } from "@/types";

const MAX_PLAYER_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

type PlayerFormState = {
  name: string;
  position1: string;
  position2: string;
  imageUrl: string;
};

function emptyPlayerFormState(): PlayerFormState {
  return {
    name: "",
    position1: "",
    position2: "",
    imageUrl: "",
  };
}

function buildPlayerFormState(player: Player): PlayerFormState {
  return {
    name: player.name ?? "",
    position1: player.position1 ?? "",
    position2: player.position2 ?? "",
    imageUrl: player.imageUrl ?? "",
  };
}

function fetchAllPlayers() {
  return fetch("/api/players").then((res) => res.json());
}

function formatSoldAmount(amount: number | null | undefined): string {
  return typeof amount === "number" ? `${amount.toLocaleString()} pts` : "-";
}

export function AdminPlayersBlock() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [formState, setFormState] =
    useState<PlayerFormState>(emptyPlayerFormState);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-players"],
    queryFn: fetchAllPlayers,
  });

  const { mutateAsync: savePlayer, isPending: isSavingPlayer } = useMutation({
    mutationFn: async ({
      playerId,
      payload,
    }: {
      playerId: string;
      payload: PlayerFormState;
    }) => {
      const res = await fetch(`/api/admin/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: {
          name?: string;
          position1?: string;
          position2?: string | null;
          imageUrl?: string | null;
        };
        error?: string;
      } | null;

      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || "Failed to save player details");
      }

      return json.data;
    },
    onSuccess: async (data, variables) => {
      toast.success("Player details updated");

      setSelectedPlayer((prev) => {
        if (!prev || prev.id !== variables.playerId) return prev;
        return {
          ...prev,
          name: data.name ?? prev.name,
          position1: data.position1 ?? prev.position1,
          position2:
            data.position2 === undefined ? prev.position2 : data.position2,
          imageUrl: data.imageUrl === undefined ? prev.imageUrl : data.imageUrl,
        };
      });

      setFormState((prev) => ({
        ...prev,
        name: data.name ?? prev.name,
        position1: data.position1 ?? prev.position1,
        position2:
          data.position2 === undefined
            ? prev.position2
            : (data.position2 ?? ""),
        imageUrl:
          data.imageUrl === undefined ? prev.imageUrl : (data.imageUrl ?? ""),
      }));

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-players"] }),
        qc.invalidateQueries({ queryKey: ["players"] }),
        qc.invalidateQueries({ queryKey: ["auction-current"] }),
        qc.invalidateQueries({ queryKey: ["currentPlayer"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update player details",
      );
    },
  });

  const players: Player[] = data?.data || [];
  const selectedPlayerImageUrl = toDisplayImageUrl(formState.imageUrl);

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenEditor = (player: Player) => {
    setSelectedPlayer(player);
    setFormState(buildPlayerFormState(player));
    setIsUploadingImage(false);
    setIsDraggingImage(false);
  };

  const handleCloseEditor = () => {
    if (isSavingPlayer || isUploadingImage) return;

    setSelectedPlayer(null);
    setFormState(emptyPlayerFormState());
    setIsDraggingImage(false);
  };

  const handleFieldChange = (field: keyof PlayerFormState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openImagePicker = () => {
    if (isSavingPlayer || isUploadingImage) return;
    imageInputRef.current?.click();
  };

  const uploadPlayerImage = async (file: File) => {
    if (!selectedPlayer) return;

    if (file.size === 0) {
      toast.error("Selected image is empty");
      return;
    }

    if (file.size > MAX_PLAYER_IMAGE_UPLOAD_BYTES) {
      toast.error("Image is too large. Use a file up to 5MB.");
      return;
    }

    if (file.type && !file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    setIsUploadingImage(true);

    try {
      const payload = new FormData();
      payload.append("file", file);

      const response = await fetch(
        `/api/admin/players/${selectedPlayer.id}/image`,
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

      handleFieldChange("imageUrl", json.data.imageUrl);
      toast.success("Player image uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploadingImage(false);
      setIsDraggingImage(false);
    }
  };

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void uploadPlayerImage(file);
  };

  const handleImageDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (isSavingPlayer || isUploadingImage) return;
    if (!isDraggingImage) {
      setIsDraggingImage(true);
    }
  };

  const handleImageDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingImage(false);
  };

  const handleImageDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingImage(false);

    if (isSavingPlayer || isUploadingImage) return;

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    void uploadPlayerImage(file);
  };

  const handleRemoveImage = () => {
    if (isSavingPlayer || isUploadingImage) return;
    handleFieldChange("imageUrl", "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlayer) return;

    if (isUploadingImage) {
      toast.error("Please wait for image upload to finish");
      return;
    }

    if (formState.name.trim().length === 0) {
      toast.error("Player name is required");
      return;
    }

    if (formState.position1.trim().length === 0) {
      toast.error("Primary position is required");
      return;
    }

    await savePlayer({
      playerId: selectedPlayer.id,
      payload: formState,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by player name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-pitch-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all font-mono"
        />
      </div>

      {/* Results */}
      <div className="flex flex-col gap-2 max-h-75 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 text-accent-gold animate-spin" />
          </div>
        ) : (
          filteredPlayers.map((player) => {
            const playerImageUrl = toDisplayImageUrl(player.imageUrl);

            return (
              <button
                type="button"
                key={player.id}
                onClick={() => handleOpenEditor(player)}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-pitch-800/30 hover:bg-slate-800/80 hover:border-slate-600 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  {playerImageUrl ? (
                    /* biome-ignore lint/performance/noImgElement: Admin previews must support arbitrary existing URLs that may not be in Next remotePatterns. */
                    <img
                      src={playerImageUrl}
                      alt={player.name}
                      className="size-10 object-cover rounded-full bg-pitch-950 border border-slate-700 group-hover:border-slate-500 transition-colors"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 group-hover:border-slate-500 transition-colors">
                      <User className="size-5 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">
                      {player.name}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {[player.position1, player.position2]
                        .filter(Boolean)
                        .join(" • ")}
                      {player.year ? ` • ${player.year}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-xs font-mono font-bold ${
                      player.status === "SOLD"
                        ? "text-accent-green"
                        : player.status === "UNSOLD"
                          ? "text-slate-500"
                          : "text-accent-gold"
                    }`}
                  >
                    {player.status}
                  </div>
                  {player.status === "SOLD" &&
                    player.transactionAmount !== null &&
                    player.transactionAmount !== undefined && (
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {formatSoldAmount(player.transactionAmount)}
                      </div>
                    )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Player Detail Modal */}
      <Dialog
        open={!!selectedPlayer}
        onOpenChange={(open) => !open && handleCloseEditor()}
      >
        <DialogContent className="max-w-md bg-pitch-900 border-slate-800 text-slate-200 p-0 overflow-hidden sm:rounded-2xl shadow-2xl">
          {selectedPlayer && (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col max-h-[90vh]"
            >
              <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {/* Header Image */}
                <div className="relative w-full h-56 sm:h-64 shrink-0 bg-pitch-950 border-b border-slate-800 flex items-center justify-center overflow-hidden">
                  {selectedPlayerImageUrl ? (
                    /* biome-ignore lint/performance/noImgElement: Admin preview must render arbitrary existing URLs that may not be in Next remotePatterns. */
                    <img
                      src={selectedPlayerImageUrl}
                      alt={formState.name || selectedPlayer.name}
                      className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
                    />
                  ) : (
                    <User className="size-24 text-slate-700" />
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-pitch-900 via-pitch-900/80 to-transparent" />

                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <div
                      className={`px-3 py-1.5 rounded-md border text-xs font-bold tracking-widest uppercase shadow-sm backdrop-blur-md ${
                        selectedPlayer.status === "SOLD"
                          ? "bg-accent-green/20 text-accent-green border-accent-green/30"
                          : selectedPlayer.status === "UNSOLD"
                            ? "bg-slate-800/80 text-slate-400 border-slate-700"
                            : "bg-accent-gold/20 text-accent-gold border-accent-gold/30"
                      }`}
                    >
                      {selectedPlayer.status}
                    </div>
                  </div>
                </div>

                {/* Player Details */}
                <div className="p-6 pt-0 flex flex-col gap-6 relative z-10 -mt-8">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="player-name"
                        className="text-xs text-slate-500 uppercase tracking-widest"
                      >
                        Name
                      </label>
                      <input
                        id="player-name"
                        type="text"
                        value={formState.name}
                        onChange={(event) =>
                          handleFieldChange("name", event.target.value)
                        }
                        placeholder="Player name"
                        className="w-full bg-pitch-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="player-position-1"
                          className="text-xs text-slate-500 uppercase tracking-widest"
                        >
                          Position 1
                        </label>
                        <input
                          id="player-position-1"
                          type="text"
                          value={formState.position1}
                          onChange={(event) =>
                            handleFieldChange("position1", event.target.value)
                          }
                          placeholder="Primary position"
                          className="w-full bg-pitch-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="player-position-2"
                          className="text-xs text-slate-500 uppercase tracking-widest"
                        >
                          Position 2
                        </label>
                        <input
                          id="player-position-2"
                          type="text"
                          value={formState.position2}
                          onChange={(event) =>
                            handleFieldChange("position2", event.target.value)
                          }
                          placeholder="Secondary position (optional)"
                          className="w-full bg-pitch-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/70 bg-pitch-950/40 p-4 flex flex-col gap-3">
                      <p className="text-xs text-slate-500 uppercase tracking-widest">
                        Player Image
                      </p>

                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />

                      {selectedPlayerImageUrl ? (
                        <div className="rounded-lg border border-slate-700 bg-pitch-900 p-3">
                          <div className="flex items-center gap-3">
                            {/* biome-ignore lint/performance/noImgElement: Admin preview must render arbitrary existing URLs that may not be in Next remotePatterns. */}
                            <img
                              src={selectedPlayerImageUrl}
                              alt={`${formState.name || selectedPlayer.name} preview`}
                              className="size-12 rounded-full object-cover border border-slate-700 bg-slate-800"
                            />
                            <div>
                              <p className="text-xs font-medium text-slate-200">
                                Current image preview
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Use Edit Image below to replace this upload.
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60"
                              onClick={openImagePicker}
                              disabled={isSavingPlayer || isUploadingImage}
                            >
                              {isUploadingImage ? (
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
                              onClick={handleRemoveImage}
                              disabled={isSavingPlayer || isUploadingImage}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`w-full rounded-lg border border-dashed px-4 py-5 text-left transition-all ${
                            isDraggingImage
                              ? "border-accent-gold/70 bg-accent-gold/10"
                              : "border-slate-700 bg-pitch-900 hover:border-slate-500 hover:bg-pitch-900/80"
                          }`}
                          onClick={openImagePicker}
                          onDragOver={handleImageDragOver}
                          onDragLeave={handleImageDragLeave}
                          onDrop={handleImageDrop}
                          disabled={isSavingPlayer || isUploadingImage}
                        >
                          {isUploadingImage ? (
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Base Price
                      </p>
                      <p className="text-xl font-mono font-bold text-slate-200">
                        {selectedPlayer.basePrice.toLocaleString()}
                      </p>
                    </div>
                    {selectedPlayer.transactionAmount !== null &&
                    selectedPlayer.transactionAmount !== undefined ? (
                      <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                          Sold For
                        </p>
                        <p className="text-xl font-mono font-bold text-accent-green">
                          {formatSoldAmount(selectedPlayer.transactionAmount)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 flex flex-col justify-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                          Status
                        </p>
                        <p className="text-lg font-mono font-bold text-slate-400">
                          {selectedPlayer.status === "UNSOLD"
                            ? "Unsold"
                            : "In Auction"}
                        </p>
                      </div>
                    )}
                    {selectedPlayer.teamId && selectedPlayer.team ? (
                      <div className="bg-pitch-950/50 rounded-xl p-4 border border-slate-800/50 col-span-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                            Team Details
                          </p>
                          <p className="font-medium text-slate-100">
                            {selectedPlayer.team.name}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold tracking-widest bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg shadow-inner">
                          {selectedPlayer.team.shortCode}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-pitch-950/50 flex items-center justify-end gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-400 hover:text-slate-200"
                  disabled={isSavingPlayer || isUploadingImage}
                  onClick={handleCloseEditor}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-accent-gold/20 border border-accent-gold/40 text-accent-gold hover:bg-accent-gold/30 hover:border-accent-gold/70"
                  disabled={isSavingPlayer || isUploadingImage}
                >
                  {isSavingPlayer
                    ? "Saving..."
                    : isUploadingImage
                      ? "Uploading image..."
                      : "Save Player Details"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
