import { useState, useEffect } from "react";
import {
  RefreshCw,
  GitBranch,
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  Check,
  Info,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AIProvider } from "../types";
import { PROVIDERS } from "../types";

interface FallbackRule {
  id: string;
  name: string;
  enabled: boolean;
  sourceProvider: AIProvider;
  fallbackProviders: AIProvider[];
  conditions: {
    onQuotaExceeded: boolean;
    onRateLimit: boolean;
    onError: boolean;
  };
}

const defaultRules: FallbackRule[] = [
  {
    id: "1",
    name: "Claude to Gemini",
    enabled: true,
    sourceProvider: "claude",
    fallbackProviders: ["gemini-cli"],
    conditions: {
      onQuotaExceeded: true,
      onRateLimit: true,
      onError: false,
    },
  },
  {
    id: "2",
    name: "Gemini to Claude",
    enabled: false,
    sourceProvider: "gemini-cli",
    fallbackProviders: ["claude"],
    conditions: {
      onQuotaExceeded: true,
      onRateLimit: true,
      onError: false,
    },
  },
];

export function FallbackScreen() {
  const [rules, setRules] = useState<FallbackRule[]>(defaultRules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<FallbackRule>>({
    name: "",
    sourceProvider: "claude",
    fallbackProviders: [],
    conditions: {
      onQuotaExceeded: true,
      onRateLimit: true,
      onError: false,
    },
  });

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
    setSuccess("Rule updated");
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
    setSuccess("Rule deleted");
  };

  const handleAddRule = () => {
    if (!newRule.name || !newRule.sourceProvider || !newRule.fallbackProviders?.length) {
      setError("Please fill in all required fields");
      return;
    }

    const rule: FallbackRule = {
      id: Date.now().toString(),
      name: newRule.name,
      enabled: true,
      sourceProvider: newRule.sourceProvider as AIProvider,
      fallbackProviders: newRule.fallbackProviders as AIProvider[],
      conditions: newRule.conditions || {
        onQuotaExceeded: true,
        onRateLimit: true,
        onError: false,
      },
    };

    setRules((prev) => [...prev, rule]);
    setNewRule({
      name: "",
      sourceProvider: "claude",
      fallbackProviders: [],
      conditions: {
        onQuotaExceeded: true,
        onRateLimit: true,
        onError: false,
      },
    });
    setShowAddForm(false);
    setSuccess("Rule added successfully");
  };

  const toggleFallbackProvider = (provider: AIProvider) => {
    setNewRule((prev) => {
      const current = prev.fallbackProviders || [];
      const updated = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      return { ...prev, fallbackProviders: updated };
    });
  };

  const availableProviders = Object.keys(PROVIDERS) as AIProvider[];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fallback Rules</h1>
            <p className="text-foreground-secondary">
              Configure automatic provider switching when quota is exceeded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rule</span>
            </button>
            <button
              onClick={() => setLoading(true)}
              disabled={loading}
              className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="card border border-green-500/30 bg-green-500/10">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500" />
              <p className="text-foreground">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="card border border-red-500/30 bg-red-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="card bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">How Fallback Works</h3>
              <p className="text-sm text-foreground-secondary mt-1">
                When a request fails due to quota exceeded, rate limiting, or errors,
                the proxy will automatically retry with the next available provider
                in your fallback chain. This ensures uninterrupted service.
              </p>
            </div>
          </div>
        </div>

        {/* Add Rule Form */}
        {showAddForm && (
          <div className="card border border-blue-500/30">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Create New Fallback Rule
            </h2>
            <div className="space-y-4">
              {/* Rule Name */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={newRule.name || ""}
                  onChange={(e) =>
                    setNewRule((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Claude to Gemini Fallback"
                  className="w-full bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Source Provider */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">
                  Source Provider
                </label>
                <select
                  value={newRule.sourceProvider || ""}
                  onChange={(e) =>
                    setNewRule((prev) => ({
                      ...prev,
                      sourceProvider: e.target.value as AIProvider,
                    }))
                  }
                  className="w-full bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableProviders.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDERS[provider].displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fallback Providers */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">
                  Fallback Providers (in order)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableProviders
                    .filter((p) => p !== newRule.sourceProvider)
                    .map((provider) => {
                      const isSelected =
                        newRule.fallbackProviders?.includes(provider) || false;
                      return (
                        <button
                          key={provider}
                          onClick={() => toggleFallbackProvider(provider)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-background-tertiary text-foreground-secondary border border-zinc-700 hover:border-zinc-600"
                          }`}
                        >
                          {PROVIDERS[provider].displayName}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Conditions */}
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">
                  Trigger Conditions
                </label>
                <div className="space-y-2">
                  {[
                    { key: "onQuotaExceeded", label: "On Quota Exceeded" },
                    { key: "onRateLimit", label: "On Rate Limit" },
                    { key: "onError", label: "On API Error" },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          (newRule.conditions as Record<string, boolean>)?.[key] || false
                        }
                        onChange={(e) =>
                          setNewRule((prev) => ({
                            ...prev,
                            conditions: {
                              ...prev.conditions!,
                              [key]: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 rounded border-zinc-600 bg-background-tertiary text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-foreground">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleAddRule}
                  className="btn-success flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Rule</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setError(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="card text-center py-12">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No Fallback Rules
            </h2>
            <p className="text-foreground-muted mb-4">
              Create a fallback rule to automatically switch providers when issues occur
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Rule</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const isExpanded = expandedRule === rule.id;
              const sourceInfo = PROVIDERS[rule.sourceProvider];

              return (
                <div key={rule.id} className="card">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedRule(isExpanded ? null : rule.id)
                    }
                  >
                    <div className="flex items-center gap-4">
                      <GripVertical className="w-5 h-5 text-foreground-muted cursor-grab" />
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          rule.enabled ? "bg-green-500/20" : "bg-zinc-700/50"
                        }`}
                      >
                        <GitBranch
                          className={`w-5 h-5 ${
                            rule.enabled ? "text-green-500" : "text-foreground-muted"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {rule.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-foreground-muted">
                          <span style={{ color: sourceInfo?.color }}>
                            {sourceInfo?.displayName}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                          <span>
                            {rule.fallbackProviders
                              .map((p) => PROVIDERS[p]?.displayName)
                              .join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRule(rule.id);
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          rule.enabled
                            ? "bg-green-500/20 text-green-400"
                            : "bg-zinc-700/50 text-foreground-muted"
                        }`}
                      >
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-foreground-muted" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-foreground-muted" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-foreground-muted mb-2">
                            Trigger Conditions
                          </p>
                          <div className="space-y-1">
                            {rule.conditions.onQuotaExceeded && (
                              <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs mr-2">
                                Quota Exceeded
                              </span>
                            )}
                            {rule.conditions.onRateLimit && (
                              <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs mr-2">
                                Rate Limit
                              </span>
                            )}
                            {rule.conditions.onError && (
                              <span className="inline-block px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs mr-2">
                                API Error
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-foreground-muted mb-2">
                            Fallback Chain
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {rule.fallbackProviders.map((provider, index) => (
                              <div key={provider} className="flex items-center gap-2">
                                {index > 0 && (
                                  <ArrowRight className="w-3 h-3 text-foreground-muted" />
                                )}
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${PROVIDERS[provider]?.color}20`,
                                    color: PROVIDERS[provider]?.color,
                                  }}
                                >
                                  {PROVIDERS[provider]?.displayName}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Rule</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
