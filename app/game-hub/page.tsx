"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import api from "@/lib/api";

interface ImportRecord {
  id: string;
  filename: string | null;
  home_team: string | null;
  away_team: string | null;
  game_date: string | null;
  season: string | null;
  parse_status: string;
  events_inserted: number;
  created_at: string;
}

interface ImportResult {
  import_id: string;
  home_team: string | null;
  away_team: string | null;
  game_date: string | null;
  goals_count: number;
  penalties_count: number;
  events_inserted: number;
}

export default function GameHubPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<ImportRecord[]>("/game-sheets/imports")
      .then((r) => setImports(r.data))
      .catch(() => {})
      .finally(() => setLoadingImports(false));
  }, []);

  const handleUpload = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".jpg") && !name.endsWith(".jpeg") && !name.endsWith(".png")) {
      setError("File must be PDF, JPG, or PNG");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit");
      return;
    }
    setUploading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("season", "2025-26");
      const res = await api.post<ImportResult>("/game-sheets/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      // Refresh import history
      const histRes = await api.get<ImportRecord[]>("/game-sheets/imports");
      setImports(histRes.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        "Could not parse this game sheet. Try a clearer image.";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  return (
    <ProtectedRoute>
      <NavBar />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0A1628", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Game Hub
          </h1>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: "#00B5B8", background: "rgba(0,181,184,0.1)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            PXI
          </span>
        </div>

        {/* Section 1 — Game Sheet Import */}
        <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E5E7EB", padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
            Game Sheet Import
          </h2>

          {/* Upload Zone */}
          {!uploading && !result && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: dragOver ? "2px dashed #00B5B8" : "2px dashed #D1D5DB",
                borderRadius: 12,
                padding: "40px 20px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "rgba(0,181,184,0.04)" : "#FAFBFC",
                transition: "all 0.15s",
              }}
            >
              <Upload size={32} style={{ color: "#9CA3AF", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Drop a game sheet here, or click to browse
              </p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>
                Upload a game sheet to automatically extract goals, assists, and penalties
              </p>
              <p style={{ fontSize: 11, color: "#D1D5DB", marginTop: 8 }}>
                PDF, JPG, or PNG — max 10MB
              </p>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={onFileChange} style={{ display: "none" }} />
            </div>
          )}

          {/* Loading State */}
          {uploading && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Loader2 size={28} style={{ color: "#00B5B8", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Analysing game sheet...</p>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>PXI is extracting game data</p>
            </div>
          )}

          {/* Success State */}
          {result && (
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={18} style={{ color: result.events_inserted > 0 ? "#10B981" : "#E67E22" }} />
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                  letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 4,
                  color: result.events_inserted > 0 ? "#10B981" : "#E67E22",
                  background: result.events_inserted > 0 ? "rgba(16,185,129,0.1)" : "rgba(230,126,34,0.1)",
                }}>
                  {result.events_inserted > 0 ? "Import Complete" : "Review Required"}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>
                {result.home_team || "Home"} vs {result.away_team || "Away"}
              </div>
              {result.game_date && (
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>{result.game_date}</div>
              )}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <span style={{ fontWeight: 700 }}>{result.goals_count}</span> Goals
                </div>
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <span style={{ fontWeight: 700 }}>{result.penalties_count}</span> Penalties
                </div>
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <span style={{ fontWeight: 700 }}>{result.events_inserted}</span> Events Inserted
                </div>
              </div>
              <button
                onClick={() => { setResult(null); setError(null); }}
                style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: "#00B5B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Upload another game sheet
              </button>
            </div>
          )}

          {/* Error State */}
          {error && !uploading && (
            <div style={{ border: "1px solid rgba(230,126,34,0.3)", borderRadius: 12, padding: 20, background: "rgba(230,126,34,0.04)", marginTop: result ? 12 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} style={{ color: "#E67E22" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#E67E22" }}>{error}</span>
              </div>
              {!result && (
                <button
                  onClick={() => { setError(null); }}
                  style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#00B5B8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section 2 — Import History */}
        <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E5E7EB", padding: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#0A1628", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
            Import History
          </h2>

          {loadingImports ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <Loader2 size={18} style={{ color: "#9CA3AF", margin: "0 auto", animation: "spin 1s linear infinite" }} />
            </div>
          ) : imports.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>No game sheets imported yet</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#6B7280", fontSize: 11, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#6B7280", fontSize: 11, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Home Team</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#6B7280", fontSize: 11, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Away Team</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, color: "#6B7280", fontSize: 11, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Events</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, color: "#6B7280", fontSize: 11, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>
                        {imp.game_date || imp.created_at?.slice(0, 10) || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>
                        {imp.home_team || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#374151" }}>
                        {imp.away_team || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", color: "#374151", fontWeight: 600 }}>
                        {imp.events_inserted}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, fontFamily: "'Oswald', sans-serif", textTransform: "uppercase",
                          letterSpacing: "0.06em", padding: "2px 8px", borderRadius: 4,
                          color: imp.parse_status === "parsed" && imp.events_inserted > 0 ? "#10B981"
                            : imp.parse_status === "failed" ? "#EF4444"
                            : "#E67E22",
                          background: imp.parse_status === "parsed" && imp.events_inserted > 0 ? "rgba(16,185,129,0.1)"
                            : imp.parse_status === "failed" ? "rgba(239,68,68,0.1)"
                            : "rgba(230,126,34,0.1)",
                        }}>
                          {imp.parse_status === "parsed" && imp.events_inserted > 0 ? "Parsed"
                            : imp.parse_status === "failed" ? "Failed"
                            : "Review Required"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
