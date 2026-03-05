"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { createUpload, type UpChunk } from "@mux/upchunk";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import api from "@/lib/api";

/* ─── Types ─── */

export type UploadPhase = "idle" | "compressing" | "uploading" | "paused" | "processing" | "ready" | "error";

export interface UploadState {
  phase: UploadPhase;
  progress: number;
  speed: number;       // bytes per second
  eta: number;         // seconds remaining
  fileName: string;
  bytesUploaded: number;
  bytesTotal: number;
  uploadId: string | null;
  error: string | null;
  title: string;       // session title for "Create Session" link
  /** Timestamp when upload completed (drives auto-dismiss) */
  completedAt: number | null;
  /** Compression tracking */
  compressionProgress: number;  // 0-100
  originalSize: number;         // bytes (pre-compression)
  compressedSize: number;       // bytes (post-compression, 0 if not compressed)
}

interface SpeedSample {
  time: number;
  bytes: number;
}

export interface UploadActions {
  startUpload: (file: File, metadata: { title: string; description?: string; uploadSource?: string }) => Promise<void>;
  cancelUpload: () => void;
  clearUpload: () => void;
  retryUpload: () => void;
}

interface UploadContextValue {
  upload: UploadState;
  actions: UploadActions;
}

const INITIAL_STATE: UploadState = {
  phase: "idle",
  progress: 0,
  speed: 0,
  eta: 0,
  fileName: "",
  bytesUploaded: 0,
  bytesTotal: 0,
  uploadId: null,
  error: null,
  title: "",
  completedAt: null,
  compressionProgress: 0,
  originalSize: 0,
  compressedSize: 0,
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

/* ─── Provider ─── */

export default function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const upchunkRef = useRef<UpChunk | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedSamplesRef = useRef<SpeedSample[]>([]);
  const lastFileRef = useRef<File | null>(null);
  const lastMetaRef = useRef<{ title: string; description?: string; uploadSource?: string } | null>(null);
  const uploadIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/film/uploads/${id}/status`);
        const status = res.data.status;
        if (status === "ready") {
          stopPolling();
          setState((prev) => ({ ...prev, phase: "ready", completedAt: Date.now() }));
        } else if (status === "errored" || status === "error") {
          stopPolling();
          setState((prev) => ({ ...prev, phase: "error", error: "Video processing failed. Please try again." }));
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);
  }, [stopPolling]);

  /* ─── Offline / online detection for extra safety ─── */
  useEffect(() => {
    const handleOffline = () => {
      // UpChunk detects offline natively, but this ensures our UI updates
      if (upchunkRef.current && state.phase === "uploading") {
        setState((prev) => ({ ...prev, phase: "paused", speed: 0, eta: 0 }));
      }
    };
    const handleOnline = () => {
      // UpChunk auto-resumes; update UI to show uploading again
      if (upchunkRef.current && state.phase === "paused") {
        setState((prev) => ({ ...prev, phase: "uploading" }));
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [state.phase]);

  const startUpload = useCallback(async (file: File, metadata: { title: string; description?: string; uploadSource?: string }) => {
    // Stash for retry
    lastFileRef.current = file;
    lastMetaRef.current = metadata;

    const COMPRESSION_THRESHOLD = 500 * 1024 * 1024; // 500 MB
    let fileToUpload: File = file;

    // ── Compression step (files > 500 MB) ──
    if (file.size > COMPRESSION_THRESHOLD) {
      setState({
        ...INITIAL_STATE,
        phase: "compressing",
        fileName: file.name,
        bytesTotal: file.size,
        originalSize: file.size,
        title: metadata.title,
      });

      try {
        const ffmpeg = new FFmpeg();

        ffmpeg.on("progress", ({ progress }) => {
          const pct = Math.min(Math.round(progress * 100), 100);
          setState((prev) => ({ ...prev, compressionProgress: pct }));
        });

        // Load FFmpeg WASM from CDN
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });

        // Write input file to FFmpeg virtual FS
        const inputName = "input" + (file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : ".mp4");
        const outputName = "compressed.mp4";
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Compress: H.264 CRF 23, fast preset, AAC 128k, scale to 1080p max
        await ffmpeg.exec([
          "-i", inputName,
          "-c:v", "libx264",
          "-crf", "23",
          "-preset", "fast",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          "-vf", "scale=-2:'min(1080,ih)'",
          "-y", outputName,
        ]);

        // Read compressed file
        const data = await ffmpeg.readFile(outputName);
        const compressedBlob = new Blob([data as BlobPart], { type: "video/mp4" });
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, "") + "_compressed.mp4", { type: "video/mp4" });

        fileToUpload = compressedFile;
        setState((prev) => ({
          ...prev,
          compressedSize: compressedFile.size,
          bytesTotal: compressedFile.size,
        }));

        // Clean up FFmpeg
        ffmpeg.terminate();

        console.info(`[FFmpeg] Compressed ${(file.size / 1024 / 1024).toFixed(1)} MB → ${(compressedFile.size / 1024 / 1024).toFixed(1)} MB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`);
      } catch (compErr) {
        // Graceful fallback — upload original file
        console.warn("[FFmpeg] Compression failed, uploading original file:", compErr);
        fileToUpload = file;
      }
    }

    // Transition to uploading phase
    setState((prev) => ({
      ...prev,
      phase: "uploading",
      fileName: file.name,
      bytesTotal: fileToUpload.size,
      compressionProgress: prev.originalSize > 0 ? 100 : 0,
      title: metadata.title,
    }));

    try {
      // 1. Create Mux direct upload URL
      const createRes = await api.post("/film/uploads/create-url", {
        title: metadata.title,
        description: metadata.description || null,
        upload_source: metadata.uploadSource || "manual",
      });

      const { upload_url, id: newUploadId } = createRes.data;
      uploadIdRef.current = newUploadId;
      setState((prev) => ({ ...prev, uploadId: newUploadId }));

      // 2. Upload file via UpChunk (chunked, resumable, auto-retry)
      speedSamplesRef.current = [{ time: performance.now(), bytes: 0 }];

      const upload = createUpload({
        endpoint: upload_url,
        file: fileToUpload,
        chunkSize: 5120,             // 5 MB chunks
        attempts: 5,                 // retry each chunk up to 5 times
        delayBeforeAttempt: 1,       // 1 second between retries
        dynamicChunkSize: true,      // adapt chunk size to connection speed
      });

      upchunkRef.current = upload;

      // ── Progress ──
      const uploadFileSize = fileToUpload.size;
      upload.on("progress", (evt: CustomEvent) => {
        const pct = Math.round(evt.detail ?? 0);
        const bytesUploaded = Math.round((pct / 100) * uploadFileSize);

        // Speed calculation with rolling samples
        const now = performance.now();
        const samples = speedSamplesRef.current;
        samples.push({ time: now, bytes: bytesUploaded });
        if (samples.length > 4) samples.shift();

        let speed = 0;
        let eta = 0;
        if (samples.length >= 2) {
          const oldest = samples[0];
          const elapsed = (now - oldest.time) / 1000;
          if (elapsed > 0) {
            speed = (bytesUploaded - oldest.bytes) / elapsed;
            const remaining = uploadFileSize - bytesUploaded;
            eta = speed > 0 ? remaining / speed : 0;
          }
        }

        setState((prev) => ({
          ...prev,
          phase: prev.phase === "paused" ? "paused" : "uploading",
          progress: pct,
          bytesUploaded,
          bytesTotal: uploadFileSize,
          speed,
          eta,
        }));
      });

      // ── Chunk retry (attemptFailure) ──
      upload.on("attemptFailure", (evt: CustomEvent) => {
        console.warn("[UpChunk] Chunk upload failed, retrying...", evt.detail);
      });

      // ── Offline detection (UpChunk native) ──
      upload.on("offline", () => {
        console.warn("[UpChunk] Browser went offline — upload paused");
        setState((prev) => ({ ...prev, phase: "paused", speed: 0, eta: 0 }));
      });

      // ── Online detection (UpChunk native) ──
      upload.on("online", () => {
        console.info("[UpChunk] Browser back online — resuming upload");
        speedSamplesRef.current = []; // reset speed samples after pause
        setState((prev) => ({ ...prev, phase: "uploading" }));
      });

      // ── Wait for success or error ──
      await new Promise<void>((resolve, reject) => {
        upload.on("success", () => {
          upchunkRef.current = null;
          resolve();
        });

        upload.on("error", (evt: CustomEvent) => {
          upchunkRef.current = null;
          reject(new Error(evt.detail?.message || "Upload failed after retries"));
        });
      });

      // 3. Notify backend upload is complete
      setState((prev) => ({ ...prev, phase: "processing", progress: 100 }));
      await api.patch(`/film/uploads/${newUploadId}/complete`);

      // 4. Start polling for Mux readiness
      pollStatus(newUploadId);
    } catch (e: unknown) {
      stopPolling();
      const msg = e instanceof Error ? e.message : "Upload failed";
      // Don't overwrite state if the user explicitly cancelled
      if (msg === "Upload cancelled") {
        setState(INITIAL_STATE);
      } else {
        setState((prev) => ({ ...prev, phase: "error", error: msg }));
      }
    }
  }, [pollStatus, stopPolling]);

  const cancelUpload = useCallback(() => {
    if (upchunkRef.current) {
      upchunkRef.current.abort();
      upchunkRef.current = null;
    }
    stopPolling();
    setState(INITIAL_STATE);
  }, [stopPolling]);

  const clearUpload = useCallback(() => {
    if (upchunkRef.current) {
      upchunkRef.current.abort();
      upchunkRef.current = null;
    }
    stopPolling();
    setState(INITIAL_STATE);
  }, [stopPolling]);

  const retryUpload = useCallback(() => {
    if (lastFileRef.current && lastMetaRef.current) {
      startUpload(lastFileRef.current, lastMetaRef.current);
    }
  }, [startUpload]);

  const actions: UploadActions = { startUpload, cancelUpload, clearUpload, retryUpload };

  return (
    <UploadContext.Provider value={{ upload: state, actions }}>
      {children}
    </UploadContext.Provider>
  );
}
