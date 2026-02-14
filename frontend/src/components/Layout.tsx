import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Globe, Layers, Zap,
  FileText, Shield, ChevronLeft, ChevronRight,
  Search, Bell, Settings,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/competitors', icon: Users, label: 'Competitors' },
  { to: '/sources', icon: Globe, label: 'Sources' },
  { to: '/themes', icon: Layers, label: 'Themes' },
  { to: '/actions', icon: Zap, label: 'Actions' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/monitoring', icon: Shield, label: 'Monitoring' },
];

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Overview' },
  '/competitors': { title: 'Competitors', subtitle: 'Intelligence' },
  '/sources': { title: 'Sources', subtitle: 'Ingestion' },
  '/themes': { title: 'Themes', subtitle: 'Analysis' },
  '/actions': { title: 'Actions', subtitle: 'Queue' },
  '/reports': { title: 'Reports', subtitle: 'Snapshots' },
  '/monitoring': { title: 'Monitoring', subtitle: 'Quality' },
};

export default function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'DL-CRC', subtitle: '' };

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* ═══ Sidebar ═══ */}
      <aside
        className={`flex flex-col bg-gradient-sidebar border-r border-white/[0.06] transition-all duration-300 ease-out ${
          collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-gradient-hero flex items-center justify-center flex-shrink-0 shadow-glow-sm">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-[15px] text-white tracking-tight truncate">DL-CRC</h1>
              <p className="text-[10px] text-zinc-500 font-medium truncate">Competitive Copilot</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white bg-white/[0.08]'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active gradient bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-hero" />
                  )}
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                    isActive ? 'text-brand-400' : 'text-zinc-500 group-hover:text-zinc-400'
                  }`} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-2 pb-3 space-y-1">
          {!collapsed && (
            <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-200 w-full">
              <Settings className="w-[18px] h-[18px]" />
              <span>Settings</span>
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-10 rounded-xl text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all duration-200"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* ═══ Main ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-white/[0.06] bg-base/80 backdrop-blur-xl flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-white">{pageInfo.title}</h2>
            {pageInfo.subtitle && (
              <>
                <span className="text-zinc-700">/</span>
                <span className="text-sm text-zinc-500">{pageInfo.subtitle}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-500 text-sm hover:border-white/[0.1] hover:text-zinc-400 transition-all">
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-600 font-mono">⌘K</kbd>
            </button>

            <button className="btn-icon relative">
              <Bell className="w-4 h-4" />
            </button>

            {/* User avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center text-white text-xs font-bold ml-1">
              U
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
