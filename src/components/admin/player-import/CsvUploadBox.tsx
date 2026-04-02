"use client";

import { UploadCloud } from "lucide-react";
import { useRef } from "react";

interface CsvUploadBoxProps {
  onFile: (file: File) => void;
  isDisabled?: boolean;
  removeDuplicatesOnUpload: boolean;
  onRemoveDuplicatesOnUploadChange: (nextValue: boolean) => void;
}

export function CsvUploadBox({
  onFile,
  isDisabled,
  removeDuplicatesOnUpload,
  onRemoveDuplicatesOnUploadChange,
}: CsvUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".csv")) {
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
            Required columns: NAME, YEAR, STREAM, Primary Position
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Optional columns: Whatsapp Number, Secondary Position, Image URL
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Run Check with Database before Commit Data.
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

      <label className="inline-flex items-start gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border border-slate-600 bg-slate-900 accent-accent-green"
          checked={removeDuplicatesOnUpload}
          onChange={(e) => onRemoveDuplicatesOnUploadChange(e.target.checked)}
          disabled={isDisabled}
        />
        <span>
          Remove duplicate rows while parsing CSV (matches by Name + Whatsapp
          Number and keeps the first row).
        </span>
      </label>
    </div>
  );
}
