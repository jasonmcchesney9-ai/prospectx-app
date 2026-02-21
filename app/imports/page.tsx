"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

interface UploadResult {
  file_type: string;
  subtype: string | null;
  inserted: number;
  updated: number;
  skipped: number;
  unmapped_columns: string[];
  preview: { row: number; player: string }[];
}

const FILE_TYPE_LABELS: Record<string, string> = {
  skater: "Skater Stats",
  goalie: "Goalie Stats",
  lines: "Line Combinations",
  team_game_log: "Team Game Log",
  player_game_log: "Player Game Log",
  league_skater: "League Skater Stats",
  league_team: "League Team Stats",
};

export default function ImportsPage() {
  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatNormalizerUploader />
      </main>
    </ProtectedRoute>
  );
}

function StatNormalizerUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [season, setSeason] = useState("2025-26");
  const [leagueName, setLeagueName] = useState("GOJHL");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const params = new URLSearchParams();
      if (season) params.set("season", season);
      if (leagueName) params.set("league_name", leagueName);

      const { data } = await api.post<UploadResult>(
        `/stats/upload?${params.toString()}`,
        fd,
        { timeout: 300000 }
      );
      setResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
            <Upload size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-oswald text-navy">Stat Normalizer</h1>
            <p className="text-muted text-sm">
              Upload InStat XLSX exports for processing and normalization
            </p>
          </div>
        </div>
      </div>

      {/* Success Result */}
      {result && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm flex items-center gap-2 flex-wrap">
                Upload Complete
                <span className="text-xs px-2 py-0.5 rounded bg-white border text-teal">
                  {FILE_TYPE_LABELS[result.file_type] || result.file_type}
                  {result.subtype && ` (${result.subtype})`}
                </span>
              </p>

              {/* Stat Boxes */}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-green-600">{result.inserted}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Inserted</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Updated</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <p className="text-2xl font-oswald font-bold text-gray-400">{result.skipped}</p>
                  <p className="text-xs text-muted uppercase tracking-wider">Skipped</p>
                </div>
              </div>

              {/* Unmapped Columns */}
              {result.unmapped_columns.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800">
                    {result.unmapped_columns.length} unmapped column{result.unmapped_columns.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.unmapped_columns.map((col) => (
                      <span
                        key={col}
                        className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Rows */}
              {result.preview.length > 0 && (
                <div className="mt-3 text-xs text-muted">
                  <p className="font-semibold text-navy mb-1">Preview:</p>
                  {result.preview.map((p) => (
                    <p key={p.row}>
                      Row {p.row}: {p.player}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-4 flex-wrap">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
                >
                  <ArrowRight size={14} />
                  Upload Another File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-700 font-medium text-sm">Upload Error</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      {!result && (
        <div className="bg-white rounded-xl border border-border p-6">
          {/* File Picker */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-navy mb-2">
              Stats File (.xlsx)
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-teal bg-teal/5" : "border-teal/20 hover:border-teal/50"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet size={24} className="text-teal" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-navy">{file.name}</p>
                    <p className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="text-xs text-muted hover:text-red-500 ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto mb-2 text-teal/40" />
                  <p className="text-sm text-muted">
                    Click to select an <span className="font-semibold text-navy">.xlsx</span> file
                  </p>
                  <p className="text-xs text-muted mt-1">InStat Excel export</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setError("");
                  setResult(null);
                }
              }}
            />
          </div>

          {/* Season */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-navy mb-2">Season</label>
            <input
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              placeholder="e.g. 2025-26"
            />
          </div>

          {/* League Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-navy mb-2">League Name</label>
            <input
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              placeholder="e.g. GOJHL"
            />
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-teal text-white font-semibold py-2.5 rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload &amp; Process
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
