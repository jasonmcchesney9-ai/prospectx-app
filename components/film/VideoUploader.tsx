"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, FileVideo, X } from "lucide-react";

interface VideoUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

const ACCEPTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];
const ACCEPTED_EXTENSIONS = ".mp4,.mov,.avi,.mkv";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VideoUploader({ onFileSelect, selectedFile, onClear }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const validExt = ["mp4", "mov", "avi", "mkv"].includes(ext || "");
      const validType = ACCEPTED_TYPES.includes(file.type) || validExt;
      if (!validType) {
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (selectedFile) {
    return (
      <div className="border border-teal/30 bg-teal/5 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <FileVideo size={20} className="text-teal shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-navy truncate">{selectedFile.name}</p>
            <p className="text-[11px] text-muted">{formatFileSize(selectedFile.size)}</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-muted hover:text-red-500 transition-colors p-1"
          title="Remove file"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-teal bg-teal/5"
          : "border-border hover:border-teal/40"
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <Upload size={32} className={`mx-auto mb-3 ${isDragging ? "text-teal" : "text-muted/40"}`} />
      <p className="text-sm text-navy font-medium">
        Drag & drop your video file here
      </p>
      <p className="text-[11px] text-muted mt-1">
        or{" "}
        <span className="text-teal underline">browse files</span>
      </p>
      <p className="text-[10px] text-muted/60 mt-2">
        Accepted: .mp4, .mov, .avi, .mkv
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
