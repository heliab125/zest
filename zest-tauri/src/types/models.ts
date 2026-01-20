// Type definitions for Zest
// Mirrors the Rust models for TypeScript

export type AIProvider =
  | "gemini-cli"
  | "claude"
  | "codex"
  | "qwen"
  | "iflow"
  | "antigravity"
  | "vertex"
  | "kiro"
  | "github-copilot"
  | "cursor"
  | "trae"
  | "glm"
  | "warp";

export interface ProviderInfo {
  id: AIProvider;
  displayName: string;
  color: string;
  icon: string;
  supportsQuotaOnly: boolean;
  usesBrowserAuth: boolean;
  oauthEndpoint?: string;
}

export const PROVIDERS: Record<AIProvider, ProviderInfo> = {
  "gemini-cli": {
    id: "gemini-cli",
    displayName: "Gemini CLI",
    color: "#4285F4",
    icon: "sparkles",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
    oauthEndpoint: "/gemini-cli-auth-url",
  },
  claude: {
    id: "claude",
    displayName: "Claude Code",
    color: "#D97706",
    icon: "brain",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
    oauthEndpoint: "/anthropic-auth-url",
  },
  codex: {
    id: "codex",
    displayName: "Codex (OpenAI)",
    color: "#10A37F",
    icon: "code",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
    oauthEndpoint: "/codex-auth-url",
  },
  qwen: {
    id: "qwen",
    displayName: "Qwen Code",
    color: "#7C3AED",
    icon: "cloud",
    supportsQuotaOnly: false,
    usesBrowserAuth: false,
    oauthEndpoint: "/qwen-auth-url",
  },
  iflow: {
    id: "iflow",
    displayName: "iFlow",
    color: "#06B6D4",
    icon: "git-branch",
    supportsQuotaOnly: false,
    usesBrowserAuth: false,
    oauthEndpoint: "/iflow-auth-url",
  },
  antigravity: {
    id: "antigravity",
    displayName: "Antigravity",
    color: "#EC4899",
    icon: "wand",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
    oauthEndpoint: "/antigravity-auth-url",
  },
  vertex: {
    id: "vertex",
    displayName: "Vertex AI",
    color: "#EA4335",
    icon: "box",
    supportsQuotaOnly: false,
    usesBrowserAuth: false,
  },
  kiro: {
    id: "kiro",
    displayName: "Kiro (CodeWhisperer)",
    color: "#9046FF",
    icon: "cloud",
    supportsQuotaOnly: false,
    usesBrowserAuth: false,
    oauthEndpoint: "/kiro-auth-url",
  },
  "github-copilot": {
    id: "github-copilot",
    displayName: "GitHub Copilot",
    color: "#238636",
    icon: "github",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor",
    color: "#00D4AA",
    icon: "mouse-pointer",
    supportsQuotaOnly: true,
    usesBrowserAuth: true,
  },
  trae: {
    id: "trae",
    displayName: "Trae",
    color: "#00B4D8",
    icon: "mouse-pointer",
    supportsQuotaOnly: true,
    usesBrowserAuth: true,
  },
  glm: {
    id: "glm",
    displayName: "GLM",
    color: "#3B82F6",
    icon: "brain",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
  },
  warp: {
    id: "warp",
    displayName: "Warp",
    color: "#01E5FF",
    icon: "terminal",
    supportsQuotaOnly: true,
    usesBrowserAuth: false,
  },
};

export interface ProxyStatus {
  running: boolean;
  port: number;
  pid?: number;
  version?: string;
  uptime_seconds?: number;
}

export interface AuthFile {
  id: string;
  name: string;
  provider: string;
  label?: string;
  status: string;
  status_message?: string;
  disabled: boolean;
  unavailable: boolean;
  runtime_only?: boolean;
  source?: string;
  path?: string;
  email?: string;
  account_type?: string;
  account?: string;
  auth_index?: string;
  created_at?: string;
  updated_at?: string;
  last_refresh?: string;
}

export interface QuotaInfo {
  provider: string;
  account: string;
  used: number;
  limit: number;
  reset_at?: string;
  is_unlimited: boolean;
  is_pro: boolean;
  status: string;
}

// OAuth flow result returned from start_oauth_flow command
export interface OAuthFlowResult {
  url: string;
  state: string;
}

export interface UsageStats {
  total_requests?: number;
  success_count?: number;
  failure_count?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface AppSettings {
  port: number;
  allow_network_access: boolean;
  use_bridge_mode: boolean;
  logging_to_file: boolean;
  routing_strategy: string;
  launch_at_login: boolean;
  show_in_tray: boolean;
  menu_bar_provider?: string;
  theme: string;
  language: string;
  proxy_url: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export type NavigationPage =
  | "dashboard"
  | "quota"
  | "providers"
  | "fallback"
  | "agents"
  | "apikeys"
  | "logs"
  | "settings"
  | "about";

export interface NavItem {
  id: NavigationPage;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "gauge" },
  { id: "quota", label: "Quota", icon: "bar-chart-2" },
  { id: "providers", label: "Providers", icon: "users" },
  { id: "fallback", label: "Fallback", icon: "git-branch" },
  { id: "agents", label: "Agents", icon: "terminal" },
  { id: "apikeys", label: "API Keys", icon: "key" },
  { id: "logs", label: "Logs", icon: "file-text" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "about", label: "About", icon: "info" },
];

// Helper functions
export function getStatusColor(status: string, disabled: boolean = false): string {
  if (disabled) return "#71717a";
  switch (status) {
    case "ready":
      return "#22c55e";
    case "cooling":
      return "#f59e0b";
    case "error":
      return "#ef4444";
    default:
      return "#71717a";
  }
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatPercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}
