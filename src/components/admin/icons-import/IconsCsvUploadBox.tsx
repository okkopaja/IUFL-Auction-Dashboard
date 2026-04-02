"use client";

import { UploadCloud } from "lucide-react";
import { useRef } from "react";

interface IconsCsvUploadBoxProps {
  onFile: (file: File) => void;
  isDisabled?: boolean;
}

export function IconsCsvUploadBox({
  onFile,
  isDisabled,
}: IconsCsvUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return;
    }

    onFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className={`
        relative flex flex-col items-center justify-center gap-3
        border-2 border-dashed rounded-xl px-8 py-10 transition-all duration-200
        ${
          isDisabled
            ? "opacity-50 pointer-events-none border-slate-700 bg-slate-900/30"
            : "border-slate-700 bg-slate-900/40 hover:border-accent-gold/50 hover:bg-slate-800/20 cursor-pointer"
        }
      `}
        disabled={isDisabled}
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center justify-center size-14 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <UploadCloud className="size-7 text-accent-gold" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">
            Drop CSV file here or{" "}
            <span className="text-accent-gold underline underline-offset-2">
              browse
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Required columns: NAME, TEAM NAME, STATUS
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Optional columns: IMAGE URL, POINTS
          </p>
          <p className="text-xs text-slate-500 mt-1">
            STATUS accepts OWNER, CO-OWNER, CAPTAIN, MARQUEE.
          </p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
