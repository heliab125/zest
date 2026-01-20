import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Terminal,
  Check,
  X,
  Copy,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings,
  Download,
  ExternalLink,
  Zap,
  FileJson,
  Hash,
  Layers,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  Code,
  Cpu,
  Brain,
  Bolt,
} from "lucide-react";
import type { ShellInfo, AgentInfo } from "../services/agents";
import * as agentsService from "../services/agents";
import * as modelsService from "../services/models";
import { copyToClipboard } from "../services/proxy";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

type CLIAgentId = "claude-code" | "codex" | "gemini-cli" | "amp" | "opencode" | "factory-droid";

type ConfigurationSetup = "proxy" | "default";
type ConfigurationMode = "automatic" | "manual";
type ConfigStorageOption = "json" | "shell" | "both";
type ModelSlot = "opus" | "sonnet" | "haiku";

interface CLIAgentInfo {
  id: CLIAgentId;
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  binaryNames: string[];
  configPaths: string[];
  docsUrl?: string;
  configType: "env" | "file" | "both";
}

interface AgentStatus {
  agent: CLIAgentInfo;
  installed: boolean;
  configured: boolean;
  binaryPath?: string;
  version?: string;
  lastConfigured?: string;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  modelResponded?: string;
}

interface BackupFile {
  id: string;
  name: string;
  date: string;
  path: string;
}

interface AgentConfiguration {
  agent: CLIAgentId;
  modelSlots: Record<ModelSlot, string>;
  proxyURL: string;
  apiKey: string;
  useOAuth: boolean;
  setupMode: ConfigurationSetup;
}

// ============================================================================
// Constants
// ============================================================================

const CLI_AGENTS: CLIAgentInfo[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's official CLI for Claude models",
    color: "#D97706",
    icon: <Brain className="w-5 h-5" />,
    binaryNames: ["claude"],
    configPaths: ["~/.claude/settings.json"],  // Fixed: was ~/.config/claude/config.json
    docsUrl: "https://platform.claude.com/docs/en/get-started",
    configType: "both",
  },
  {
    id: "codex",
    name: "Codex CLI",
    description: "OpenAI's Codex CLI for GPT-5 models",
    color: "#10A37F",
    icon: <Code className="w-5 h-5" />,
    binaryNames: ["codex"],
    configPaths: ["~/.codex/config.toml", "~/.codex/auth.json"],
    docsUrl: "https://github.com/openai/codex",
    configType: "file",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    description: "Google's Gemini CLI for Gemini models",
    color: "#4285F4",
    icon: <Sparkles className="w-5 h-5" />,
    binaryNames: ["gemini"],
    configPaths: [],
    docsUrl: "https://github.com/google-gemini/gemini-cli",
    configType: "env",
  },
  {
    id: "amp",
    name: "Amp CLI",
    description: "Sourcegraph's Amp coding assistant",
    color: "#FF5543",
    icon: <Bolt className="w-5 h-5" />,
    binaryNames: ["amp"],
    configPaths: ["~/.config/amp/settings.json"],
    docsUrl: "https://ampcode.com/manual",
    configType: "both",
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "The open source AI coding agent",
    color: "#8B5CF6",
    icon: <Terminal className="w-5 h-5" />,
    binaryNames: ["opencode", "oc"],
    configPaths: ["~/.config/opencode/opencode.json"],
    docsUrl: "https://github.com/sst/opencode",
    configType: "file",
  },
  {
    id: "factory-droid",
    name: "Factory Droid",
    description: "Factory's AI coding agent",
    color: "#238636",
    icon: <Cpu className="w-5 h-5" />,
    binaryNames: ["droid", "factory-droid", "fd"],
    configPaths: ["~/.factory/config.json"],
    docsUrl: "https://github.com/factory-ai/factory-droid",
    configType: "file",
  },
];

const MODEL_SLOTS: { slot: ModelSlot; displayName: string; description: string }[] = [
  { slot: "opus", displayName: "Opus", description: "High Intelligence" },
  { slot: "sonnet", displayName: "Sonnet", description: "Balanced" },
  { slot: "haiku", displayName: "Haiku", description: "Fast" },
];

const DEFAULT_MODELS: Record<ModelSlot, modelsService.AvailableModel> = {
  opus: { id: "opus", name: "gemini-claude-opus-4-5-thinking", provider: "anthropic", isDefault: true },
  sonnet: { id: "sonnet", name: "gemini-claude-sonnet-4-5", provider: "anthropic", isDefault: true },
  haiku: { id: "haiku", name: "gemini-3-flash-preview", provider: "google", isDefault: true },
};

// ============================================================================
// Props
// ============================================================================

interface AgentsScreenProps {
  proxyRunning: boolean;
  proxyPort: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentsScreen({ proxyRunning, proxyPort }: AgentsScreenProps) {
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [selectedShell, setSelectedShell] = useState<string>("");
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Config sheet state
  const [configAgent, setConfigAgent] = useState<CLIAgentInfo | null>(null);
  const [showConfigSheet, setShowConfigSheet] = useState(false);

  // Load agents and check installation status
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shellsData, detectedShell] = await Promise.all([
        agentsService.getAvailableShells(),
        agentsService.detectShell(),
      ]);

      setShells(shellsData);
      if (!selectedShell) {
        setSelectedShell(detectedShell);
      }

      // Check installation status for each agent
      const statuses: AgentStatus[] = await Promise.all(
        CLI_AGENTS.map(async (agent) => {
          try {
            // Check if binary exists
            const binaryPath = await agentsService.findAgentBinary(agent.binaryNames);
            const installed = !!binaryPath;

            // Check if configured
            const configured = installed
              ? await agentsService.isAgentConfigured(detectedShell, agent.id)
              : false;

            return {
              agent,
              installed,
              configured,
              binaryPath: binaryPath || undefined,
            };
          } catch {
            return {
              agent,
              installed: false,
              configured: false,
            };
          }
        })
      );

      setAgentStatuses(statuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedShell]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const installedAgents = agentStatuses.filter((s) => s.installed);
  const notInstalledAgents = agentStatuses.filter((s) => !s.installed);

  const handleOpenConfig = (agent: CLIAgentInfo) => {
    setConfigAgent(agent);
    setShowConfigSheet(true);
  };

  const handleCloseConfig = () => {
    setShowConfigSheet(false);
    setConfigAgent(null);
    loadData(); // Refresh status after config
  };

  const handleConfigSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 5000);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CLI Agents</h1>
            <p className="text-foreground-secondary">
              Configure CLI tools to use the proxy
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-2">
              <StatChip
                label="Installed"
                value={installedAgents.length}
                color="green"
              />
              <StatChip
                label="Configured"
                value={installedAgents.filter(s => s.configured).length}
                color="blue"
              />
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Proxy Status Warning */}
        {!proxyRunning && (
          <div className="card border border-amber-500/30 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <p className="text-foreground">
                Proxy is not running. Start it first to use CLI agents.
              </p>
            </div>
          </div>
        )}

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
              <X className="w-5 h-5 text-red-500" />
              <p className="text-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Installed Agents */}
        {installedAgents.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Installed ({installedAgents.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {installedAgents.map((status) => (
                <AgentCard
                  key={status.agent.id}
                  status={status}
                  proxyPort={proxyPort}
                  onConfigure={() => handleOpenConfig(status.agent)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Not Installed Agents */}
        {notInstalledAgents.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-foreground-muted" />
              Not Installed ({notInstalledAgents.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {notInstalledAgents.map((status) => (
                <AgentCardNotInstalled
                  key={status.agent.id}
                  agent={status.agent}
                />
              ))}
            </div>
          </section>
        )}

        {/* Shell Configuration */}
        <section className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Shell Configuration
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-foreground-muted" />
              <span className="text-foreground-secondary">Shell:</span>
            </div>
            <select
              value={selectedShell}
              onChange={(e) => setSelectedShell(e.target.value)}
              className="bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {shells.map((shell) => (
                <option key={shell.id} value={shell.id} disabled={!shell.available}>
                  {shell.name}
                  {!shell.available && " (not installed)"}
                </option>
              ))}
            </select>
          </div>
          {selectedShell && (
            <p className="mt-2 text-sm text-foreground-muted">
              Profile: {shells.find((s) => s.id === selectedShell)?.profile_path}
            </p>
          )}
        </section>
      </div>

      {/* Configuration Sheet */}
      {showConfigSheet && configAgent && (
        <AgentConfigSheet
          agent={configAgent}
          proxyPort={proxyPort}
          selectedShell={selectedShell}
          onClose={handleCloseConfig}
          onSuccess={handleConfigSuccess}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatChip({ label, value, color }: { label: string; value: number; color: "green" | "blue" }) {
  const bgColor = color === "green" ? "bg-green-500/10" : "bg-blue-500/10";
  const textColor = color === "green" ? "text-green-500" : "text-blue-500";

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bgColor}`}>
      <span className={`text-sm font-medium ${textColor}`}>{value}</span>
      <span className="text-xs text-foreground-muted">{label}</span>
    </div>
  );
}

function AgentCard({
  status,
  proxyPort,
  onConfigure
}: {
  status: AgentStatus;
  proxyPort: number;
  onConfigure: () => void;
}) {
  const { agent, configured, binaryPath } = status;

  return (
    <div className="card hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
          >
            {agent.icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{agent.name}</h3>
            <p className="text-xs text-foreground-muted">{agent.description}</p>
          </div>
        </div>
        <StatusBadge configured={configured} />
      </div>

      {binaryPath && (
        <div className="mt-3 px-2 py-1.5 bg-background-tertiary rounded text-xs text-foreground-muted font-mono truncate">
          {binaryPath}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onConfigure}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
          style={{
            backgroundColor: agent.color,
            borderColor: agent.color
          }}
        >
          <Settings className="w-4 h-4" />
          <span>Configure</span>
        </button>
        {agent.docsUrl && (
          <a
            href={agent.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary p-2"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function AgentCardNotInstalled({ agent }: { agent: CLIAgentInfo }) {
  return (
    <div className="card opacity-60">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-800 text-foreground-muted"
          >
            {agent.icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{agent.name}</h3>
            <p className="text-xs text-foreground-muted">{agent.description}</p>
          </div>
        </div>
        <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-foreground-muted">
          Not Installed
        </span>
      </div>

      <div className="mt-4">
        {agent.docsUrl ? (
          <a
            href={agent.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Install</span>
          </a>
        ) : (
          <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed">
            Not Available
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-500 flex items-center gap-1">
        <Check className="w-3 h-3" />
        Configured
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-500">
      Installed
    </span>
  );
}

// ============================================================================
// Agent Configuration Sheet
// ============================================================================

interface AgentConfigSheetProps {
  agent: CLIAgentInfo;
  proxyPort: number;
  selectedShell: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function AgentConfigSheet({
  agent,
  proxyPort,
  selectedShell,
  onClose,
  onSuccess
}: AgentConfigSheetProps) {
  // Configuration state
  const [setupMode, setSetupMode] = useState<ConfigurationSetup>("proxy");
  const [configMode, setConfigMode] = useState<ConfigurationMode>("automatic");
  const [storageOption, setStorageOption] = useState<ConfigStorageOption>("both");
  const [modelSlots, setModelSlots] = useState<Record<ModelSlot, string>>({
    opus: DEFAULT_MODELS.opus.name,
    sonnet: DEFAULT_MODELS.sonnet.name,
    haiku: DEFAULT_MODELS.haiku.name,
  });
  const [useOAuth, setUseOAuth] = useState(agent.id === "gemini-cli");

  // UI state
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [configResult, setConfigResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);

  // Dynamic models state
  const [availableModels, setAvailableModels] = useState<modelsService.AvailableModel[]>(
    modelsService.getDefaultModels()
  );
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const proxyURL = `http://127.0.0.1:${proxyPort}/v1`;

  // Load models and backups on mount
  useEffect(() => {
    loadModels();
    loadBackups();
  }, []);

  const loadModels = async (forceRefresh = false) => {
    setIsFetchingModels(true);
    try {
      const models = await modelsService.fetchModels(proxyURL, undefined, forceRefresh);
      setAvailableModels(models);
    } catch {
      setAvailableModels(modelsService.getDefaultModels());
    } finally {
      setIsFetchingModels(false);
    }
  };

  const loadBackups = async () => {
    try {
      const backupsList = await agentsService.getAgentBackups(agent.id);
      setBackups(backupsList);
    } catch {
      // Ignore errors loading backups
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Usar a management_key do proxy para autenticação
      // Isso espelha o comportamento do Swift em AgentConfigurationService.testConnection()
      // que usa config.apiKey (o proxyManager.managementKey)
      let apiKey: string;
      try {
        apiKey = await invoke<string>("get_proxy_api_key");
      } catch {
        // Fallback para desenvolvimento
        apiKey = "zest-proxy-key";
      }

      const startTime = Date.now();
      const response = await fetch(`${proxyURL}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        const modelCount = data.data?.length ?? 0;
        setTestResult({
          success: true,
          message: `Connection successful! (${modelCount} models available)`,
          latencyMs: latency,
        });
      } else {
        const errorText = await response.text().catch(() => "");
        setTestResult({
          success: false,
          message: `Failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyConfig = async () => {
    setIsConfiguring(true);
    setConfigResult(null);

    try {
      const config: AgentConfiguration = {
        agent: agent.id,
        modelSlots,
        proxyURL,
        apiKey: "zest-proxy-key",
        useOAuth,
        setupMode,
      };

      await agentsService.configureAgentAdvanced(
        selectedShell,
        agent.id,
        config,
        configMode,
        storageOption
      );

      setConfigResult({
        success: true,
        message: `${agent.name} configured successfully! Restart your terminal to apply changes.`,
      });
      onSuccess(`${agent.name} configured successfully!`);
    } catch (err) {
      setConfigResult({
        success: false,
        message: err instanceof Error ? err.message : "Configuration failed",
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      await agentsService.restoreAgentBackup(agent.id, selectedBackup.path);
      setShowRestoreConfirm(false);
      setSelectedBackup(null);
      onSuccess(`Backup restored successfully!`);
      onClose();
    } catch (err) {
      setConfigResult({
        success: false,
        message: err instanceof Error ? err.message : "Restore failed",
      });
    }
  };

  const handleCopyManualConfig = () => {
    const shellExport = selectedShell === "fish" ? "set -gx" : "export";
    const envVar = agent.id === "claude-code"
      ? "ANTHROPIC_BASE_URL"
      : agent.id === "gemini-cli"
        ? "GEMINI_API_BASE"
        : "OPENAI_BASE_URL";

    let config = `# ${agent.name} Configuration\n`;
    config += `${shellExport} ${envVar}="${proxyURL}"\n`;

    if (agent.id === "claude-code") {
      config += `\n# Model Slots\n`;
      config += `${shellExport} ANTHROPIC_MODEL_OPUS="${modelSlots.opus}"\n`;
      config += `${shellExport} ANTHROPIC_MODEL_SONNET="${modelSlots.sonnet}"\n`;
      config += `${shellExport} ANTHROPIC_MODEL_HAIKU="${modelSlots.haiku}"\n`;
    }

    copyToClipboard(config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
            >
              {agent.icon}
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Configure {agent.name}</h2>
              <p className="text-xs text-foreground-muted">{agent.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {configResult ? (
            // Result View
            <div className="text-center py-8">
              {configResult.success ? (
                <>
                  <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-green-500 mb-2">Configuration Successful</h3>
                </>
              ) : (
                <>
                  <X className="w-16 h-16 mx-auto text-red-500 mb-4" />
                  <h3 className="text-lg font-semibold text-red-500 mb-2">Configuration Failed</h3>
                </>
              )}
              <p className="text-foreground-secondary">{configResult.message}</p>
            </div>
          ) : (
            // Configuration Form
            <>
              {/* Setup Mode */}
              <ConfigSection title="Setup Mode">
                <div className="grid grid-cols-2 gap-3">
                  <ModeButton
                    selected={setupMode === "proxy"}
                    onClick={() => setSetupMode("proxy")}
                    icon={<Layers className="w-5 h-5" />}
                    label="Proxy"
                    description="Route through Zest proxy"
                  />
                  <ModeButton
                    selected={setupMode === "default"}
                    onClick={() => setSetupMode("default")}
                    icon={<Zap className="w-5 h-5" />}
                    label="Default"
                    description="Use provider directly"
                  />
                </div>
                <p className="text-xs text-foreground-muted mt-2">
                  {setupMode === "proxy"
                    ? "All requests will be routed through the Zest proxy for quota management."
                    : "Requests will go directly to the provider without proxy."}
                </p>
              </ConfigSection>

              {/* Configuration Mode */}
              <ConfigSection title="Configuration Mode">
                <div className="grid grid-cols-2 gap-3">
                  <ModeButton
                    selected={configMode === "automatic"}
                    onClick={() => setConfigMode("automatic")}
                    icon={<Settings className="w-5 h-5" />}
                    label="Automatic"
                    description="Update config files directly"
                  />
                  <ModeButton
                    selected={configMode === "manual"}
                    onClick={() => setConfigMode("manual")}
                    icon={<FileJson className="w-5 h-5" />}
                    label="Manual"
                    description="Copy configuration"
                  />
                </div>
              </ConfigSection>

              {/* Storage Option (only for Claude Code in automatic mode) */}
              {agent.id === "claude-code" && configMode === "automatic" && (
                <ConfigSection title="Storage Location">
                  <div className="grid grid-cols-3 gap-3">
                    <StorageButton
                      selected={storageOption === "json"}
                      onClick={() => setStorageOption("json")}
                      icon={<FileJson className="w-4 h-4" />}
                      label="JSON Config"
                    />
                    <StorageButton
                      selected={storageOption === "shell"}
                      onClick={() => setStorageOption("shell")}
                      icon={<Terminal className="w-4 h-4" />}
                      label="Shell Profile"
                    />
                    <StorageButton
                      selected={storageOption === "both"}
                      onClick={() => setStorageOption("both")}
                      icon={<Layers className="w-4 h-4" />}
                      label="Both"
                    />
                  </div>
                </ConfigSection>
              )}

              {/* Proxy-specific options */}
              {setupMode === "proxy" && (
                <>
                  {/* Connection Info */}
                  <ConfigSection title="Connection Info">
                    <div className="space-y-2">
                      <InfoRow label="Proxy URL" value={proxyURL} />
                      <InfoRow label="API Key" value="zest-****-key" masked />
                    </div>
                  </ConfigSection>

                  {/* Model Slots (only for Claude Code) */}
                  {agent.id === "claude-code" && (
                    <div className="bg-background-secondary rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-foreground">Model Slots</h3>
                        <button
                          onClick={() => loadModels(true)}
                          disabled={isFetchingModels}
                          className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
                          title="Refresh models"
                        >
                          <RefreshCw className={`w-4 h-4 ${isFetchingModels ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {MODEL_SLOTS.map(({ slot, displayName, description }) => (
                          <ModelSlotRow
                            key={slot}
                            slot={slot}
                            displayName={displayName}
                            description={description}
                            selectedModel={modelSlots[slot]}
                            availableModels={availableModels}
                            onModelChange={(model) =>
                              setModelSlots((prev) => ({ ...prev, [slot]: model }))
                            }
                          />
                        ))}
                      </div>
                      {isFetchingModels && (
                        <p className="text-xs text-foreground-muted mt-2">Loading models from proxy...</p>
                      )}
                      {availableModels.length === 0 && !isFetchingModels && (
                        <p className="text-sm text-amber-500 mt-2">
                          Start the proxy and connect a provider to see available models.
                        </p>
                      )}
                    </div>
                  )}

                  {/* OAuth Toggle (only for Gemini CLI) */}
                  {agent.id === "gemini-cli" && (
                    <ConfigSection title="Authentication">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div>
                          <p className="font-medium text-foreground">Use OAuth</p>
                          <p className="text-xs text-foreground-muted">
                            Use OAuth for Gemini authentication
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={useOAuth}
                          onChange={(e) => setUseOAuth(e.target.checked)}
                          className="w-5 h-5 rounded border-zinc-600 bg-background-tertiary text-blue-500 focus:ring-blue-500"
                        />
                      </label>
                    </ConfigSection>
                  )}

                  {/* Manual Config Preview */}
                  {configMode === "manual" && (
                    <ConfigSection title="Configuration Preview">
                      <div className="bg-zinc-900 rounded-lg p-3 font-mono text-sm">
                        <pre className="text-green-400 whitespace-pre-wrap">
{`# ${agent.name} Configuration
${selectedShell === "fish" ? "set -gx" : "export"} ${
  agent.id === "claude-code"
    ? "ANTHROPIC_BASE_URL"
    : agent.id === "gemini-cli"
      ? "GEMINI_API_BASE"
      : "OPENAI_BASE_URL"
}="${proxyURL}"
${agent.id === "claude-code" ? `
# Model Slots
${selectedShell === "fish" ? "set -gx" : "export"} ANTHROPIC_MODEL_OPUS="${modelSlots.opus}"
${selectedShell === "fish" ? "set -gx" : "export"} ANTHROPIC_MODEL_SONNET="${modelSlots.sonnet}"
${selectedShell === "fish" ? "set -gx" : "export"} ANTHROPIC_MODEL_HAIKU="${modelSlots.haiku}"` : ""}`}
                        </pre>
                      </div>
                      <button
                        onClick={handleCopyManualConfig}
                        className="btn-secondary w-full mt-2 flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy Configuration</span>
                      </button>
                    </ConfigSection>
                  )}

                  {/* Test Connection */}
                  <ConfigSection title="Test Connection">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="btn-secondary flex items-center gap-2"
                      >
                        {isTesting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span>Test</span>
                      </button>
                      {testResult && (
                        <div className={`flex items-center gap-2 text-sm ${
                          testResult.success ? "text-green-500" : "text-red-500"
                        }`}>
                          {testResult.success ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          <span>{testResult.message}</span>
                          {testResult.latencyMs && (
                            <span className="text-foreground-muted">
                              ({testResult.latencyMs}ms)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </ConfigSection>
                </>
              )}

              {/* Backup/Restore */}
              {backups.length > 0 && (
                <ConfigSection title="Restore Backup">
                  <div className="flex flex-wrap gap-2">
                    {backups.slice(0, 5).map((backup) => (
                      <button
                        key={backup.id}
                        onClick={() => {
                          setSelectedBackup(backup);
                          setShowRestoreConfirm(true);
                        }}
                        className="px-3 py-2 bg-background-tertiary hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-2 transition-colors"
                      >
                        <Clock className="w-4 h-4 text-foreground-muted" />
                        <span>{backup.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">
                    Restore a previous configuration backup
                  </p>
                </ConfigSection>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800">
          {configResult ? (
            <>
              <div />
              <button
                onClick={onClose}
                className="btn-primary"
                style={{ backgroundColor: agent.color }}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleApplyConfig}
                disabled={isConfiguring}
                className="btn-primary flex items-center gap-2"
                style={{ backgroundColor: agent.color }}
              >
                {isConfiguring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : configMode === "automatic" ? (
                  <Settings className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {configMode === "automatic" ? "Apply Configuration" : "Save Config"}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Restore Confirm Dialog */}
        {showRestoreConfirm && selectedBackup && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-background border border-zinc-800 rounded-xl p-6 max-w-md">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Restore Backup?
              </h3>
              <p className="text-foreground-secondary mb-4">
                This will restore the configuration from "{selectedBackup.name}".
                Current configuration will be backed up first.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRestoreConfirm(false);
                    setSelectedBackup(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreBackup}
                  className="btn-danger flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Config Sheet Sub-Components
// ============================================================================

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background-secondary rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ModeButton({
  selected,
  onClick,
  icon,
  label,
  description
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 text-left transition-colors ${
        selected
          ? "border-blue-500 bg-blue-500/10"
          : "border-zinc-700 hover:border-zinc-600"
      }`}
    >
      <div className={`mb-2 ${selected ? "text-blue-500" : "text-foreground-muted"}`}>
        {icon}
      </div>
      <p className={`font-medium text-sm ${selected ? "text-foreground" : "text-foreground-secondary"}`}>
        {label}
      </p>
      <p className="text-xs text-foreground-muted">{description}</p>
    </button>
  );
}

function StorageButton({
  selected,
  onClick,
  icon,
  label
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg border-2 text-center transition-colors ${
        selected
          ? "border-blue-500 bg-blue-500/10"
          : "border-zinc-700 hover:border-zinc-600"
      }`}
    >
      <div className={`mx-auto mb-1 ${selected ? "text-blue-500" : "text-foreground-muted"}`}>
        {icon}
      </div>
      <p className={`text-xs ${selected ? "text-foreground" : "text-foreground-secondary"}`}>
        {label}
      </p>
    </button>
  );
}

function InfoRow({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-foreground-muted">{label}</span>
      <span className={`text-sm font-mono ${masked ? "text-foreground-muted" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function ModelSlotRow({
  slot,
  displayName,
  description,
  selectedModel,
  availableModels,
  onModelChange
}: {
  slot: ModelSlot;
  displayName: string;
  description: string;
  selectedModel: string;
  availableModels: modelsService.AvailableModel[];
  onModelChange: (model: string) => void;
}) {
  // Group models by provider
  const groupedModels = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, modelsService.AvailableModel[]>);

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{displayName}</p>
        <p className="text-xs text-foreground-muted">{description}</p>
      </div>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[250px]"
      >
        {Object.entries(groupedModels).map(([provider, models]) => (
          <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
            {models.map((model) => (
              <option key={model.id} value={model.name}>
                {model.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
