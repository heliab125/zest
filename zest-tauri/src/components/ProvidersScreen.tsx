import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  X,
  Sparkles,
  Code,
  Brain,
  Cloud,
  Terminal,
  Github,
  Box,
  Settings2,
  Check,
  Loader2,
  AlertCircle,
  BarChart2,
  Pencil,
} from "lucide-react";
import type { AuthFile, AIProvider, OAuthFlowResult } from "../types";
import { PROVIDERS, getStatusColor } from "../types";
import { invoke } from "@tauri-apps/api/core";

// Custom Provider Types
type CustomProviderType =
  | "openai"
  | "claude"
  | "gemini"
  | "codex"
  | "glm";

interface CustomProvider {
  id: string;
  name: string;
  type: CustomProviderType;
  baseUrl: string;
  apiKeys: { key: string; proxyUrl?: string }[];
  modelMappings: { upstream: string; local: string }[];
  isEnabled: boolean;
}

interface OAuthState {
  status: "idle" | "waiting" | "polling" | "success" | "error";
  provider?: AIProvider;
  error?: string;
  deviceCode?: string;
}

interface ProvidersScreenProps {
  authFiles: AuthFile[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDelete: (fileId: string, filePath?: string, fileName?: string) => void;
  onToggle: (fileId: string, disabled: boolean, filePath?: string) => void;
}

// Provider icons mapping
const providerIcons: Record<string, React.ReactNode> = {
  "gemini-cli": <Sparkles className="w-5 h-5" />,
  claude: <Brain className="w-5 h-5" />,
  codex: <Code className="w-5 h-5" />,
  qwen: <Cloud className="w-5 h-5" />,
  iflow: <Cloud className="w-5 h-5" />,
  antigravity: <Sparkles className="w-5 h-5" />,
  vertex: <Box className="w-5 h-5" />,
  kiro: <Cloud className="w-5 h-5" />,
  "github-copilot": <Github className="w-5 h-5" />,
  cursor: <Terminal className="w-5 h-5" />,
  trae: <Terminal className="w-5 h-5" />,
  glm: <Brain className="w-5 h-5" />,
  warp: <Terminal className="w-5 h-5" />,
};

const CUSTOM_PROVIDER_TYPES: {
  id: CustomProviderType;
  name: string;
  icon: string;
}[] = [
  { id: "openai", name: "OpenAI Compatible", icon: "✨" },
  { id: "claude", name: "Claude Compatible", icon: "🧠" },
  { id: "gemini", name: "Gemini Compatible", icon: "💎" },
  { id: "codex", name: "Codex Compatible", icon: "⚡" },
  { id: "glm", name: "GLM Compatible", icon: "🔮" },
];

export function ProvidersScreen({
  authFiles,
  loading,
  onRefresh,
  onDelete,
  onToggle,
}: ProvidersScreenProps) {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set()
  );
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [showCustomProviderSheet, setShowCustomProviderSheet] = useState(false);
  const [oauthState, setOauthState] = useState<OAuthState>({ status: "idle" });
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(
    null
  );
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [editingCustomProvider, setEditingCustomProvider] =
    useState<CustomProvider | null>(null);
  const [menuBarProvider, setMenuBarProvider] = useState<string | null>(null);

  // Load custom providers on mount
  useEffect(() => {
    loadCustomProviders();
  }, []);

  const loadCustomProviders = async () => {
    try {
      const providers = await invoke<CustomProvider[]>("get_custom_providers");
      setCustomProviders(providers);
    } catch {
      // Custom providers not yet implemented in backend
      setCustomProviders([]);
    }
  };

  // Group by provider
  const byProvider = authFiles.reduce(
    (acc, file) => {
      const provider = file.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(file);
      return acc;
    },
    {} as Record<string, AuthFile[]>
  );

  const toggleProvider = (provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const handleAddProvider = async (provider: AIProvider) => {
    setShowAddPopover(false);
    setSelectedProvider(provider);
    setOauthState({ status: "waiting", provider });

    try {
      // 1. Start OAuth flow - opens browser and returns URL + state for polling
      const result = await invoke<OAuthFlowResult>("start_oauth_flow", {
        provider
      });

      setOauthState({ status: "polling", provider });

      // 2. Poll for OAuth completion status
      let pollCount = 0;
      const maxPolls = 150; // 5 minutes at 2 second intervals
      const pollInterval = setInterval(async () => {
        pollCount++;

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setOauthState({
            status: "error",
            provider,
            error: "Authentication timed out. Please try again."
          });
          return;
        }

        try {
          const status = await invoke<string>("check_oauth_status", {
            oauthState: result.state
          });

          if (status === "ok") {
            clearInterval(pollInterval);
            setOauthState({ status: "success", provider });
            // Refresh auth files to show the new account
            setTimeout(() => {
              onRefresh();
              setSelectedProvider(null);
              setOauthState({ status: "idle" });
            }, 1500);
          } else if (status === "error" || status === "failed") {
            clearInterval(pollInterval);
            setOauthState({
              status: "error",
              provider,
              error: "Authentication failed. Please try again."
            });
          }
          // If status is "pending", continue polling
        } catch (err) {
          // Don't stop polling on individual errors - the proxy might be temporarily unavailable
          console.warn("OAuth status check failed:", err);
        }
      }, 2000);

    } catch (err) {
      setOauthState({
        status: "error",
        provider,
        error: String(err)
      });
    }
  };

  const handleSaveCustomProvider = async (provider: CustomProvider) => {
    try {
      if (editingCustomProvider) {
        await invoke("update_custom_provider", { provider });
      } else {
        await invoke("add_custom_provider", { provider });
      }
      setShowCustomProviderSheet(false);
      setEditingCustomProvider(null);
      loadCustomProviders();
    } catch {
      // Backend not implemented yet - save locally
      if (editingCustomProvider) {
        setCustomProviders((prev) =>
          prev.map((p) => (p.id === provider.id ? provider : p))
        );
      } else {
        setCustomProviders((prev) => [...prev, provider]);
      }
      setShowCustomProviderSheet(false);
      setEditingCustomProvider(null);
    }
  };

  const handleDeleteCustomProvider = async (id: string) => {
    try {
      await invoke("delete_custom_provider", { id });
      loadCustomProviders();
    } catch {
      setCustomProviders((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleToggleMenuBar = useCallback((provider: string, account: string) => {
    const key = `${provider}:${account}`;
    setMenuBarProvider((prev) => (prev === key ? null : key));
  }, []);

  const addableProviders = Object.entries(PROVIDERS).filter(
    ([, info]) => info.oauthEndpoint
  );

  const totalAccounts = authFiles.length;
  const sortedProviders = Object.keys(byProvider).sort();

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Providers</h1>
            {totalAccounts > 0 && (
              <span className="px-2.5 py-1 text-xs font-medium bg-zinc-700 text-foreground-secondary rounded-full">
                {totalAccounts}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddPopover(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Your Accounts Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-foreground-secondary" />
              <h2 className="text-sm font-medium text-foreground-secondary uppercase tracking-wider">
                Your Accounts
              </h2>
              {totalAccounts > 0 && (
                <span className="text-xs text-foreground-muted">
                  ({totalAccounts})
                </span>
              )}
            </div>
          </div>

          {!loading && authFiles.length === 0 ? (
            <EmptyState
              onAddProvider={() => setShowAddPopover(true)}
              onScanIDEs={() => {}}
            />
          ) : (
            <div className="space-y-3">
              {sortedProviders.map((provider) => {
                const files = byProvider[provider];
                const providerInfo =
                  PROVIDERS[provider as keyof typeof PROVIDERS];
                const color = providerInfo?.color || "#3b82f6";
                const isExpanded = expandedProviders.has(provider);

                return (
                  <ProviderGroup
                    key={provider}
                    provider={provider}
                    providerInfo={providerInfo}
                    files={files}
                    color={color}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleProvider(provider)}
                    onDeleteAccount={(id, path, name) => onDelete(id, path, name)}
                    onToggleAccount={(id, disabled, path) => onToggle(id, disabled, path)}
                    menuBarProvider={menuBarProvider}
                    onToggleMenuBar={handleToggleMenuBar}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Custom Providers Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-foreground-secondary" />
              <h2 className="text-sm font-medium text-foreground-secondary uppercase tracking-wider">
                Custom Providers
              </h2>
              {customProviders.length > 0 && (
                <span className="text-xs text-foreground-muted">
                  ({customProviders.length})
                </span>
              )}
            </div>
          </div>

          {customProviders.length === 0 ? (
            <div className="card text-center py-8">
              <Box className="w-10 h-10 mx-auto mb-3 text-foreground-muted" />
              <p className="text-foreground-secondary text-sm mb-2">
                No custom providers configured
              </p>
              <p className="text-xs text-foreground-muted mb-4">
                Connect OpenRouter, Ollama, LM Studio, or any compatible API
                endpoint
              </p>
              <button
                onClick={() => {
                  setEditingCustomProvider(null);
                  setShowCustomProviderSheet(true);
                }}
                className="btn-secondary text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Provider
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {customProviders.map((provider) => (
                <CustomProviderRow
                  key={provider.id}
                  provider={provider}
                  onEdit={() => {
                    setEditingCustomProvider(provider);
                    setShowCustomProviderSheet(true);
                  }}
                  onDelete={() => handleDeleteCustomProvider(provider.id)}
                  onToggle={() => {
                    const updated = {
                      ...provider,
                      isEnabled: !provider.isEnabled,
                    };
                    handleSaveCustomProvider(updated);
                  }}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-foreground-muted mt-3">
            Custom providers let you connect OpenRouter, Ollama, LM Studio, or
            any compatible API endpoint.
          </p>
        </section>

        {/* Add Provider Popover */}
        {showAddPopover && (
          <AddProviderPopover
            providers={addableProviders}
            existingCounts={Object.fromEntries(
              Object.entries(byProvider).map(([k, v]) => [k, v.length])
            )}
            onSelectProvider={(p) =>
              handleAddProvider(p as AIProvider)
            }
            onScanIDEs={() => {
              setShowAddPopover(false);
            }}
            onAddCustomProvider={() => {
              setShowAddPopover(false);
              setEditingCustomProvider(null);
              setShowCustomProviderSheet(true);
            }}
            onClose={() => setShowAddPopover(false)}
          />
        )}

        {/* OAuth Sheet */}
        {selectedProvider && (
          <OAuthSheet
            provider={selectedProvider}
            state={oauthState}
            onCancel={() => {
              setSelectedProvider(null);
              setOauthState({ status: "idle" });
            }}
            onRetry={() => handleAddProvider(selectedProvider)}
          />
        )}

        {/* Custom Provider Sheet */}
        {showCustomProviderSheet && (
          <CustomProviderSheet
            provider={editingCustomProvider}
            onSave={handleSaveCustomProvider}
            onCancel={() => {
              setShowCustomProviderSheet(false);
              setEditingCustomProvider(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ==================== Sub-components ====================

interface EmptyStateProps {
  onAddProvider: () => void;
  onScanIDEs: () => void;
}

function EmptyState({ onAddProvider }: EmptyStateProps) {
  return (
    <div className="card text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-background-tertiary rounded-full flex items-center justify-center">
        <Plus className="w-8 h-8 text-foreground-muted" />
      </div>
      <p className="text-foreground-muted mb-2">No accounts connected</p>
      <p className="text-sm text-foreground-muted mb-4">
        Start the proxy and use OAuth to add accounts
      </p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onAddProvider} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </button>
      </div>
    </div>
  );
}

interface ProviderGroupProps {
  provider: string;
  providerInfo: {
    displayName: string;
    color: string;
  } | undefined;
  files: AuthFile[];
  color: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDeleteAccount: (id: string, path?: string, name?: string) => void;
  onToggleAccount: (id: string, disabled: boolean, path?: string) => void;
  menuBarProvider: string | null;
  onToggleMenuBar: (provider: string, account: string) => void;
}

function ProviderGroup({
  provider,
  providerInfo,
  files,
  color,
  isExpanded,
  onToggleExpand,
  onDeleteAccount,
  onToggleAccount,
  menuBarProvider,
  onToggleMenuBar,
}: ProviderGroupProps) {
  // Match Swift's isReady logic: status == "ready" or "active" && !disabled && !unavailable
  // API returns "active", direct scan returns "ready" - accept both
  const activeCount = files.filter(
    (f) => !f.disabled && !f.unavailable && (f.status === "ready" || f.status === "active")
  ).length;
  const icon = providerIcons[provider] || <Cloud className="w-5 h-5" />;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-1 hover:bg-background-tertiary/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">
                {providerInfo?.displayName || provider}
              </h3>
              <span className="text-xs px-2 py-0.5 bg-zinc-700 rounded-full text-foreground-secondary">
                {files.length}
              </span>
            </div>
            <p className="text-xs text-foreground-muted">
              {activeCount} active
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-foreground-muted" />
        ) : (
          <ChevronRight className="w-5 h-5 text-foreground-muted" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
          {files.map((file) => (
            <AccountRow
              key={file.id}
              file={file}
              providerColor={color}
              isMenuBarSelected={
                menuBarProvider === `${file.provider}:${file.account || file.email}`
              }
              onDelete={() => onDeleteAccount(file.id, file.path || undefined, file.name)}
              onToggle={() => onToggleAccount(file.id, !file.disabled, file.path || undefined)}
              onToggleMenuBar={() =>
                onToggleMenuBar(file.provider, file.account || file.email || "")
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AccountRowProps {
  file: AuthFile;
  providerColor: string;
  isMenuBarSelected: boolean;
  onDelete: () => void;
  onToggle: () => void;
  onToggleMenuBar: () => void;
}

function AccountRow({
  file,
  isMenuBarSelected,
  onDelete,
  onToggle,
  onToggleMenuBar,
}: AccountRowProps) {
  const statusColor = getStatusColor(file.status, file.disabled);

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
        file.disabled ? "bg-zinc-800/30 opacity-60" : "bg-background-tertiary"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <div>
          <p className="font-medium text-foreground">
            {file.email || file.account || file.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-foreground-muted">{file.status}</span>
            {file.account_type && (
              <span className="text-xs px-1.5 py-0.5 bg-background rounded">
                {file.account_type}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMenuBar}
          className={`p-2 rounded-lg transition-colors ${
            isMenuBarSelected
              ? "text-blue-400 bg-blue-500/20"
              : "text-foreground-muted hover:text-foreground hover:bg-background"
          }`}
          title={isMenuBarSelected ? "Hide from menu bar" : "Show in menu bar"}
        >
          <BarChart2 className="w-4 h-4" />
        </button>
        <button
          onClick={onToggle}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background rounded-lg transition-colors"
          title={file.disabled ? "Enable" : "Disable"}
        >
          {file.disabled ? (
            <ToggleLeft className="w-5 h-5" />
          ) : (
            <ToggleRight className="w-5 h-5 text-green-500" />
          )}
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-foreground-muted hover:text-red-400 hover:bg-background rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface CustomProviderRowProps {
  provider: CustomProvider;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function CustomProviderRow({
  provider,
  onEdit,
  onDelete,
  onToggle,
}: CustomProviderRowProps) {
  const typeInfo = CUSTOM_PROVIDER_TYPES.find((t) => t.id === provider.type);

  return (
    <div className="card flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-lg">
          {typeInfo?.icon || "🔌"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{provider.name}</span>
            {!provider.isEnabled && (
              <span className="text-xs px-2 py-0.5 bg-zinc-700 rounded-full text-foreground-muted">
                Disabled
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <span>{typeInfo?.name}</span>
            <span>•</span>
            <span>
              {provider.apiKeys.length} key
              {provider.apiKeys.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggle}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
        >
          {provider.isEnabled ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <div className="w-4 h-4 rounded-full border border-zinc-600" />
          )}
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-foreground-muted hover:text-red-400 hover:bg-background-tertiary rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface AddProviderPopoverProps {
  providers: [string, { displayName: string; color: string }][];
  existingCounts: Record<string, number>;
  onSelectProvider: (provider: string) => void;
  onScanIDEs: () => void;
  onAddCustomProvider: () => void;
  onClose: () => void;
}

function AddProviderPopover({
  providers,
  existingCounts,
  onSelectProvider,
  onScanIDEs,
  onAddCustomProvider,
  onClose,
}: AddProviderPopoverProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background-secondary border border-zinc-700 rounded-xl p-6 w-[500px] max-h-[80vh] overflow-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Add Account</h2>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-foreground-secondary mb-4">
          Click any provider to add multiple accounts
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {providers.map(([id, info]) => {
            const icon = providerIcons[id] || <Cloud className="w-6 h-6" />;
            const count = existingCounts[id] || 0;

            return (
              <button
                key={id}
                onClick={() => onSelectProvider(id)}
                className="flex flex-col items-center gap-2 p-4 bg-background-tertiary hover:bg-zinc-700 rounded-xl transition-colors relative"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${info.color}20` }}
                >
                  <span style={{ color: info.color }}>{icon}</span>
                </div>
                <span className="text-xs text-foreground text-center">
                  {info.displayName}
                </span>
                {count > 0 && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-zinc-700 pt-4 space-y-2">
          <button
            onClick={onScanIDEs}
            className="w-full flex items-center justify-between p-3 bg-background-tertiary hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-foreground-secondary" />
              <span className="text-foreground">Scan for Existing IDEs</span>
            </div>
            <ChevronRight className="w-4 h-4 text-foreground-muted" />
          </button>

          <button
            onClick={onAddCustomProvider}
            className="w-full flex items-center justify-between p-3 bg-background-tertiary hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Box className="w-5 h-5 text-foreground-secondary" />
              <span className="text-foreground">Add Custom Provider</span>
            </div>
            <ChevronRight className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface OAuthSheetProps {
  provider: AIProvider;
  state: OAuthState;
  onCancel: () => void;
  onRetry: () => void;
}

function OAuthSheet({ provider, state, onCancel, onRetry }: OAuthSheetProps) {
  const providerInfo = PROVIDERS[provider];
  const icon = providerIcons[provider] || <Cloud className="w-8 h-8" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background-secondary border border-zinc-700 rounded-xl p-8 w-[480px] shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ backgroundColor: `${providerInfo?.color}20` }}
          >
            <span
              style={{ color: providerInfo?.color }}
              className="[&>svg]:w-8 [&>svg]:h-8"
            >
              {icon}
            </span>
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            Connect {providerInfo?.displayName}
          </h2>
          <p className="text-sm text-foreground-secondary mb-6">
            Authenticate with {providerInfo?.displayName}
          </p>

          {state.status === "waiting" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
              <p className="text-sm text-foreground-secondary">
                Opening browser...
              </p>
            </div>
          )}

          {state.status === "polling" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-full border-4 border-zinc-700"
                  style={{ borderTopColor: providerInfo?.color }}
                >
                  <div className="absolute inset-0 flex items-center justify-center animate-spin">
                    <div
                      className="w-full h-full rounded-full border-4 border-transparent"
                      style={{ borderTopColor: providerInfo?.color }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">
                Waiting for authentication...
              </p>
              <p className="text-xs text-foreground-muted">
                Complete the sign-in in your browser
              </p>
            </div>
          )}

          {state.status === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-green-500">
                Successfully connected!
              </p>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-red-500">
                Authentication failed
              </p>
              {state.error && (
                <p className="text-xs text-foreground-muted max-w-xs">
                  {state.error}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            {state.status === "error" && (
              <button
                onClick={onRetry}
                className="btn-primary"
                style={{ backgroundColor: providerInfo?.color }}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CustomProviderSheetProps {
  provider: CustomProvider | null;
  onSave: (provider: CustomProvider) => void;
  onCancel: () => void;
}

function CustomProviderSheet({
  provider,
  onSave,
  onCancel,
}: CustomProviderSheetProps) {
  const [name, setName] = useState(provider?.name || "");
  const [type, setType] = useState<CustomProviderType>(
    provider?.type || "openai"
  );
  const [baseUrl, setBaseUrl] = useState(
    provider?.baseUrl || "https://api.example.com/v1"
  );
  const [apiKeys, setApiKeys] = useState<{ key: string; proxyUrl?: string }[]>(
    provider?.apiKeys || [{ key: "" }]
  );
  const [modelMappings, setModelMappings] = useState<
    { upstream: string; local: string }[]
  >(provider?.modelMappings || []);

  const handleSave = () => {
    const newProvider: CustomProvider = {
      id: provider?.id || crypto.randomUUID(),
      name,
      type,
      baseUrl,
      apiKeys: apiKeys.filter((k) => k.key),
      modelMappings: modelMappings.filter((m) => m.upstream && m.local),
      isEnabled: provider?.isEnabled ?? true,
    };
    onSave(newProvider);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background-secondary border border-zinc-700 rounded-xl w-[560px] max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
              <Box className="w-5 h-5 text-foreground-secondary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {provider ? "Edit" : "Add"} Custom Provider
              </h2>
              <p className="text-xs text-foreground-muted">
                OpenRouter, Ollama, LM Studio, vLLM, or any OpenAI-compatible
                API
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-foreground-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">
              Basic Information
            </h3>

            <div>
              <label className="block text-xs text-foreground-secondary mb-1.5">
                Provider Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., OpenRouter, Ollama Local"
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs text-foreground-secondary mb-1.5">
                Provider Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CustomProviderType)}
                className="input"
              >
                {CUSTOM_PROVIDER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-foreground-secondary mb-1.5">
                Base URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="input flex-1"
                />
                <button className="p-2 text-foreground-muted hover:text-foreground bg-background-tertiary rounded-lg">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">API Keys</h3>
              <button
                onClick={() => setApiKeys([...apiKeys, { key: "" }])}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Key
              </button>
            </div>

            {apiKeys.map((apiKey, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-foreground-muted w-20">
                    API Key #{index + 1}
                  </label>
                  <input
                    type="password"
                    value={apiKey.key}
                    onChange={(e) => {
                      const newKeys = [...apiKeys];
                      newKeys[index] = { ...newKeys[index], key: e.target.value };
                      setApiKeys(newKeys);
                    }}
                    placeholder="API Keys"
                    className="input flex-1"
                  />
                  {apiKeys.length > 1 && (
                    <button
                      onClick={() =>
                        setApiKeys(apiKeys.filter((_, i) => i !== index))
                      }
                      className="p-2 text-foreground-muted hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={apiKey.proxyUrl || ""}
                  onChange={(e) => {
                    const newKeys = [...apiKeys];
                    newKeys[index] = {
                      ...newKeys[index],
                      proxyUrl: e.target.value,
                    };
                    setApiKeys(newKeys);
                  }}
                  placeholder="Proxy URL (optional)"
                  className="input ml-[88px]"
                />
              </div>
            ))}
          </div>

          {/* Model Mapping */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                Model Mapping
              </h3>
              <button
                onClick={() =>
                  setModelMappings([
                    ...modelMappings,
                    { upstream: "", local: "" },
                  ])
                }
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Mapping
              </button>
            </div>

            <p className="text-xs text-foreground-muted">
              Map upstream model names to local aliases
            </p>

            {modelMappings.length === 0 ? (
              <p className="text-xs text-foreground-muted italic">
                No model mappings configured. Models will use their original
                names.
              </p>
            ) : (
              modelMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mapping.upstream}
                    onChange={(e) => {
                      const newMappings = [...modelMappings];
                      newMappings[index] = {
                        ...newMappings[index],
                        upstream: e.target.value,
                      };
                      setModelMappings(newMappings);
                    }}
                    placeholder="Upstream model"
                    className="input flex-1"
                  />
                  <span className="text-foreground-muted">→</span>
                  <input
                    type="text"
                    value={mapping.local}
                    onChange={(e) => {
                      const newMappings = [...modelMappings];
                      newMappings[index] = {
                        ...newMappings[index],
                        local: e.target.value,
                      };
                      setModelMappings(newMappings);
                    }}
                    placeholder="Local alias"
                    className="input flex-1"
                  />
                  <button
                    onClick={() =>
                      setModelMappings(
                        modelMappings.filter((_, i) => i !== index)
                      )
                    }
                    className="p-2 text-foreground-muted hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-zinc-700">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !baseUrl}
            className="btn-primary"
          >
            {provider ? "Save Changes" : "Add Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}
