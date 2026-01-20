import { RefreshCw, AlertCircle } from "lucide-react";
import type { QuotaInfo } from "../types";
import { PROVIDERS } from "../types";
import { getQuotaPercentage, getQuotaColor, formatResetTime } from "../services/quota";

interface QuotaScreenProps {
  quotas: QuotaInfo[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function QuotaScreen({ quotas, loading, error, onRefresh }: QuotaScreenProps) {
  // Group quotas by provider
  const quotasByProvider = quotas.reduce((acc, quota) => {
    if (!acc[quota.provider]) {
      acc[quota.provider] = [];
    }
    acc[quota.provider].push(quota);
    return acc;
  }, {} as Record<string, QuotaInfo[]>);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quota Usage</h1>
            <p className="text-foreground-secondary">
              Monitor your AI provider quotas
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

        {/* Error state */}
        {error && (
          <div className="card border-red-500/50 bg-red-500/10">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && quotas.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-foreground-muted">No quota data available</p>
            <p className="text-sm text-foreground-muted mt-2">
              Start the proxy and add some accounts to see quota information
            </p>
          </div>
        )}

        {/* Quota cards by provider */}
        {Object.entries(quotasByProvider).map(([provider, providerQuotas]) => {
          const providerInfo = PROVIDERS[provider as keyof typeof PROVIDERS];

          return (
            <div key={provider} className="card">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: `${providerInfo?.color || "#3b82f6"}20`,
                  }}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: providerInfo?.color || "#3b82f6" }}
                  >
                    {(providerInfo?.displayName || provider)[0].toUpperCase()}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  {providerInfo?.displayName || provider}
                </h2>
              </div>

              <div className="space-y-4">
                {providerQuotas.map((quota, index) => (
                  <QuotaCard key={index} quota={quota} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface QuotaCardProps {
  quota: QuotaInfo;
}

function QuotaCard({ quota }: QuotaCardProps) {
  const percentage = getQuotaPercentage(quota);
  const color = getQuotaColor(quota);

  return (
    <div className="p-4 bg-background-tertiary rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-foreground">{quota.account}</p>
          <div className="flex items-center gap-2 mt-1">
            {quota.is_pro && (
              <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
                PRO
              </span>
            )}
            <span
              className="px-2 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              {quota.status}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-foreground">
            {quota.is_unlimited ? "∞" : `${percentage}%`}
          </p>
          {quota.reset_at && (
            <p className="text-xs text-foreground-muted">
              Resets in {formatResetTime(quota.reset_at)}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-background rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: quota.is_unlimited ? "0%" : `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Usage details */}
      {!quota.is_unlimited && (
        <div className="flex items-center justify-between mt-2 text-sm text-foreground-muted">
          <span>Used: {formatNumber(quota.used)}</span>
          <span>Limit: {formatNumber(quota.limit)}</span>
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}
