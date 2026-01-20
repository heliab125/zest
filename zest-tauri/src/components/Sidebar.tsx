import React from "react";
import { NAV_ITEMS, type NavigationPage } from "../types";
import {
  Gauge,
  BarChart2,
  Users,
  GitBranch,
  Terminal,
  Key,
  FileText,
  Settings,
  Info,
} from "lucide-react";

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  proxyRunning: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  "bar-chart-2": BarChart2,
  users: Users,
  "git-branch": GitBranch,
  terminal: Terminal,
  key: Key,
  "file-text": FileText,
  settings: Settings,
  info: Info,
};

export function Sidebar({ currentPage, onNavigate, proxyRunning }: SidebarProps) {
  return (
    <aside className="w-56 bg-background-secondary border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Zest</h1>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  proxyRunning
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                    : "bg-zinc-500"
                }`}
              />
              <span className="text-xs text-foreground-muted">
                {proxyRunning ? "Running" : "Stopped"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || Gauge;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-accent/10 text-accent"
                      : "text-foreground-secondary hover:bg-background-tertiary hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Version info */}
      <div className="p-4 border-t border-zinc-800">
        <p className="text-xs text-foreground-muted">Zest v0.1.0</p>
      </div>
    </aside>
  );
}
