"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

// ── Types ────────────────────────────────────────────────────
export type TelestrationTool = "arrow" | "circle" | "freehand" | "line" | "text" | "eraser";

export interface TelestrationCanvasProps {
  active: boolean;
  tool: TelestrationTool;
  color: string;
  lineWidth: number;
  opacity: number;
  fadeAfterMs?: number;
  onAnnotationSave?: (dataUrl: string) => void;
  style?: React.CSSProperties;
}

export interface TelestrationCanvasHandle {
  clear: () => void;
  getDataUrl: () => string;
}

// ── Component ────────────────────────────────────────────────
const TelestrationCanvas = forwardRef<TelestrationCanvasHandle, TelestrationCanvasProps>(
  function TelestrationCanvas(
    {
      active,
      tool,
      color = "#00B5B8",
      lineWidth = 3,
      opacity = 0.9,
      fadeAfterMs = 0,
      onAnnotationSave,
      style,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const offscreenRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const lastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textInputRef = useRef<HTMLInputElement | null>(null);

    const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);

    // ── Helpers ──────────────────────────────────────────────
    const getOffscreen = useCallback((): HTMLCanvasElement => {
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement("canvas");
      }
      const c = canvasRef.current;
      if (c && offscreenRef.current) {
        if (offscreenRef.current.width !== c.width || offscreenRef.current.height !== c.height) {
          // Preserve existing content when resizing
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = offscreenRef.current.width;
          tempCanvas.height = offscreenRef.current.height;
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) tempCtx.drawImage(offscreenRef.current, 0, 0);
          offscreenRef.current.width = c.width;
          offscreenRef.current.height = c.height;
          const osCtx = offscreenRef.current.getContext("2d");
          if (osCtx) osCtx.drawImage(tempCanvas, 0, 0);
        }
      }
      return offscreenRef.current;
    }, []);

    const clearAll = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      const os = offscreenRef.current;
      if (os) {
        const osCtx = os.getContext("2d");
        if (osCtx) osCtx.clearRect(0, 0, os.width, os.height);
      }
    }, []);

    const cancelFade = useCallback(() => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    }, []);

    const startFade = useCallback(() => {
      if (!fadeAfterMs || fadeAfterMs <= 0) return;
      cancelFade();
      fadeTimerRef.current = setTimeout(() => {
        const c = canvasRef.current;
        if (!c) return;
        let step = 0;
        const totalSteps = 20;
        fadeIntervalRef.current = setInterval(() => {
          step++;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.globalAlpha = 1.0 - step / totalSteps;
          const os = getOffscreen();
          ctx.drawImage(os, 0, 0);
          ctx.globalAlpha = 1.0;
          if (step >= totalSteps) {
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
            clearAll();
          }
        }, 40);
      }, fadeAfterMs);
    }, [fadeAfterMs, cancelFade, getOffscreen, clearAll]);

    // ── Imperative handle ────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          cancelFade();
          clearAll();
        },
        getDataUrl: () => {
          const c = canvasRef.current;
          if (!c) return "";
          return c.toDataURL("image/png");
        },
      }),
      [cancelFade, clearAll],
    );

    // ── ResizeObserver ───────────────────────────────────────
    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const sync = () => {
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (w > 0 && h > 0 && (c.width !== w || c.height !== h)) {
          c.width = w;
          c.height = h;
          // Re-sync offscreen too
          getOffscreen();
          // Redraw offscreen to main
          const ctx = c.getContext("2d");
          const os = offscreenRef.current;
          if (ctx && os) ctx.drawImage(os, 0, 0);
        }
      };
      sync();
      const ro = new ResizeObserver(sync);
      ro.observe(c);
      return () => ro.disconnect();
    }, [getOffscreen]);

    // ── Cleanup fade timers on unmount ───────────────────────
    useEffect(() => {
      return () => cancelFade();
    }, [cancelFade]);

    // ── Draw helpers ─────────────────────────────────────────
    const setupCtx = useCallback(
      (ctx: CanvasRenderingContext2D, pressure?: number) => {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = pressure && pressure > 0 ? lineWidth * (1 + pressure) : lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = opacity;
      },
      [color, lineWidth, opacity],
    );

    const drawArrowhead = useCallback(
      (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      },
      [],
    );

    const redrawFromOffscreen = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      const os = getOffscreen();
      ctx.drawImage(os, 0, 0);
    }, [getOffscreen]);

    const commitToOffscreen = useCallback(
      (drawFn: (ctx: CanvasRenderingContext2D) => void) => {
        const os = getOffscreen();
        const osCtx = os.getContext("2d");
        if (osCtx) drawFn(osCtx);
      },
      [getOffscreen],
    );

    // ── Pointer event handlers ───────────────────────────────
    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!active) return;
        e.preventDefault();
        cancelFade();

        const c = canvasRef.current;
        if (!c) return;

        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (tool === "text") {
          setTextInputPos({ x, y });
          return;
        }

        drawingRef.current = true;
        startRef.current = { x, y };
        lastRef.current = { x, y };

        if (tool === "freehand") {
          const ctx = c.getContext("2d");
          if (!ctx) return;
          // Begin path on offscreen for freehand (drawn directly to offscreen)
          const os = getOffscreen();
          const osCtx = os.getContext("2d");
          if (!osCtx) return;
          const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : undefined;
          setupCtx(osCtx, pressure);
          osCtx.beginPath();
          osCtx.moveTo(x, y);
        }
      },
      [active, tool, cancelFade, getOffscreen, setupCtx],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!active || !drawingRef.current) return;
        e.preventDefault();

        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        if (!ctx) return;

        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : undefined;

        if (tool === "freehand") {
          // Draw smoothed curve directly to offscreen
          const os = getOffscreen();
          const osCtx = os.getContext("2d");
          if (!osCtx) return;
          setupCtx(osCtx, pressure);
          const midX = (x + lastRef.current.x) / 2;
          const midY = (y + lastRef.current.y) / 2;
          osCtx.quadraticCurveTo(lastRef.current.x, lastRef.current.y, midX, midY);
          osCtx.stroke();
          // Mirror to main canvas
          redrawFromOffscreen();
          lastRef.current = { x, y };
          return;
        }

        if (tool === "eraser") {
          // Erase on both canvases
          const eraseR = 20;
          ctx.clearRect(x - eraseR, y - eraseR, eraseR * 2, eraseR * 2);
          const os = getOffscreen();
          const osCtx = os.getContext("2d");
          if (osCtx) osCtx.clearRect(x - eraseR, y - eraseR, eraseR * 2, eraseR * 2);
          lastRef.current = { x, y };
          return;
        }

        // Preview tools (arrow, circle, line) — redraw from offscreen + preview
        redrawFromOffscreen();
        setupCtx(ctx, pressure);

        if (tool === "arrow" || tool === "line") {
          ctx.beginPath();
          ctx.moveTo(startRef.current.x, startRef.current.y);
          ctx.lineTo(x, y);
          ctx.stroke();
          if (tool === "arrow") {
            drawArrowhead(ctx, startRef.current.x, startRef.current.y, x, y);
          }
        } else if (tool === "circle") {
          const radius = Math.sqrt(
            Math.pow(x - startRef.current.x, 2) + Math.pow(y - startRef.current.y, 2),
          );
          ctx.beginPath();
          ctx.arc(startRef.current.x, startRef.current.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        lastRef.current = { x, y };
      },
      [active, tool, getOffscreen, setupCtx, redrawFromOffscreen, drawArrowhead],
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!active || !drawingRef.current) return;
        e.preventDefault();
        drawingRef.current = false;

        const c = canvasRef.current;
        if (!c) return;

        const rect = c.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : undefined;

        if (tool === "freehand") {
          // Path already committed to offscreen during move
          redrawFromOffscreen();
          startFade();
          if (onAnnotationSave) onAnnotationSave(c.toDataURL("image/png"));
          return;
        }

        if (tool === "eraser") {
          startFade();
          return;
        }

        // Commit final stroke to offscreen for arrow, circle, line
        commitToOffscreen((osCtx) => {
          setupCtx(osCtx, pressure);
          if (tool === "arrow" || tool === "line") {
            osCtx.beginPath();
            osCtx.moveTo(startRef.current.x, startRef.current.y);
            osCtx.lineTo(x, y);
            osCtx.stroke();
            if (tool === "arrow") {
              drawArrowhead(osCtx, startRef.current.x, startRef.current.y, x, y);
            }
          } else if (tool === "circle") {
            const radius = Math.sqrt(
              Math.pow(x - startRef.current.x, 2) + Math.pow(y - startRef.current.y, 2),
            );
            osCtx.beginPath();
            osCtx.arc(startRef.current.x, startRef.current.y, radius, 0, Math.PI * 2);
            osCtx.stroke();
          }
        });

        redrawFromOffscreen();
        startFade();
        if (onAnnotationSave) onAnnotationSave(c.toDataURL("image/png"));
      },
      [active, tool, setupCtx, drawArrowhead, commitToOffscreen, redrawFromOffscreen, startFade, onAnnotationSave],
    );

    const handlePointerLeave = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        // Treat leave as pointer up
        handlePointerUp(e);
      },
      [handlePointerUp],
    );

    // ── Text input handler ───────────────────────────────────
    const commitText = useCallback(
      (value: string) => {
        if (!value.trim() || !textInputPos) {
          setTextInputPos(null);
          return;
        }
        const c = canvasRef.current;
        if (!c) {
          setTextInputPos(null);
          return;
        }

        commitToOffscreen((osCtx) => {
          osCtx.globalAlpha = opacity;
          osCtx.fillStyle = color;
          osCtx.font = "bold 18px Arial";
          osCtx.fillText(value, textInputPos.x, textInputPos.y);
        });

        redrawFromOffscreen();
        setTextInputPos(null);
        startFade();
        if (onAnnotationSave) onAnnotationSave(c.toDataURL("image/png"));
      },
      [textInputPos, color, opacity, commitToOffscreen, redrawFromOffscreen, startFade, onAnnotationSave],
    );

    // Focus text input when it appears
    useEffect(() => {
      if (textInputPos && textInputRef.current) {
        textInputRef.current.focus();
      }
    }, [textInputPos]);

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: active ? "auto" : "none",
          zIndex: active ? 20 : -1,
          ...style,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            cursor: active
              ? tool === "eraser"
                ? "crosshair"
                : tool === "text"
                  ? "text"
                  : "crosshair"
              : "default",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />
        {/* Text input overlay */}
        {textInputPos && active && (
          <input
            ref={textInputRef}
            type="text"
            style={{
              position: "absolute",
              left: textInputPos.x,
              top: textInputPos.y - 12,
              background: "rgba(0,0,0,0.6)",
              border: `1px solid ${color}`,
              borderRadius: 3,
              color: color,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "Arial, sans-serif",
              padding: "2px 6px",
              outline: "none",
              minWidth: 80,
              zIndex: 30,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitText((e.target as HTMLInputElement).value);
              } else if (e.key === "Escape") {
                setTextInputPos(null);
              }
            }}
            onBlur={(e) => commitText(e.target.value)}
          />
        )}
      </div>
    );
  },
);

export default TelestrationCanvas;
