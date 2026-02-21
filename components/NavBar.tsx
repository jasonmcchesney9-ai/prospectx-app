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
  ClipboardCheck,
  ClipboardList,
  BookOpen,
  Swords,
  CheckSquare,
  Database,
  Target,
  GraduationCap,
  Shield,
  PenTool,
  Radio,
  Calendar,
  UserCheck,
  Heart,
  Briefcase,
  MessageSquare,
  Eye,
  Search,
} from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import api from "@/lib/api";
import { useBenchTalk } from "./BenchTalkProvider";
import PXIIcon from "./PXIIcon";
import PXIBadge from "./PXIBadge";
import PlayerSearchDropdown from "./PlayerSearchDropdown";

// ── Role Group Mapping ─────────────────────────────────────────
// Maps hockey_role to a nav group (PRO, MEDIA, FAMILY, AGENT)
type RoleGroup = "PRO" | "MEDIA" | "FAMILY" | "AGENT";

const ROLE_GROUP_MAP: Record<string, RoleGroup> = {
  scout: "PRO",
  coach: "PRO",
  gm: "PRO",
  player: "FAMILY", // Players see the family view
  parent: "FAMILY",
  broadcaster: "MEDIA",
  producer: "MEDIA",
  agent: "AGENT",
};

const ROLE_GROUP_COLORS: Record<RoleGroup, string> = {
  PRO: "bg-teal/20 text-teal",
  MEDIA: "bg-orange/20 text-orange",
  FAMILY: "bg-[#3B6B8A]/20 text-[#3B6B8A]",
  AGENT: "bg-[#475569]/20 text-[#475569]",
};

function getRoleGroup(hockeyRole?: string): RoleGroup {
  return ROLE_GROUP_MAP[hockeyRole || "scout"] || "PRO";
}

// ── Nav Item Definitions ──────────────────────────────────────
type NavItem = { href: string; label: string; icon: React.ElementType; badge?: number };

// PRO nav: full access — most items now in dropdowns
const PRO_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leagues", label: "Leagues", icon: Trophy },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];
const PRO_NAV_RIGHT: NavItem[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

// MEDIA nav
const MEDIA_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teams", label: "Teams", icon: Building2 },
  { href: "/players", label: "Players", icon: Users },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];
const MEDIA_NAV_RIGHT: NavItem[] = [
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

// FAMILY nav
const FAMILY_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-player", label: "My Player", icon: Heart },
  { href: "/schedule", label: "Schedule", icon: Calendar },
];
const FAMILY_NAV_RIGHT: NavItem[] = [
  { href: "/player-guide", label: "Guide", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

// AGENT nav
const AGENT_NAV_LEFT: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-clients", label: "Clients", icon: Briefcase },
  { href: "/players", label: "Players", icon: Users },
];
const AGENT_NAV_RIGHT: NavItem[] = [
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

// Players dropdown items (PRO only)
const PLAYERS_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/players", label: "All Players", icon: Users },
  { href: "/players/manage", label: "Manage Players", icon: Settings },
  { href: "/scouting", label: "Scouting List", icon: Target },
];

// Scouting dropdown items (PRO only)
const SCOUTING_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/scout-notes", label: "Scout Notes", icon: ClipboardCheck },
  { href: "/game-plans", label: "Chalk Talk", icon: Swords },
];

// Reports dropdown items (PRO only)
const REPORTS_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/reports", label: "Generated Reports", icon: FileText },
  { href: "/reports/library", label: "Report Library", icon: BookOpen },
  { href: "/reports/custom", label: "Custom Report", icon: PenTool },
  { href: "/reports/generate", label: "Generate Report", icon: FileText },
];

// Teams dropdown items (PRO only)
const TEAMS_DROPDOWN_ITEMS: NavItem[] = [
  { href: "/teams", label: "All Teams", icon: Building2 },
  { href: "/series", label: "Series Plans", icon: Trophy },
  { href: "/team-systems", label: "Team Systems", icon: Shield },
];

// Coaching items (PRO only)
const COACHING_ITEMS: NavItem[] = [
  { href: "/drills", label: "Drill Library", icon: BookOpen },
  { href: "/rink-builder", label: "Rink Builder", icon: PenTool },
  { href: "/practice-plans", label: "Practice Plans", icon: ClipboardList },
  { href: "/glossary", label: "Hockey Glossary", icon: GraduationCap },
];

// Broadcast items (PRO dropdown — MEDIA gets a direct link)
const BROADCAST_ITEMS: NavItem[] = [
  { href: "/broadcast", label: "Broadcast Hub", icon: Radio },
];

// Import items (PRO only)
const IMPORT_ITEMS: NavItem[] = [
  { href: "/instat", label: "Import Stats (XLSX)", icon: BarChart3 },
  { href: "/imports", label: "Stat Normalizer", icon: Upload },
  { href: "/players/import", label: "Import Players (CSV)", icon: UserPlus },
  { href: "/corrections", label: "Review Corrections", icon: CheckSquare },
  { href: "/my-data", label: "My Data", icon: Database },
];

// ── Role-aware nav items function ──────────────────────────────
function getNavItems(group: RoleGroup): { left: NavItem[]; right: NavItem[]; showPlayersDropdown: boolean; showScoutingDropdown: boolean; showReportsDropdown: boolean; showCoaching: boolean; showImports: boolean; showBroadcastDropdown: boolean; showTeamsDropdown: boolean } {
  switch (group) {
    case "PRO":
      return { left: PRO_NAV_LEFT, right: PRO_NAV_RIGHT, showPlayersDropdown: true, showScoutingDropdown: true, showReportsDropdown: true, showCoaching: true, showImports: true, showBroadcastDropdown: true, showTeamsDropdown: true };
    case "MEDIA":
      return { left: MEDIA_NAV_LEFT, right: MEDIA_NAV_RIGHT, showPlayersDropdown: false, showScoutingDropdown: false, showReportsDropdown: false, showCoaching: false, showImports: false, showBroadcastDropdown: false, showTeamsDropdown: false };
    case "FAMILY":
      return { left: FAMILY_NAV_LEFT, right: FAMILY_NAV_RIGHT, showPlayersDropdown: false, showScoutingDropdown: false, showReportsDropdown: false, showCoaching: false, showImports: false, showBroadcastDropdown: false, showTeamsDropdown: false };
    case "AGENT":
      return { left: AGENT_NAV_LEFT, right: AGENT_NAV_RIGHT, showPlayersDropdown: false, showScoutingDropdown: false, showReportsDropdown: false, showCoaching: false, showImports: false, showBroadcastDropdown: false, showTeamsDropdown: false };
  }
}

// ── NavLink Component ──────────────────────────────────────────
function NavLink({ href, label, icon: Icon, pathname, badge }: { href: string; label: string; icon: React.ElementType; pathname: string; badge?: number }) {
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
      {badge != null && badge > 0 && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-teal text-white text-[9px] font-bold leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ── Role Override Mapping (admin preview → hockey_role equivalent) ───
const ROLE_GROUP_TO_HOCKEY_ROLE: Record<RoleGroup, string> = {
  PRO: "scout",
  FAMILY: "parent",
  MEDIA: "broadcaster",
  AGENT: "agent",
};

// ── Main NavBar ────────────────────────────────────────────────
export default function NavBar() {
  const pathname = usePathname();
  const user = getUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [agentClientCount, setAgentClientCount] = useState<number>(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);
  const { isOpen: benchTalkOpen, toggleBenchTalk, roleOverride, setRoleOverride } = useBenchTalk();

  // Effective role: admin override takes priority, otherwise real role
  const effectiveHockeyRole = roleOverride || user?.hockey_role;
  const roleGroup = getRoleGroup(effectiveHockeyRole);
  const isAgent = roleGroup === "AGENT";
  const hasMessages = roleGroup === "MEDIA" || roleGroup === "FAMILY" || roleGroup === "AGENT";

  // Fetch client count for agent badge
  useEffect(() => {
    if (!isAgent) return;
    api.get("/agent/clients")
      .then((res) => setAgentClientCount(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
  }, [isAgent]);

  // Fetch unread message count (poll every 30s)
  useEffect(() => {
    if (!hasMessages) return;
    const fetchUnread = () => {
      api.get("/api/messages/unread-count")
        .then((res) => setUnreadMsgCount(res.data?.count || 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [hasMessages]);

  if (pathname === "/login") return null;

  const navConfig = getNavItems(roleGroup);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isPreviewing = !!roleOverride;

  // Inject badge into agent Clients nav item
  if (isAgent && agentClientCount > 0) {
    navConfig.left = navConfig.left.map((item) =>
      item.href === "/my-clients" ? { ...item, badge: agentClientCount } : item
    );
  }

  // Inject unread badge into Messages nav item
  if (hasMessages && unreadMsgCount > 0) {
    const injectBadge = (items: NavItem[]) =>
      items.map((item) =>
        item.href === "/messages" ? { ...item, badge: unreadMsgCount } : item
      );
    navConfig.left = injectBadge(navConfig.left);
    navConfig.right = injectBadge(navConfig.right);
  }

  return (
    <nav className="bg-navy text-white sticky top-0 z-50">
      {/* Admin Preview Banner */}
      {isPreviewing && (
        <div className="bg-orange/90 text-white px-4 py-1 flex items-center justify-center gap-3 text-xs font-oswald uppercase tracking-wider">
          <Eye size={12} />
          <span>Previewing as: <strong>{roleGroup}</strong></span>
          <button
            onClick={() => setRoleOverride(null)}
            className="ml-2 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-[10px] font-bold"
          >
            Exit Preview
          </button>
        </div>
      )}
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

          {/* ── Center Nav ── */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navConfig.left.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}

            {/* Players dropdown (PRO only) */}
            {navConfig.showPlayersDropdown && <PlayersDropdown pathname={pathname} />}

            {/* Scouting dropdown (PRO only) */}
            {navConfig.showScoutingDropdown && <ScoutingDropdown pathname={pathname} />}

            {/* Reports dropdown (PRO only) */}
            {navConfig.showReportsDropdown && <ReportsDropdown pathname={pathname} />}

            {/* Teams dropdown (PRO only) */}
            {navConfig.showTeamsDropdown && <TeamsDropdown pathname={pathname} />}

            {/* Coaching dropdown (PRO only) */}
            {navConfig.showCoaching && <CoachingDropdown pathname={pathname} />}

            {/* Broadcast dropdown (PRO only — MEDIA gets direct link in nav) */}
            {navConfig.showBroadcastDropdown && <BroadcastDropdown pathname={pathname} />}

            {/* MEDIA: direct Broadcast link */}
            {roleGroup === "MEDIA" && (
              <NavLink href="/broadcast" label="Broadcast" icon={Radio} pathname={pathname} />
            )}

            {/* Imports dropdown (PRO only) */}
            {navConfig.showImports && <ImportDropdown pathname={pathname} />}

            {navConfig.right.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </div>

          {/* ── User + Role Badge + Tier Badge + Logout (far right) ── */}
          <div className="hidden md:flex items-center gap-3 ml-8 shrink-0">
            {user && (
              <>
                <span className="text-sm text-white/60">
                  {user.first_name} {user.last_name}
                </span>
                {/* Role Group Badge */}
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-oswald tracking-wider ${ROLE_GROUP_COLORS[roleGroup]}`}
                >
                  {roleGroup}
                </span>
                {/* Admin Role Switcher */}
                {isAdmin && <AdminRoleSwitcher currentGroup={roleGroup} onSwitch={(group) => setRoleOverride(ROLE_GROUP_TO_HOCKEY_ROLE[group])} onReset={() => setRoleOverride(null)} isPreviewing={isPreviewing} />}
                {/* Subscription Tier Badge */}
                <Link
                  href="/pricing"
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/20 text-teal uppercase font-oswald tracking-wider hover:bg-teal/30 transition-colors"
                >
                  {user.subscription_tier || "Rookie"}
                </Link>
                {(user.role === "admin" || user.role === "superadmin") && (
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
                {user.role === "superadmin" && (
                  <Link
                    href="/superadmin"
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      pathname.startsWith("/superadmin")
                        ? "text-teal"
                        : "text-teal/70 hover:text-teal"
                    }`}
                  >
                    <Shield size={14} />
                    Super
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
            {/* Role badge (mobile) */}
            {user && (
              <span
                className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase font-oswald tracking-wider ${ROLE_GROUP_COLORS[roleGroup]}`}
              >
                {roleGroup}
              </span>
            )}
            {/* Search icon (mobile) */}
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className={`p-2 rounded-lg transition-colors ${
                mobileSearchOpen ? "bg-white/10 text-teal" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Search size={18} />
            </button>
            <button
              onClick={toggleBenchTalk}
              className={`p-2 rounded-lg transition-all ${
                benchTalkOpen ? "bg-orange/20" : "hover:bg-orange/10"
              }`}
            >
              <PXIBadge size={22} variant="nav" showDot={true} />
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

      {/* ── Row 2: Action Bar ── */}
      <div className="hidden md:flex items-center h-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 relative">
        {/* Left: Player Search */}
        <div className="flex-1">
          <PlayerSearchDropdown />
        </div>

        {/* Center: Bench Talk (absolute centered) */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <button
            onClick={toggleBenchTalk}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-oswald font-bold uppercase tracking-wider transition-colors ${
              benchTalkOpen
                ? "bg-orange/20 text-orange"
                : "text-orange hover:bg-orange/10"
            }`}
          >
            <PXIBadge size={18} variant="nav" showDot={true} />
            Bench Talk
          </button>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex-1 flex justify-end">
          <Link
            href="/scout-notes"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-oswald font-bold uppercase tracking-wider text-teal/70 hover:text-teal hover:bg-teal/10 transition-colors"
          >
            <ClipboardCheck size={14} />
            + New Note
          </Link>
        </div>
      </div>

      {/* ── Mobile Search Bar ── */}
      {mobileSearchOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-3">
          <PlayerSearchDropdown />
        </div>
      )}

      {/* ── Mobile Menu (role-filtered) ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4">
          {[...navConfig.left, ...navConfig.right].map(({ href, label, icon: Icon, badge }) => {
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
                {badge != null && badge > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-teal text-white text-[9px] font-bold leading-none">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* MEDIA: Broadcast link in mobile */}
          {roleGroup === "MEDIA" && (
            <Link
              href="/broadcast"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium ${
                pathname.startsWith("/broadcast") ? "text-teal" : "text-white/70"
              }`}
            >
              <Radio size={16} />
              Broadcast
            </Link>
          )}

          {/* Players section (PRO only — mobile) */}
          {navConfig.showPlayersDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Players
              </p>
              {PLAYERS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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
          )}

          {/* Scouting section (PRO only — mobile) */}
          {navConfig.showScoutingDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Scouting
              </p>
              {SCOUTING_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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
          )}

          {/* Reports section (PRO only — mobile) */}
          {navConfig.showReportsDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Reports
              </p>
              {REPORTS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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
          )}

          {/* Teams section (PRO only — mobile) */}
          {navConfig.showTeamsDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Teams
              </p>
              {TEAMS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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
          )}

          {/* Coaching section (PRO only) */}
          {navConfig.showCoaching && (
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
          )}

          {/* Broadcast section (PRO mobile) */}
          {navConfig.showBroadcastDropdown && (
            <div className="border-t border-white/10 mt-1 pt-1">
              <p className="px-3 py-2 text-xs font-oswald uppercase tracking-wider text-white/30">
                Broadcast
              </p>
              {BROADCAST_ITEMS.map(({ href, label, icon: Icon }) => {
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
          )}

          {/* Import & Manage section (PRO only) */}
          {navConfig.showImports && (
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
          )}

          {/* Admin (all roles if admin) */}
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

// ── Dropdown Components ────────────────────────────────────────

function PlayersDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = PLAYERS_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        <Users size={16} />
        Players
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {PLAYERS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function ScoutingDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = SCOUTING_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        <ClipboardCheck size={16} />
        Scouting
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {SCOUTING_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function ReportsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = REPORTS_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        <FileText size={16} />
        Reports
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {REPORTS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function TeamsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = TEAMS_DROPDOWN_ITEMS.some((item) => pathname.startsWith(item.href));

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
        <Building2 size={16} />
        Teams
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {TEAMS_DROPDOWN_ITEMS.map(({ href, label, icon: Icon }) => {
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

function BroadcastDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = pathname.startsWith("/broadcast");

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
        <Radio size={16} />
        Broadcast
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {BROADCAST_ITEMS.map(({ href, label, icon: Icon }) => {
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

function AdminRoleSwitcher({ currentGroup, onSwitch, onReset, isPreviewing }: { currentGroup: RoleGroup; onSwitch: (group: RoleGroup) => void; onReset: () => void; isPreviewing: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const groups: { group: RoleGroup; label: string; desc: string }[] = [
    { group: "PRO", label: "PRO", desc: "Scout / Coach / GM" },
    { group: "FAMILY", label: "FAMILY", desc: "Parent" },
    { group: "MEDIA", label: "MEDIA", desc: "Broadcaster" },
    { group: "AGENT", label: "AGENT", desc: "Agent" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-oswald uppercase tracking-wider transition-colors ${
          isPreviewing
            ? "bg-orange/20 text-orange"
            : "text-white/40 hover:text-white/70 hover:bg-white/5"
        }`}
        title="Preview as different role"
      >
        <Eye size={10} />
        Preview
        <ChevronDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-navy-light border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-[9px] font-oswald uppercase tracking-wider text-white/30">Preview as role</p>
          </div>
          {groups.map(({ group, label, desc }) => (
            <button
              key={group}
              onClick={() => {
                onSwitch(group);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                currentGroup === group
                  ? "bg-white/10 text-teal"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div>
                <span className={`text-[9px] font-oswald font-bold uppercase tracking-wider ${ROLE_GROUP_COLORS[group]} px-1.5 py-0.5 rounded-full`}>
                  {label}
                </span>
                <span className="text-[10px] text-white/40 ml-2">{desc}</span>
              </div>
              {currentGroup === group && <span className="text-teal text-xs">✓</span>}
            </button>
          ))}
          {isPreviewing && (
            <button
              onClick={() => { onReset(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-orange hover:bg-white/5 border-t border-white/10 font-medium"
            >
              ← Back to my role
            </button>
          )}
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
