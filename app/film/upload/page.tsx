"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Film,
  RefreshCw,
  Link2,
  FileText,
  X,
  Search,
  ExternalLink,
  Play,
} from "lucide-react";
import NavBar from "@/components/NavBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import VideoUploader from "@/components/film/VideoUploader";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useUpload } from "@/contexts/UploadContext";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

type Step = "details" | "file" | "uploading";
type UploadStatus = "idle" | "uploading" | "processing" | "ready" | "error";

interface SpeedSample {
  time: number;
  bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(seconds: number): string {
  if (seconds < 1) return "finishing...";
  if (seconds < 60) return `~${Math.ceil(seconds)} seconds remaining`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `~${m}m ${s}s remaining`;
}

const UPLOAD_SOURCES = [
  { value: "manual", label: "Manual Upload" },
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "livebarn", label: "LiveBarn" },
];

export default function FilmUploadPage() {
  const router = useRouter();
  const { upload: globalUpload, actions: uploadActions } = useUpload();

  // Step 1 — Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadSource, setUploadSource] = useState("manual");

  // Step 2 — File
  const [file, setFile] = useState<File | null>(null);

  // Step 3 — Upload & Process
  const [step, setStep] = useState<Step>("details");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);

  // Upload progress details
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes per second
  const [uploadEta, setUploadEta] = useState(0); // seconds remaining
  const speedSamplesRef = useRef<SpeedSample[]>([]);

  // Optional event data file
  const [eventDataFile, setEventDataFile] = useState<File | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const eventFileInputRef = useRef<HTMLInputElement>(null);

  // External URL link
  const [linkUrl, setLinkUrl] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Video platform URL import
  const [showPlatformImport, setShowPlatformImport] = useState(false);
  const [platformUrl, setPlatformUrl] = useState("");
  const [platformSessionTitle, setPlatformSessionTitle] = useState("");
  const [platformPlayerId, setPlatformPlayerId] = useState("");
  const [platformPlayerSearch, setPlatformPlayerSearch] = useState("");
  const [platformPlayerResults, setPlatformPlayerResults] = useState<{ id: string; first_name: string; last_name: string; position?: string; team_name?: string }[]>([]);
  const [platformPlayerLoading, setPlatformPlayerLoading] = useState(false);
  const [platformSubmitting, setPlatformSubmitting] = useState(false);
  const [platformError, setPlatformError] = useState("");
  const platformSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // YouTube import
  const [uploadMode, setUploadMode] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeImporting, setYoutubeImporting] = useState(false);
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeResult, setYoutubeResult] = useState<{
    upload_id: string;
    title: string;
    thumbnail_url: string;
    duration_seconds: number;
    source_url: string;
  } | null>(null);

  // FFmpeg capability check
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null); // null = testing

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    (id: string) => {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.get(`/film/uploads/${id}/status`);
          const status = res.data.status;
          if (status === "ready") {
            stopPolling();
            setUploadStatus("ready");
            toast.success("Video is ready!");
          } else if (status === "errored" || status === "error") {
            stopPolling();
            setUploadStatus("error");
            setErrorMessage("Mux processing failed. Please try again.");
            toast.error("Video processing failed");
          }
          // else keep polling (waiting, asset_created, preparing)
        } catch {
          // Network error — keep polling
        }
      }, 5000);
    },
    [stopPolling]
  );

  // Test whether FFmpeg WASM can load in this browser (SharedArrayBuffer, COOP/COEP)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ffmpeg = new FFmpeg();
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpeg.terminate();
        if (!cancelled) setFfmpegAvailable(true);
      } catch (err) {
        console.warn("[FFmpeg] Capability test failed:", err);
        if (!cancelled) setFfmpegAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || !title.trim()) return;

    setStep("uploading");
    setUploadStatus("uploading");
    setProgress(0);
    setErrorMessage("");

    // Delegate to global context — upload persists across page navigations
    uploadActions.startUpload(file, {
      title: title.trim(),
      description: description.trim() || undefined,
      uploadSource,
    });
  }, [file, title, description, uploadSource, uploadActions]);

  // Sync local UI state from global context when on the uploading step
  useEffect(() => {
    if (step !== "uploading" || globalUpload.phase === "idle") return;
    setProgress(globalUpload.progress);
    setBytesUploaded(globalUpload.bytesUploaded);
    setBytesTotal(globalUpload.bytesTotal);
    setUploadSpeed(globalUpload.speed);
    setUploadEta(globalUpload.eta);
    if (globalUpload.uploadId) setUploadId(globalUpload.uploadId);
    // Map context phase → local uploadStatus
    const phaseMap: Record<string, UploadStatus> = {
      compressing: "uploading",  // Show as uploading step (compression UI is in nav)
      uploading: "uploading",
      paused: "uploading",  // Show as uploading on the page (nav shows paused)
      processing: "processing",
      ready: "ready",
      error: "error",
    };
    const mapped = phaseMap[globalUpload.phase];
    if (mapped && mapped !== uploadStatus) {
      setUploadStatus(mapped);
      if (mapped === "error" && globalUpload.error) setErrorMessage(globalUpload.error);
      if (mapped === "ready") toast.success("Video is ready!");
    }
  }, [step, globalUpload, uploadStatus]);

  const handleReset = useCallback(() => {
    stopPolling();
    uploadActions.clearUpload();
    setStep("details");
    setTitle("");
    setDescription("");
    setUploadSource("manual");
    setFile(null);
    setUploadStatus("idle");
    setProgress(0);
    setErrorMessage("");
    setUploadId(null);
    setLinkUrl("");
    setShowPlatformImport(false);
    setPlatformUrl("");
    setPlatformSessionTitle("");
    setPlatformPlayerId("");
    setPlatformPlayerSearch("");
    setPlatformPlayerResults([]);
    setPlatformError("");
    setBytesUploaded(0);
    setBytesTotal(0);
    setUploadSpeed(0);
    setUploadEta(0);
    speedSamplesRef.current = [];
    setEventDataFile(null);
  }, [stopPolling, uploadActions]);

  const handlePlatformPlayerSearch = useCallback((query: string) => {
    setPlatformPlayerSearch(query);
    setPlatformPlayerId("");
    if (platformSearchTimer.current) clearTimeout(platformSearchTimer.current);
    if (query.trim().length < 2) { setPlatformPlayerResults([]); return; }
    platformSearchTimer.current = setTimeout(async () => {
      setPlatformPlayerLoading(true);
      try {
        const res = await api.get("/players", { params: { search: query.trim(), limit: 20 } });
        const players = Array.isArray(res.data) ? res.data : res.data?.players || [];
        setPlatformPlayerResults(players);
      } catch { setPlatformPlayerResults([]); }
      finally { setPlatformPlayerLoading(false); }
    }, 300);
  }, []);

  const handleYoutubeImport = useCallback(async () => {
    const trimmed = youtubeUrl.trim();
    if (!trimmed) return;
    setYoutubeImporting(true);
    setYoutubeError("");
    setYoutubeResult(null);
    try {
      const res = await api.post("/film/import/youtube", { youtube_url: trimmed });
      setYoutubeResult(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Could not import video";
      setYoutubeError(msg);
    } finally {
      setYoutubeImporting(false);
    }
  }, [youtubeUrl]);

  const handleYoutubeReset = useCallback(() => {
    setYoutubeUrl("");
    setYoutubeError("");
    setYoutubeResult(null);
  }, []);

  const handlePlatformImport = useCallback(async () => {
    const trimmed = platformUrl.trim();
    if (!trimmed) { toast.error("Paste a video platform link first"); return; }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setPlatformSubmitting(true);
    setPlatformError("");
    try {
      const res = await api.post("/film/sessions/import-from-url", {
        url: trimmed,
        session_title: platformSessionTitle.trim() || undefined,
        player_id: platformPlayerId || undefined,
      });
      const data = res.data;
      toast.success(`Imported ${data.clip_count} clips from ${data.match_title || "session"}`);
      router.push(`/film/sessions/${data.session_id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to import from URL";
      setPlatformError(msg);
      toast.error(msg);
    } finally {
      setPlatformSubmitting(false);
    }
  }, [platformUrl, platformSessionTitle, platformPlayerId, router]);

  const handleCreateSessionWithEvents = useCallback(async () => {
    setCreatingSession(true);
    try {
      // 1. Create the film session
      const payload: Record<string, string | null> = {
        title: title.trim(),
        session_type: "general",
        description: description.trim() || null,
      };
      if (uploadId) {
        payload.video_upload_id = uploadId;
      }
      const res = await api.post("/film/sessions", payload);
      const newSessionId = res.data.id;
      toast.success("Film session created");

      // 2. Import event data if attached
      if (eventDataFile) {
        try {
          const formData = new FormData();
          formData.append("file", eventDataFile);
          const importRes = await api.post(
            `/film/sessions/${newSessionId}/import-events`,
            formData,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
          toast.success(`Imported ${importRes.data.events_created} events and ${importRes.data.clips_created} clips`);
        } catch {
          toast.error("Event data import failed — session was created successfully");
        }
      }

      // 3. Navigate to the session
      router.push(`/film/sessions/${newSessionId}`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        "Failed to create session";
      toast.error(msg);
      setCreatingSession(false);
    }
  }, [title, description, uploadId, eventDataFile, router]);

  const handleLinkVideo = useCallback(async () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required — go back to Step 1");
      return;
    }
    setLinkSubmitting(true);
    try {
      const res = await api.post("/film/uploads/from-url", {
        url: trimmed,
        title: title.trim(),
        description: description.trim() || null,
      });
      const id = res.data.id;
      setUploadId(id);
      setStep("uploading");

      if (res.data.source_type === "external_link" || res.data.source_type === "youtube" || res.data.source_type === "vimeo") {
        // External link / YouTube / Vimeo — already "ready", no Mux processing needed
        setUploadStatus("ready");
        toast.success("Video link saved!");
      } else {
        // Direct video file — Mux is processing, poll for status
        setUploadStatus("processing");
        pollStatus(id);
        toast.success("Video link submitted — processing...");
      }
    } catch (e: unknown) {
      const resp = (e as { response?: { status?: number; data?: { detail?: { error?: string; limit?: number; used?: number } | string } } })?.response;
      if (resp?.status === 429) {
        const detail = resp.data?.detail;
        const limitMsg = typeof detail === "object" && detail?.error === "usage_limit_exceeded"
          ? `Upload limit reached (${detail.used}/${detail.limit}). Upgrade your plan.`
          : "Upload limit reached. Upgrade your plan.";
        toast.error(limitMsg);
      } else {
        const msg = e instanceof Error ? e.message : "Failed to link video";
        toast.error(msg);
      }
    } finally {
      setLinkSubmitting(false);
    }
  }, [linkUrl, title, description, pollStatus]);

  return (
    <ProtectedRoute>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── War Room Header ─────────────────────────────────── */}
        <div className="bg-[#0F2942] rounded-xl p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Link
              href="/film"
              className="text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="w-10 h-10 rounded-lg bg-teal/20 flex items-center justify-center">
              <Upload size={20} className="text-teal" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-oswald uppercase tracking-wider text-white">Upload Video</h1>
                <span className="text-[9px] font-oswald uppercase tracking-widest bg-teal/20 text-teal px-2 py-0.5 rounded">PXI</span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Add game footage or paste a video link to start building film sessions.
              </p>
            </div>
          </div>
        </div>

        {/* FFmpeg unavailable warning */}
        {ffmpegAvailable === false && (
          <div className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 mb-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <AlertTriangle size={16} style={{ color: "#F59E0B" }} className="shrink-0" />
            <p className="text-[11px]" style={{ color: "#92400E" }}>
              Video optimization is not available in this browser. Large files will upload at original size.
            </p>
          </div>
        )}

        {/* Mode tabs — Upload vs YouTube */}
        <div style={{ display: "flex", gap: 6, padding: "0 16px", borderBottom: "1px solid rgba(15,41,66,0.6)" }}>
          <button
            onClick={() => setUploadMode("upload")}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              textTransform: "uppercase" as const,
              letterSpacing: "0.12em",
              color: "#FFFFFF",
              background: uploadMode === "upload" ? "#0F2942" : "#14B8A8",
              boxShadow: uploadMode === "upload" ? "0 0 0 1px #14B8A8" : "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Upload size={12} />
            Upload
          </button>
          <button
            onClick={() => setUploadMode("youtube")}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              textTransform: "uppercase" as const,
              letterSpacing: "0.12em",
              color: "#FFFFFF",
              background: uploadMode === "youtube" ? "#0F2942" : "#14B8A8",
              boxShadow: uploadMode === "youtube" ? "0 0 0 1px #14B8A8" : "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Play size={12} />
            YouTube
          </button>
        </div>

        {/* ── YouTube Import Mode ─────────────────────────────── */}
        {uploadMode === "youtube" && (
          <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1.5px solid #DDE6EF", padding: 24 }}>
            {!youtubeResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Play size={16} style={{ color: "#0D9488" }} />
                  <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 13, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#0F2942" }}>
                    Import from YouTube
                  </span>
                </div>
                <div>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => { setYoutubeUrl(e.target.value); setYoutubeError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleYoutubeImport(); } }}
                    placeholder="Paste YouTube URL..."
                    style={{
                      width: "100%",
                      border: "1.5px solid #DDE6EF",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 14,
                      fontFamily: "'Source Serif 4', serif",
                      color: "#0F2942",
                      outline: "none",
                    }}
                  />
                </div>
                {youtubeError && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E67E22", fontSize: 12, fontFamily: "'Source Serif 4', serif" }}>
                    <AlertCircle size={14} style={{ color: "#E67E22" }} />
                    Could not import video
                  </div>
                )}
                <button
                  onClick={handleYoutubeImport}
                  disabled={!youtubeUrl.trim() || youtubeImporting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.08em",
                    color: "#FFFFFF",
                    background: youtubeUrl.trim() && !youtubeImporting ? "#0D9488" : "#DDE6EF",
                    cursor: youtubeUrl.trim() && !youtubeImporting ? "pointer" : "not-allowed",
                  }}
                >
                  {youtubeImporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  {youtubeImporting ? "Importing..." : "Import"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                {/* Thumbnail */}
                {youtubeResult.thumbnail_url && (
                  <div style={{ width: "100%", maxWidth: 400, borderRadius: 10, overflow: "hidden", border: "1px solid #DDE6EF" }}>
                    <img
                      src={youtubeResult.thumbnail_url}
                      alt={youtubeResult.title}
                      style={{ width: "100%", display: "block" }}
                    />
                  </div>
                )}
                {/* Title */}
                <p style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 15, color: "#0F2942", textAlign: "center", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                  {youtubeResult.title}
                </p>
                {/* Duration */}
                <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: "#5A7291" }}>
                  {Math.floor(youtubeResult.duration_seconds / 60)}:{String(youtubeResult.duration_seconds % 60).padStart(2, "0")}
                </p>
                {/* Confirmation */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#16A34A", fontSize: 13, fontFamily: "'Oswald', sans-serif", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                  <CheckCircle size={16} style={{ color: "#16A34A" }} />
                  Added to Library ✓
                </div>
                {/* Import Another */}
                <button
                  onClick={handleYoutubeReset}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.08em",
                    color: "#FFFFFF",
                    background: "#0D9488",
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={14} />
                  Import Another
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step indicator */}
        {uploadMode === "upload" && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1.5px solid #DDE6EF" }}>
          <div className="flex items-center justify-center gap-3 px-5 py-3">
            {["Details", "Select File", "Upload"].map((label, i) => {
              const stepKeys: Step[] = ["details", "file", "uploading"];
              const idx = stepKeys.indexOf(step);
              const isActive = i === idx;
              const isCompleted = i < idx;
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className="w-8 h-px"
                      style={{ background: isCompleted || isActive ? "#0D9488" : "#DDE6EF" }}
                    />
                  )}
                  <div
                    className={`flex items-center gap-1.5 text-[11px] font-oswald uppercase tracking-wider ${
                      isActive
                        ? "text-teal"
                        : isCompleted
                        ? "text-teal/60"
                        : "text-muted/50"
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={
                        isActive
                          ? { background: "#0D9488", color: "#FFFFFF" }
                          : isCompleted
                          ? { background: "rgba(13,148,136,0.15)", color: "#0D9488" }
                          : { background: "#DDE6EF", color: "#8BA4BB" }
                      }
                    >
                      {isCompleted ? "✓" : i + 1}
                    </span>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Step 1 — Details */}
        {uploadMode === "upload" && step === "details" && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-5">
            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Game vs Sarnia — Dec 15"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              />
            </div>

            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this video..."
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-oswald uppercase tracking-wider text-navy mb-1.5">
                Upload Source
              </label>
              <select
                value={uploadSource}
                onChange={(e) => setUploadSource(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal bg-white"
              >
                {UPLOAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!title.trim()) {
                    toast.error("Title is required");
                    return;
                  }
                  setStep("file");
                }}
                className="bg-teal text-white px-6 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm hover:bg-teal/90 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Select File */}
        {uploadMode === "upload" && step === "file" && (
          <div className="bg-white rounded-xl border border-border p-6 space-y-5">
            <VideoUploader
              onFileSelect={setFile}
              selectedFile={file}
              onClear={() => setFile(null)}
            />

            {/* ── Or paste a video link ── */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11px] font-oswald uppercase tracking-wider text-muted">
                  Or paste a video link
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleLinkVideo(); }
                  }}
                  placeholder="Paste video URL..."
                  className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
              </div>
              <button
                onClick={handleLinkVideo}
                disabled={!linkUrl.trim() || linkSubmitting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-sm whitespace-nowrap transition-colors ${
                  linkUrl.trim() && !linkSubmitting
                    ? "bg-teal text-white hover:bg-teal/90"
                    : "bg-border text-muted/50 cursor-not-allowed"
                }`}
              >
                {linkSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                Link Video
              </button>
            </div>
            <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: "rgba(90,114,145,0.6)", marginTop: 4 }}>
              YouTube, Vimeo, or direct .mp4 / .mov links supported
            </p>

            {/* ── Or import from video platform ── */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11px] font-oswald uppercase tracking-wider text-muted">
                  Or import from video platform
                </span>
              </div>
            </div>

            {!showPlatformImport ? (
              <button
                onClick={() => setShowPlatformImport(true)}
                className="w-full flex items-center gap-3 border border-dashed border-border rounded-lg px-4 py-3 hover:border-teal/40 hover:bg-teal/[0.02] transition-colors group text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                  <ExternalLink size={16} className="text-teal" />
                </div>
                <div>
                  <span className="text-sm font-oswald uppercase tracking-wider text-navy group-hover:text-teal transition-colors block">
                    Import from Video Platform Link
                  </span>
                  <span className="text-[10px] text-muted/60 leading-tight block mt-0.5">
                    Paste a playlist link to automatically import clips with timestamps
                  </span>
                </div>
              </button>
            ) : (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={14} className="text-teal" />
                    <span className="text-xs font-oswald uppercase tracking-wider text-navy">Video Platform Import</span>
                  </div>
                  <button
                    onClick={() => { setShowPlatformImport(false); setPlatformUrl(""); setPlatformSessionTitle(""); setPlatformPlayerId(""); setPlatformPlayerSearch(""); setPlatformPlayerResults([]); setPlatformError(""); }}
                    className="text-muted/40 hover:text-navy transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* URL input */}
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                    Playlist URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
                    <input
                      type="url"
                      value={platformUrl}
                      onChange={(e) => setPlatformUrl(e.target.value)}
                      placeholder="Paste video platform playlist link..."
                      className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    />
                  </div>
                </div>

                {/* Session title (optional) */}
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                    Session Title (optional)
                  </label>
                  <input
                    type="text"
                    value={platformSessionTitle}
                    onChange={(e) => setPlatformSessionTitle(e.target.value)}
                    placeholder="Auto-detected from match data if left blank"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />
                </div>

                {/* Player search (optional) */}
                <div>
                  <label className="block text-[10px] font-oswald uppercase tracking-wider text-muted mb-1">
                    Link to Player (optional)
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
                    <input
                      type="text"
                      value={platformPlayerSearch}
                      onChange={(e) => handlePlatformPlayerSearch(e.target.value)}
                      placeholder="Search player name..."
                      className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                    />
                  </div>
                  {platformPlayerLoading && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Loader2 size={10} className="animate-spin text-teal" />
                      <span className="text-[10px] text-muted/50">Searching...</span>
                    </div>
                  )}
                  {platformPlayerResults.length > 0 && !platformPlayerId && (
                    <div className="mt-1.5 border border-border rounded-lg max-h-32 overflow-y-auto">
                      {platformPlayerResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPlatformPlayerId(p.id);
                            setPlatformPlayerSearch(`${p.first_name} ${p.last_name}`);
                            setPlatformPlayerResults([]);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-navy hover:bg-teal/5 transition-colors flex items-center justify-between"
                        >
                          <span>{p.first_name} {p.last_name}</span>
                          <span className="text-[10px] text-muted/50">{p.position}{p.team_name ? ` · ${p.team_name}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {platformPlayerId && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-teal font-medium">✓ {platformPlayerSearch}</span>
                      <button
                        onClick={() => { setPlatformPlayerId(""); setPlatformPlayerSearch(""); }}
                        className="text-muted/40 hover:text-red-500 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {platformError && (
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle size={12} />
                    <span className="text-[11px]">{platformError}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handlePlatformImport}
                  disabled={!platformUrl.trim() || platformSubmitting}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm transition-colors ${
                    platformUrl.trim() && !platformSubmitting
                      ? "bg-teal text-white hover:bg-teal/90"
                      : "bg-border text-muted/50 cursor-not-allowed"
                  }`}
                >
                  {platformSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ExternalLink size={14} />
                  )}
                  {platformSubmitting ? "Importing..." : "Import Clips"}
                </button>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep("details")}
                className="text-sm text-muted hover:text-navy font-oswald uppercase tracking-wider transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleUpload}
                disabled={!file}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm transition-colors ${
                  file
                    ? "bg-orange text-white hover:bg-orange/90"
                    : "bg-border text-muted/50 cursor-not-allowed"
                }`}
              >
                <Upload size={14} />
                Upload
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Upload & Process */}
        {uploadMode === "upload" && step === "uploading" && (
          <div className="bg-white rounded-xl border border-border p-6">
            {/* Compressing (shown when context is in compressing phase) */}
            {uploadStatus === "uploading" && globalUpload.phase === "compressing" && (
              <div className="py-6 max-w-md mx-auto">
                {/* Percentage */}
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-navy font-oswald">{globalUpload.compressionProgress}%</span>
                  <span className="text-[11px] font-oswald uppercase tracking-wider" style={{ color: "#3B82F6" }}>Optimizing Video</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-border rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${globalUpload.compressionProgress}%`, background: "#3B82F6" }}
                  />
                </div>

                {/* Size info */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted font-mono">
                    Original: {formatBytes(globalUpload.originalSize)}
                  </span>
                  <span className="text-[11px] font-mono font-medium" style={{ color: "#3B82F6" }}>
                    Compressing...
                  </span>
                </div>

                <p className="text-[10px] text-muted/60 text-center mt-3">
                  Reducing file size before upload for faster transfer.
                </p>
              </div>
            )}

            {/* Uploading with progress details */}
            {uploadStatus === "uploading" && globalUpload.phase !== "compressing" && (
              <div className="py-6 max-w-md mx-auto">
                {/* Percentage */}
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-navy font-oswald">{progress}%</span>
                  <span className="text-[11px] text-muted font-oswald uppercase tracking-wider">Uploading</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-border rounded-full h-3">
                  <div
                    className="bg-teal h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Bytes + Speed row */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted font-mono">
                    {formatBytes(bytesUploaded)} / {formatBytes(bytesTotal)}
                  </span>
                  {uploadSpeed > 0 && (
                    <span className="text-[11px] text-teal font-mono font-medium">
                      {formatBytes(uploadSpeed)}/s
                    </span>
                  )}
                </div>

                {/* ETA */}
                {uploadSpeed > 0 && progress < 100 && (
                  <p className="text-[11px] text-muted/70 text-center mt-2">
                    {formatEta(uploadEta)}
                  </p>
                )}

                {/* Compression savings */}
                {globalUpload.compressedSize > 0 && (
                  <div className="mt-3 rounded-lg px-3 py-2 text-center" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                    <p className="text-[10px] font-medium" style={{ color: "#3B82F6" }}>
                      Compressed: {formatBytes(globalUpload.originalSize)} → {formatBytes(globalUpload.compressedSize)} ({Math.round((1 - globalUpload.compressedSize / globalUpload.originalSize) * 100)}% smaller)
                    </p>
                  </div>
                )}

                {/* Compression skipped warning */}
                {globalUpload.compressionSkipped && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <AlertTriangle size={14} style={{ color: "#F59E0B" }} className="shrink-0" />
                    <p className="text-[11px]" style={{ color: "#92400E" }}>
                      Video optimization was skipped — uploading original file. This may take longer.
                    </p>
                  </div>
                )}

                {/* Background navigation banner */}
                <div className="mt-5 rounded-lg px-4 py-3 text-center" style={{ background: "rgba(13,148,136,0.06)", border: "1.5px solid rgba(13,148,136,0.15)" }}>
                  <p className="text-xs font-medium" style={{ color: "#0F2942" }}>
                    Your video is uploading in the background.
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#5A7291" }}>
                    You can continue working — check the upload status in the nav bar.
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <Link
                      href="/film"
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase text-white transition-colors hover:opacity-90"
                      style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 1, background: "#0D9488" }}
                    >
                      <Film size={11} />
                      Continue to Film Room
                    </Link>
                    <span className="text-[10px]" style={{ color: "#8BA4BB" }}>
                      or stay on this page
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Processing */}
            {uploadStatus === "processing" && (
              <div className="text-center py-6">
                <Loader2 size={28} className="animate-spin text-orange mx-auto mb-3" />
                <p className="text-sm font-medium text-navy">Processing with Mux...</p>
                <p className="text-[11px] text-muted mt-1">
                  This usually takes 30-60 seconds.
                </p>
              </div>
            )}

            {/* Ready */}
            {uploadStatus === "ready" && (
              <div className="text-center py-6">
                <CheckCircle size={36} className="text-teal mx-auto mb-3" />
                <p className="text-sm font-bold text-navy">Ready!</p>
                <p className="text-[11px] text-muted mt-1">
                  Your video has been processed and is ready for viewing.
                </p>

                {/* Attach Event Data (Optional) */}
                <div className="mt-5 mx-auto max-w-sm">
                  <input
                    ref={eventFileInputRef}
                    type="file"
                    accept=".xml,.csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setEventDataFile(f);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  {eventDataFile ? (
                    <div className="flex items-center justify-center gap-2 border border-teal/30 bg-teal/5 rounded-lg px-4 py-2.5">
                      <CheckCircle size={14} className="text-teal shrink-0" />
                      <span className="text-[11px] text-navy truncate max-w-[180px]">{eventDataFile.name}</span>
                      <button
                        onClick={() => setEventDataFile(null)}
                        className="text-muted/50 hover:text-red-500 transition-colors shrink-0"
                        title="Remove event data file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => eventFileInputRef.current?.click()}
                      className="w-full flex flex-col items-center gap-1.5 border border-dashed border-border rounded-lg px-4 py-3 hover:border-navy/30 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 text-muted group-hover:text-navy transition-colors">
                        <FileText size={14} />
                        <span className="text-[11px] font-oswald uppercase tracking-wider">
                          Attach Event Data (Optional)
                        </span>
                      </div>
                      <span className="text-[10px] text-muted/50 leading-tight">
                        Upload an event timeline file to auto-tag your video with plays, events, and key moments.
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 mt-6">
                  {eventDataFile ? (
                    <button
                      onClick={handleCreateSessionWithEvents}
                      disabled={creatingSession}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm transition-colors ${
                        creatingSession
                          ? "bg-teal/50 text-white cursor-not-allowed"
                          : "bg-teal text-white hover:bg-teal/90"
                      }`}
                    >
                      {creatingSession ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Film size={14} />
                      )}
                      {creatingSession ? "Creating..." : "Create Film Session"}
                    </button>
                  ) : (
                    <Link
                      href={`/film/sessions/new?upload=${uploadId}`}
                      className="flex items-center gap-2 bg-teal text-white px-5 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm hover:bg-teal/90 transition-colors"
                    >
                      <Film size={14} />
                      Create Film Session
                    </Link>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 bg-navy/5 text-navy px-5 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm hover:bg-navy/10 transition-colors"
                  >
                    <RefreshCw size={14} />
                    Upload Another
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {uploadStatus === "error" && (
              <div className="text-center py-6">
                <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-navy">Upload Failed</p>
                <p className="text-[11px] text-red-500 mt-1">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="mt-6 flex items-center gap-2 bg-orange text-white px-5 py-2.5 rounded-lg font-oswald uppercase tracking-wider text-sm hover:bg-orange/90 transition-colors mx-auto"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
