"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, Building2, Users, ChevronRight } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Scout");
  const [subject, setSubject] = useState("General Question");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailSubject = encodeURIComponent(
      `[ProspectX ${subject}] from ${name}`
    );
    const mailBody = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nRole: ${role}\nSubject: ${subject}\n\n${message}`
    );
    window.location.href = `mailto:hello@prospectx.io?subject=${mailSubject}&body=${mailBody}`;
    setSubmitted(true);
  };

  const inputClass =
    "w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:border-teal/50 focus:ring-0 focus:outline-none transition-colors";

  const selectClass =
    "w-full px-4 py-3 bg-white/[0.05] border border-white/10 rounded-xl text-sm text-white focus:border-teal/50 focus:ring-0 focus:outline-none transition-colors appearance-none";

  return (
    <MarketingLayout>
      {/* ── Hero ──────────────────────────────────────── */}
      <section className="text-center py-16 sm:py-20 px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl font-oswald font-bold text-white">
          Get in Touch
        </h1>
        <p className="text-white/50 text-sm mt-3 max-w-lg mx-auto">
          Questions about pricing, demos, or partnerships — we respond within 1
          business day.
        </p>
      </section>

      {/* ── Contact Form ──────────────────────────────── */}
      <section className="max-w-lg mx-auto px-4 sm:px-6 pb-12">
        {submitted ? (
          <div className="bg-white/[0.02] border border-teal/30 rounded-2xl p-8 text-center">
            <CheckCircle2 size={48} className="text-teal mx-auto mb-4" />
            <h2 className="font-oswald text-xl font-bold text-white">
              Message Sent
            </h2>
            <p className="text-white/50 text-sm mt-2">
              Thanks for reaching out. We&rsquo;ll get back to you within 24
              hours.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 text-sm text-teal hover:text-teal/80 underline underline-offset-2"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
          >
            {/* Name */}
            <div>
              <label className="block font-oswald text-xs uppercase tracking-wider text-white/60 mb-1.5">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block font-oswald text-xs uppercase tracking-wider text-white/60 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            {/* Role */}
            <div>
              <label className="block font-oswald text-xs uppercase tracking-wider text-white/60 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={selectClass}
              >
                {[
                  "Scout",
                  "Coach",
                  "GM",
                  "Parent",
                  "Agent",
                  "Broadcaster",
                  "Organization",
                  "Other",
                ].map((r) => (
                  <option key={r} value={r} className="bg-navy text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block font-oswald text-xs uppercase tracking-wider text-white/60 mb-1.5">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={selectClass}
              >
                {[
                  "General Question",
                  "Pricing",
                  "Enterprise Demo",
                  "Partnership",
                  "Bug Report",
                  "Other",
                ].map((s) => (
                  <option key={s} value={s} className="bg-navy text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="block font-oswald text-xs uppercase tracking-wider text-white/60 mb-1.5">
                Message
              </label>
              <textarea
                required
                minLength={20}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us how we can help..."
                className={inputClass}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 bg-teal text-white font-oswald font-semibold uppercase tracking-wider rounded-xl hover:bg-teal/90 transition-colors text-sm flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Mail size={16} />
              Send Message
            </button>
          </form>
        )}
      </section>

      {/* ── Alt Contact Cards ─────────────────────────── */}
      <section className="max-w-lg mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/pricing"
            className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                <Building2 size={16} className="text-teal" />
              </div>
              <h3 className="font-oswald text-sm font-semibold text-white uppercase tracking-wider">
                Enterprise Sales
              </h3>
            </div>
            <p className="text-xs text-white/50">
              Need a team or organization plan? Let&rsquo;s talk.
            </p>
            <div className="flex items-center gap-1 mt-3 text-xs text-teal group-hover:text-teal/80">
              View plans <ChevronRight size={12} />
            </div>
          </Link>

          <Link
            href="/login"
            className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange/10 flex items-center justify-center">
                <Users size={16} className="text-orange" />
              </div>
              <h3 className="font-oswald text-sm font-semibold text-white uppercase tracking-wider">
                Support
              </h3>
            </div>
            <p className="text-xs text-white/50">
              Already a user? Log in and use in-app support.
            </p>
            <div className="flex items-center gap-1 mt-3 text-xs text-teal group-hover:text-teal/80">
              Sign in <ChevronRight size={12} />
            </div>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
