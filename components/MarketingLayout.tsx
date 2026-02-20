"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-navy flex flex-col">
      {/* ── Sticky Nav ──────────────────────────────── */}
      <nav className="bg-navy border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-oswald text-2xl font-bold tracking-widest text-teal uppercase">
              Prospect<span className="text-orange">X</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  isActive(link.href)
                    ? "text-teal underline underline-offset-4"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/login?mode=register"
              className="text-sm font-oswald font-semibold uppercase tracking-wider px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile: CTA + hamburger */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/login?mode=register"
              className="text-xs font-oswald font-semibold uppercase tracking-wider px-3 py-1.5 bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors"
            >
              Get Started
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-white/70 hover:text-white p-1"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-white/10 px-4 pb-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center py-3 text-sm font-medium ${
                  isActive(link.href) ? "text-teal" : "text-white/70"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex items-center py-3 text-sm font-medium text-white/70"
            >
              Sign In
            </Link>
          </div>
        )}
      </nav>

      {/* ── Page Content ────────────────────────────── */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="bg-navy border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <span className="font-oswald text-xl font-bold tracking-widest text-teal uppercase">
                Prospect<span className="text-orange">X</span>
              </span>
              <p className="text-sm text-white/40 mt-2">
                The intelligence layer for hockey.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-oswald text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
                Product
              </h4>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/40 hover:text-white/70 block py-1 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-oswald text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
                Legal
              </h4>
              <a href="#" className="text-sm text-white/40 hover:text-white/70 block py-1 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-white/40 hover:text-white/70 block py-1 transition-colors">
                Terms of Service
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-white/30">
            &copy; 2026 ProspectX. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
