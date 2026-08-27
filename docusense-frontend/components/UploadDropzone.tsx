"use client";

import { useCallback, useState } from "react";
import { UploadCloud, FileText } from "lucide-react";
import clsx from "clsx";

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  isUploading: boolean;
}

export function UploadDropzone({ onFileSelected, isUploading }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={clsx(
        "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-10 py-16 text-center transition-colors",
        isDragging
          ? "border-brass bg-brass/5"
          : "border-border bg-paper-dim/40 hover:border-slate-light"
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper">
        {isUploading ? (
          <FileText className="h-6 w-6 animate-pulse" />
        ) : (
          <UploadCloud className="h-6 w-6" />
        )}
      </div>

      <div>
        <p className="font-display text-xl text-ink">
          {isUploading ? "Reading your document…" : "Drop a document to begin"}
        </p>
        <p className="mt-1 text-sm text-slate">
          PDF, DOCX, TXT, PNG, or JPG — up to 50MB
        </p>
      </div>

      {!isUploading && (
        <label className="lift-on-hover mt-2 cursor-pointer rounded-md border border-ink bg-ink px-5 py-2 text-sm font-medium text-paper">
          Choose a file
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
            onChange={handleFileInput}
          />
        </label>
      )}
    </div>
  );
}