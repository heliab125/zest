import { useState } from "react";
import type { AppSettings } from "../types";
import { ROUTING_STRATEGIES, THEMES, LANGUAGES } from "../services/settings";
import { FolderOpen, Save, Copy, Check } from "lucide-react";
import { openConfigFolder, openLogsFolder } from "../services/proxy";

interface SettingsScreenProps {
  settings: AppSettings;
  loading: boolean;
  onSave: (settings: AppSettings) => void;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function SettingsScreen({
  settings,
  loading,
  onSave,
  onUpdate,
}: SettingsScreenProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onUpdate(key, value);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(settings);
    setHasChanges(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  // Compute endpoints based on port
  const baseUrl = `http://127.0.0.1:${settings.port}`;
  const fullUrl = `${baseUrl}/v1`;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-foreground-secondary">
              Configure Zest preferences
            </p>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          )}
        </div>

        {/* Proxy Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Proxy Settings
          </h2>

          <div className="space-y-4">
            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Port
              </label>
              <input
                type="number"
                value={settings.port}
                onChange={(e) => handleChange("port", parseInt(e.target.value) || 8317)}
                className="input w-32"
                min={1}
                max={65535}
              />
              <p className="text-xs text-foreground-muted mt-1">
                The port the proxy server listens on
              </p>
            </div>

            {/* Bridge Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Bridge Mode</p>
                <p className="text-sm text-foreground-muted">
                  Use connection pooling for better stability
                </p>
              </div>
              <button
                onClick={() => handleChange("use_bridge_mode", !settings.use_bridge_mode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.use_bridge_mode ? "bg-accent" : "bg-zinc-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.use_bridge_mode ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Network Access */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Allow Network Access</p>
                <p className="text-sm text-foreground-muted">
                  Allow connections from other devices on the network
                </p>
              </div>
              <button
                onClick={() => handleChange("allow_network_access", !settings.allow_network_access)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.allow_network_access ? "bg-accent" : "bg-zinc-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.allow_network_access ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Routing Strategy */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Routing Strategy
              </label>
              <select
                value={settings.routing_strategy}
                onChange={(e) => handleChange("routing_strategy", e.target.value)}
                className="input"
              >
                {ROUTING_STRATEGIES.map((strategy) => (
                  <option key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Proxy URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Upstream Proxy URL
              </label>
              <input
                type="text"
                value={settings.proxy_url}
                onChange={(e) => handleChange("proxy_url", e.target.value)}
                className="input"
                placeholder="socks5://127.0.0.1:1080"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Optional proxy for outgoing connections
              </p>
            </div>
          </div>
        </div>

        {/* Proxy Endpoints */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Proxy Endpoints
          </h2>
          <p className="text-sm text-foreground-muted mb-4">
            Use these endpoints to configure your AI agents
          </p>

          <div className="space-y-3">
            {/* Claude Code endpoint */}
            <div className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Claude Code</p>
                <code className="text-xs text-foreground-muted">{baseUrl}</code>
              </div>
              <button
                onClick={() => copyToClipboard(baseUrl, "claude")}
                className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
                title="Copy endpoint"
              >
                {copiedEndpoint === "claude" ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-foreground-muted" />
                )}
              </button>
            </div>

            {/* OpenAI Compatible endpoint */}
            <div className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">OpenAI API / Codex / Other</p>
                <code className="text-xs text-foreground-muted">{fullUrl}</code>
              </div>
              <button
                onClick={() => copyToClipboard(fullUrl, "openai")}
                className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
                title="Copy endpoint"
              >
                {copiedEndpoint === "openai" ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-foreground-muted" />
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-foreground-muted mt-3">
            💡 Claude Code uses the base URL without /v1. Other agents typically need the full /v1 endpoint.
          </p>
        </div>

        {/* App Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Application
          </h2>

          <div className="space-y-4">
            {/* Launch at Login */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Launch at Login</p>
                <p className="text-sm text-foreground-muted">
                  Start Zest automatically when you log in
                </p>
              </div>
              <button
                onClick={() => handleChange("launch_at_login", !settings.launch_at_login)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.launch_at_login ? "bg-accent" : "bg-zinc-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.launch_at_login ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Show in Tray */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Show in System Tray</p>
                <p className="text-sm text-foreground-muted">
                  Keep Zest running in the system tray
                </p>
              </div>
              <button
                onClick={() => handleChange("show_in_tray", !settings.show_in_tray)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.show_in_tray ? "bg-accent" : "bg-zinc-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.show_in_tray ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Theme
              </label>
              <select
                value={settings.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
                className="input"
              >
                {THEMES.map((theme) => (
                  <option key={theme.value} value={theme.value}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => handleChange("language", e.target.value)}
                className="input"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Logging */}
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Logging
          </h2>

          <div className="space-y-4">
            {/* File Logging */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Log to File</p>
                <p className="text-sm text-foreground-muted">
                  Save proxy logs to a file for debugging
                </p>
              </div>
              <button
                onClick={() => handleChange("logging_to_file", !settings.logging_to_file)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.logging_to_file ? "bg-accent" : "bg-zinc-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.logging_to_file ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Open folders */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => openConfigFolder()}
                className="btn-secondary flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Open Config Folder</span>
              </button>
              <button
                onClick={() => openLogsFolder()}
                className="btn-secondary flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Open Logs Folder</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
