"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Upload,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { getUser, logout } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Players", icon: Users },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/players/import", label: "Import", icon: Upload },
];

export default function NavBar() {
  const pathname = usePathname();
  const user = getUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/login") return null;

  return (
    <nav className="bg-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-oswald text-lg font-bold tracking-widest uppercase text-teal">
              ProspectX
            </span>
            <span className="hidden sm:inline font-oswald text-xs tracking-wider text-white/60 uppercase">
              Intelligence
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-white/10 text-teal"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <span className="text-sm text-white/60">
                {user.first_name} {user.last_name}
              </span>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-white/70 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                  active ? "text-teal" : "text-white/70"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-3 text-sm text-white/50 hover:text-white w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
