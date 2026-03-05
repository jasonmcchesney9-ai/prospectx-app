"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import api from "@/lib/api";

/* ─── Types ─── */

export type UploadPhase = "idle" | "uploading" | "processing" | "ready" | "error";

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
  /** Seconds since completion (drives auto-dismiss) */
  completedAt: number | null;
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
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedSamplesRef = useRef<SpeedSample[]>([]);
  const lastFileRef = useRef<File | null>(null);
  const lastMetaRef = useRef<{ title: string; description?: string; uploadSource?: string } | null>(null);

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

  const startUpload = useCallback(async (file: File, metadata: { title: string; description?: string; uploadSource?: string }) => {
    // Stash for retry
    lastFileRef.current = file;
    lastMetaRef.current = metadata;

    setState({
      ...INITIAL_STATE,
      phase: "uploading",
      fileName: file.name,
      bytesTotal: file.size,
      title: metadata.title,
    });

    try {
      // 1. Create Mux direct upload URL
      const createRes = await api.post("/film/uploads/create-url", {
        title: metadata.title,
        description: metadata.description || null,
        upload_source: metadata.uploadSource || "manual",
      });

      const { upload_url, id: newUploadId } = createRes.data;
      setState((prev) => ({ ...prev, uploadId: newUploadId }));

      // 2. PUT file directly to Mux via XHR
      speedSamplesRef.current = [{ time: performance.now(), bytes: 0 }];

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", upload_url);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);

            // Speed calculation with rolling 3-sample average
            const now = performance.now();
            const samples = speedSamplesRef.current;
            samples.push({ time: now, bytes: e.loaded });
            if (samples.length > 4) samples.shift();

            let speed = 0;
            let eta = 0;
            if (samples.length >= 2) {
              const oldest = samples[0];
              const elapsed = (now - oldest.time) / 1000;
              if (elapsed > 0) {
                speed = (e.loaded - oldest.bytes) / elapsed;
                const remaining = e.total - e.loaded;
                eta = speed > 0 ? remaining / speed : 0;
              }
            }

            setState((prev) => ({
              ...prev,
              progress: pct,
              bytesUploaded: e.loaded,
              bytesTotal: e.total,
              speed,
              eta,
            }));
          }
        };

        xhr.onload = () => {
          xhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          xhrRef.current = null;
          reject(new Error("Upload network error"));
        };

        xhr.onabort = () => {
          xhrRef.current = null;
          reject(new Error("Upload cancelled"));
        };

        xhr.send(file);
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
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    stopPolling();
    setState(INITIAL_STATE);
  }, [stopPolling]);

  const clearUpload = useCallback(() => {
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
