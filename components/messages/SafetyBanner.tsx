"use client";

import { Shield } from "lucide-react";

export default function SafetyBanner() {
  return (
    <div className="bg-navy rounded-xl px-5 py-3 flex items-center gap-3">
      <Shield size={18} className="text-teal shrink-0" />
      <div>
        <span className="font-oswald text-xs font-bold text-white uppercase tracking-wider">
          Message Safety
        </span>
        <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">
          All messages are logged. External contacts require parental approval. Youth athletes are protected.
        </p>
      </div>
    </div>
  );
}
