import { Play, Square, Copy, RefreshCw, Download, AlertCircle } from "lucide-react";
import type { ProxyStatus, AuthFile, QuotaInfo } from "../types";
import { PROVIDERS, getStatusColor } from "../types";
import { getQuotaPercentage, getQuotaColor, formatResetTime } from "../services/quota";

interface DashboardProps {
  proxyStatus: ProxyStatus;
  authFiles: AuthFile[];
  quotas: QuotaInfo[];
  binaryInstalled: boolean;
  downloading: boolean;
  downloadProgress: number;
  onStart: () => void;
  onStop: () => void;
  onInstall: () => void;
  onCopyEndpoint: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export function Dashboard({
  proxyStatus,
  authFiles,
  quotas,
  binaryInstalled,
  downloading,
  downloadProgress,
  onStart,
  onStop,
  onInstall,
  onCopyEndpoint,
  onRefresh,
  loading,
}: DashboardProps) {
  // API returns "active", direct scan returns "ready" - accept both
  const readyAccounts = authFiles.filter((f) => (f.status === "ready" || f.status === "active") && !f.disabled).length;
  const totalAccounts = authFiles.length;

  // Group accounts by provider
  const accountsByProvider = authFiles.reduce((acc, file) => {
    const provider = file.provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(file);
    return acc;
  }, {} as Record<string, AuthFile[]>);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-foreground-secondary">
              Manage your AI provider quotas
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Proxy Control Card */}
        <div className="card">
          {!binaryInstalled ? (
            // Binary not installed - show installation UI
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Proxy Binary Not Installed
              </h2>
              <p className="text-foreground-secondary mb-4">
                The CLIProxyAPI binary needs to be downloaded before you can start the proxy.
              </p>
              {downloading ? (
                <div className="space-y-2">
                  <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-foreground-muted">
                    Downloading... {Math.round(downloadProgress * 100)}%
                  </p>
                </div>
              ) : (
                <button
                  onClick={onInstall}
                  disabled={loading}
                  className="btn-primary flex items-center gap-2 mx-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>Install CLIProxyAPI</span>
                </button>
              )}
            </div>
          ) : (
            // Binary installed - show normal proxy control
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      proxyStatus.running
                        ? "bg-green-500/20"
                        : "bg-zinc-700/50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full ${
                        proxyStatus.running
                          ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]"
                          : "bg-zinc-500"
                      }`}
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Proxy Status
                    </h2>
                    <p className="text-foreground-secondary">
                      {proxyStatus.running
                        ? `Running on port ${proxyStatus.port}`
                        : "Stopped"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {proxyStatus.running && (
                    <button
                      onClick={onCopyEndpoint}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy Endpoint</span>
                    </button>
                  )}

                  {proxyStatus.running ? (
                    <button
                      onClick={onStop}
                      disabled={loading}
                      className="btn-danger flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={onStart}
                      disabled={loading}
                      className="btn-success flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Start</span>
                    </button>
                  )}
                </div>
              </div>

              {proxyStatus.running && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="space-y-2">
                    {/* Base URL for Claude Code */}
                    <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                      <span className="text-xs text-foreground-muted w-24">Claude Code:</span>
                      <code className="px-2 py-1 bg-background-tertiary rounded">
                        {`http://127.0.0.1:${proxyStatus.port}`}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`http://127.0.0.1:${proxyStatus.port}`)}
                        className="p-1 hover:bg-background-tertiary rounded"
                        title="Copy base URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Full URL for other agents */}
                    <div className="flex items-center gap-2 text-sm text-foreground-secondary">
                      <span className="text-xs text-foreground-muted w-24">OpenAI API:</span>
                      <code className="px-2 py-1 bg-background-tertiary rounded">
                        {`http://127.0.0.1:${proxyStatus.port}/v1`}
                      </code>
                      <button
                        onClick={onCopyEndpoint}
                        className="p-1 hover:bg-background-tertiary rounded"
                        title="Copy full endpoint"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card">
            <p className="text-foreground-muted text-sm">Accounts</p>
            <p className="text-2xl font-bold text-foreground">
              {readyAccounts}/{totalAccounts}
            </p>
            <p className="text-xs text-foreground-muted">Ready</p>
          </div>

          <div className="card">
            <p className="text-foreground-muted text-sm">Providers</p>
            <p className="text-2xl font-bold text-foreground">
              {Object.keys(accountsByProvider).length}
            </p>
            <p className="text-xs text-foreground-muted">Connected</p>
          </div>

          <div className="card">
            <p className="text-foreground-muted text-sm">Port</p>
            <p className="text-2xl font-bold text-foreground">
              {proxyStatus.port}
            </p>
            <p className="text-xs text-foreground-muted">
              {proxyStatus.running ? "Active" : "Configured"}
            </p>
          </div>
        </div>

        {/* Provider Summary */}
        {Object.keys(accountsByProvider).length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Connected Providers
            </h3>
            <div className="space-y-3">
              {Object.entries(accountsByProvider).map(([provider, files]) => {
                const providerInfo = PROVIDERS[provider as keyof typeof PROVIDERS];
                const readyCount = files.filter(
                  (f) => (f.status === "ready" || f.status === "active") && !f.disabled
                ).length;

                return (
                  <div
                    key={provider}
                    className="flex items-center justify-between p-3 bg-background-tertiary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: `${providerInfo?.color || "#3b82f6"}20`,
                        }}
                      >
                        <span
                          className="text-sm font-bold"
                          style={{ color: providerInfo?.color || "#3b82f6" }}
                        >
                          {(providerInfo?.displayName || provider)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {providerInfo?.displayName || provider}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {readyCount} of {files.length} accounts ready
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {files.slice(0, 3).map((file) => (
                        <div
                          key={file.id}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getStatusColor(file.status, file.disabled) }}
                          title={`${file.email || file.name}: ${file.status}`}
                        />
                      ))}
                      {files.length > 3 && (
                        <span className="text-xs text-foreground-muted">
                          +{files.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quota Summary */}
        {quotas.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Quota Usage
            </h3>
            <div className="space-y-4">
              {quotas.slice(0, 5).map((quota, index) => {
                const percentage = getQuotaPercentage(quota);
                const color = getQuotaColor(quota);

                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">
                        {quota.provider} - {quota.account}
                      </span>
                      <span className="text-sm text-foreground-muted">
                        {quota.is_unlimited
                          ? "Unlimited"
                          : `${percentage}%`}
                      </span>
                    </div>
                    <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${quota.is_unlimited ? 0 : percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    {quota.reset_at && (
                      <p className="text-xs text-foreground-muted mt-1">
                        Resets in {formatResetTime(quota.reset_at)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
