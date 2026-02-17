"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Users,
  Building2,
  FileText,
  Upload,
  BarChart3,
  Trophy,
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Settings,
  UserPlus,
  ClipboardList,
  BookOpen,
  Swords,
  CheckSquare,
  Database,
  Target,
  GraduationCap,
  Shield,
  PenTool,
} from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import { useBenchTalk } from "./BenchTalkProvider";
import PXIIcon from "./PXIIcon";

const NAV_ITEMS_LEFT = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Building2 },
];

const NAV_ITEMS_RIGHT = [
  { href: "/players", label: "Players", icon: Users },
  { href: "/reports", label: "Reports", icon: FileText },
];

const COACHING_ITEMS = [
  { href: "/game-plans", label: "Chalk Talk", icon: Swords },
  { href: "/series", label: "Series Plans", icon: Trophy },
  { href: "/scouting", label: "Scouting List", icon: Target },
  { href: "/drills", label: "Drill Library", icon: BookOpen },
  { href: "/rink-builder", label: "Rink Builder", icon: PenTool },
  { href: "/practice-plans", label: "Practice Plans", icon: ClipboardList },
  { href: "/glossary", label: "Hockey Glossary", icon: GraduationCap },
];

const IMPORT_ITEMS = [
  { href: "/instat", label: "Import Stats (XLSX)", icon: BarChart3 },
  { href: "/players/import", label: "Import Players (CSV)", icon: UserPlus },
  { href: "/players/manage", label: "Manage Players", icon: Settings },
  { href: "/corrections", label: "Review Corrections", icon: CheckSquare },
  { href: "/my-data", label: "My Data", icon: Database },
];

function NavLink({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: React.ElementType; pathname: string }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
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
}

export default function NavBar() {
  const pathname = usePathname();
  const user = getUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isOpen: benchTalkOpen, toggleBenchTalk } = useBenchTalk();

  if (pathname === "/login") return null;

  return (
    <nav className="bg-navy text-white">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* ── Logo (far left) ── */}
          <Link href="/" className="flex items-center gap-2 mr-8 shrink-0">
            <span className="font-oswald text-lg font-bold tracking-widest uppercase">
              <span className="text-teal">Prospect</span><span className="text-orange">X</span>
            </span>
            <span className="hidden lg:inline font-oswald text-xs tracking-wider text-white/60 uppercase">
              Intelligence
            </span>
          </Link>

          {/* ── Center Nav: Leagues, Teams, Players, Bench Talk, Reports, Imports ── */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV_ITEMS_LEFT.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}

            {/* Bench Talk Toggle (center position) */}
            <button
              onClick={toggleBenchTalk}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-oswald font-bold uppercase tracking-wider transition-colors ${
                benchTalkOpen
                  ? "bg-orange/20 text-orange"
                  : "text-orange hover:bg-orange/10"
              }`}
            >
              <PXIIcon size={20} />
              Bench Talk
            </button>

            {NAV_ITEMS_RIGHT.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}

            <CoachingDropdown pathname={pathname} />
            <ImportDropdown pathname={pathname} />
          </div>

          {/* ── User + Tier Badge + Logout (far right) ── */}
          <div className="hidden md:flex items-center gap-3 ml-8 shrink-0">
            {user && (
              <>
                <span className="text-sm text-white/60">
                  {user.first_name} {user.last_name}
                </span>
                <Link
                  href="/pricing"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/20 text-teal uppercase font-oswald tracking-wider hover:bg-teal/30 transition-colors"
                >
                  {user.subscription_tier || "Rookie"}
                </Link>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      pathname.startsWith("/admin")
                        ? "text-orange"
                        : "text-orange/70 hover:text-orange"
                    }`}
                  >
                    <Shield size={14} />
                    Admin
                  </Link>
                )}
              </>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>

          {/* ── Mobile Toggle ── */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            <button
              onClick={toggleBenchTalk}
              className={`p-2 rounded-lg transition-all ${
                benchTalkOpen ? "bg-orange/20" : "hover:bg-orange/10"
              }`}
            >
              <PXIIcon size={24} />
            </button>
            <button
              className="text-white/70 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4">
          {[...NAV_ITEMS_LEFT, ...NAV_ITEMS_RIGHT].map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
          <div className="border-t border-white/10 mt-1 pt-1">
            <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
              Coaching
            </p>
            {COACHING_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
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
          </div>
          <div className="border-t border-white/10 mt-1 pt-1">
            <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
              Import & Manage
            </p>
            {IMPORT_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
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
          </div>
          {user?.role === "admin" && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                  pathname.startsWith("/admin") ? "text-orange" : "text-orange/70"
                }`}
              >
                <Shield size={16} />
                Admin Dashboard
              </Link>
            </div>
          )}
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

function CoachingDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = COACHING_ITEMS.some((item) => pathname.startsWith(item.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <ClipboardList size={16} />
        Coaching
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {COACHING_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ImportDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = IMPORT_ITEMS.some((item) => pathname === item.href);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/10 text-teal"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Upload size={16} />
        Imports
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {IMPORT_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-teal"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
