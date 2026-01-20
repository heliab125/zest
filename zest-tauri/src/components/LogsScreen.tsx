import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  RefreshCw,
  FileText,
  Trash2,
  Download,
  Filter,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Sparkles,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import { openLogsFolder } from "../services/proxy";

type LogLevel = "all" | "info" | "warn" | "error" | "debug" | "success";
type LogFilter = "all" | "llm" | "management";

// Usage detail entry from the API
interface UsageDetail {
  timestamp: string;
  source: string;
  auth_index: string;
  tokens: {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cached_tokens: number;
    total_tokens: number;
  };
  failed: boolean;
}

// Model usage info
interface ModelUsage {
  total_requests: number;
  total_tokens: number;
  details: UsageDetail[];
}

// Log entry with model info
interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug" | "success";
  message: string;
  statusCode?: number;
  model?: string;
  account?: string;
  durationMs?: number;
  endpoint?: string;
  method?: string;
  requestId?: string;
  isLLM: boolean;
  isManagement: boolean;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
}

// Response from proxy management API
interface LogsApiResponse {
  lines: string[] | null;
  line_count: number | null;
  latest_timestamp: number | null;
}

// Maximum logs to display
const MAX_LOGS = 100;

// Endpoints that are LLM requests
const LLM_ENDPOINTS = [
  "/v1/messages",
  "/v1/chat/completions",
  "/v1/completions",
  "/chat/completions",
  "/api/generate",
];

// Endpoints that are management/internal
const MANAGEMENT_ENDPOINTS = [
  "/v0/management",
  "/api/event_logging",
  "/v1/api/event_logging",
];

function isLLMEndpoint(endpoint: string): boolean {
  return LLM_ENDPOINTS.some((llm) => endpoint.includes(llm));
}

function isManagementEndpoint(endpoint: string): boolean {
  return MANAGEMENT_ENDPOINTS.some((mgmt) => endpoint.includes(mgmt));
}

// Parse a log line from the proxy API
function parseLogLine(line: string, index: number): LogEntry | null {
  const match = line.match(
    /\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+\[([^\]]*)\]\s+\[(\w+)\s*\]\s+\[([^\]]+)\]\s+(.*)/
  );

  if (!match) return null;

  const [, timestamp, requestId, levelStr, , message] = match;

  let level: LogEntry["level"] = "info";
  const levelLower = levelStr.toLowerCase().trim();
  if (levelLower === "error" || levelLower === "err") {
    level = "error";
  } else if (levelLower === "warn" || levelLower === "warning") {
    level = "warn";
  } else if (levelLower === "debug") {
    level = "debug";
  }

  const statusMatch = message.match(/^(\d{3})\s+\|/);
  let statusCode: number | undefined;
  if (statusMatch) {
    statusCode = parseInt(statusMatch[1], 10);
    if (statusCode >= 200 && statusCode < 300) {
      level = "success";
    } else if (statusCode >= 400 && statusCode < 500) {
      level = "warn";
    } else if (statusCode >= 500) {
      level = "error";
    }
  }

  let durationMs: number | undefined;
  const durationMatch = message.match(/\|\s+([\d.]+)(ms|s)\s+\|/);
  if (durationMatch) {
    const value = parseFloat(durationMatch[1]);
    durationMs = durationMatch[2] === "s" ? Math.round(value * 1000) : Math.round(value);
  }

  let method: string | undefined;
  let endpoint: string | undefined;
  const httpMatch = message.match(/\|\s+(GET|POST|PUT|DELETE|PATCH)\s+"([^"]+)"/);
  if (httpMatch) {
    method = httpMatch[1];
    endpoint = httpMatch[2];
  }

  const isLLM = endpoint ? isLLMEndpoint(endpoint) : false;
  const isManagement = endpoint ? isManagementEndpoint(endpoint) : false;

  return {
    id: `log-${index}-${timestamp}-${requestId || "none"}`,
    timestamp: timestamp.replace(" ", "T") + "-03:00",
    level,
    message: message.trim(),
    statusCode,
    durationMs,
    method,
    endpoint,
    requestId: requestId !== "--------" ? requestId : undefined,
    isLLM,
    isManagement,
  };
}

// Correlate logs with usage data to get model names
function enrichLogsWithUsage(
  logs: LogEntry[],
  usageData: Record<string, { models: Record<string, ModelUsage> }>
): LogEntry[] {
  // Build a map of timestamp -> model info
  const timestampToModel = new Map<string, { model: string; account: string; tokens: { input: number; output: number; total: number } }>();

  // Process usage data
  for (const apiKey in usageData) {
    const apiUsage = usageData[apiKey];
    if (!apiUsage?.models) continue;

    for (const modelName in apiUsage.models) {
      const modelUsage = apiUsage.models[modelName];
      if (!modelUsage?.details) continue;

      for (const detail of modelUsage.details) {
        // Parse timestamp and create a key (use minute precision for matching)
        const ts = new Date(detail.timestamp);
        const key = `${ts.getHours()}:${ts.getMinutes()}:${ts.getSeconds()}`;
        timestampToModel.set(key, {
          model: modelName,
          account: detail.source,
          tokens: {
            input: detail.tokens.input_tokens,
            output: detail.tokens.output_tokens,
            total: detail.tokens.total_tokens,
          },
        });
      }
    }
  }

  // Enrich logs with model info
  return logs.map((log) => {
    if (!log.isLLM) return log;

    // Try to match by timestamp
    const logTs = new Date(log.timestamp);
    const key = `${logTs.getHours()}:${logTs.getMinutes()}:${logTs.getSeconds()}`;
    const match = timestampToModel.get(key);

    if (match) {
      return {
        ...log,
        model: match.model,
        account: match.account,
        tokens: match.tokens,
      };
    }

    return log;
  });
}

export function LogsScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [typeFilter, setTypeFilter] = useState<LogFilter>("llm");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showManagement, setShowManagement] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch both logs and usage data in parallel
      const [logsResponse, usageResponse] = await Promise.all([
        invoke<LogsApiResponse>("fetch_logs", { afterTimestamp: null }),
        invoke<{ usage?: { apis?: Record<string, { models: Record<string, ModelUsage> }> } }>("fetch_usage"),
      ]);

      if (logsResponse?.lines?.length) {
        let parsedLogs = logsResponse.lines
          .map((line, index) => parseLogLine(line, index))
          .filter((log): log is LogEntry => log !== null)
          .reverse()
          .slice(0, MAX_LOGS);

        // Enrich with model info from usage data
        if (usageResponse?.usage?.apis) {
          parsedLogs = enrichLogsWithUsage(parsedLogs, usageResponse.usage.apis);
        }

        setLogs(parsedLogs);
      } else {
        setLogs([]);
      }

      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (
        !errorMsg.includes("not found") &&
        !errorMsg.includes("No such file") &&
        !errorMsg.includes("Proxy not running")
      ) {
        console.error("Error loading logs:", errorMsg);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLogs(true);
    intervalRef.current = setInterval(() => loadLogs(false), 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadLogs]);

  const handleClearLogs = async () => {
    try {
      await invoke("clear_logs");
      setLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRefresh = () => loadLogs(true);

  const handleExportLogs = () => {
    const logText = filteredLogs
      .map((log) => {
        const status = log.statusCode ? `[${log.statusCode}]` : "";
        const duration = log.durationMs ? `(${log.durationMs}ms)` : "";
        const model = log.model ? `[${log.model}]` : "";
        const account = log.account ? `<${log.account}>` : "";
        return `[${log.timestamp}] ${model} ${account} ${status} ${log.method || ""} ${log.endpoint || log.message} ${duration}`;
      })
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zest-logs-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenLogsFolder = async () => {
    try {
      await openLogsFolder();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (typeFilter === "llm" && !log.isLLM) return false;
    if (typeFilter === "management" && !log.isManagement) return false;
    if (!showManagement && log.isManagement && typeFilter === "all") return false;

    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.endpoint?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.account?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.requestId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.statusCode?.toString().includes(searchQuery);

    return matchesLevel && matchesSearch;
  });

  const getLevelIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-400" />;
      case "warn":
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "debug":
        return <Bug className="w-4 h-4 text-purple-400" />;
    }
  };

  const getStatusBadgeColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return "bg-green-500/20 text-green-400 border-green-500/30";
    } else if (statusCode >= 400 && statusCode < 500) {
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    } else if (statusCode >= 500) {
      return "bg-red-500/20 text-red-400 border-red-500/30";
    }
    return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return timestamp.split("T")[1]?.split("-")[0] || timestamp;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatModel = (model: string) => {
    // Shorten common model names
    return model
      .replace("claude-opus-4-5-thinking", "Opus 4.5")
      .replace("claude-sonnet-4-5-thinking", "Sonnet 4.5")
      .replace("claude-sonnet-4-5", "Sonnet 4.5")
      .replace("gemini-3-flash", "Gemini 3 Flash")
      .replace("gemini-3-pro", "Gemini 3 Pro")
      .replace("gemini-2.5-pro", "Gemini 2.5 Pro")
      .replace("gpt-4o", "GPT-4o");
  };

  const llmLogs = logs.filter((l) => l.isLLM);
  const successCount = llmLogs.filter((l) => l.level === "success").length;
  const errorCount = llmLogs.filter((l) => l.level === "error" || l.level === "warn").length;
  const totalLLM = llmLogs.length;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logs</h1>
            <p className="text-foreground-secondary">
              View proxy requests and responses
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="card border border-red-500/30 bg-red-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models, accounts, endpoints..."
                className="w-full bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as LogFilter)}
                className="bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="llm">🤖 LLM Requests Only</option>
                <option value="all">📋 All Requests</option>
                <option value="management">⚙️ Management Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-foreground-muted" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LogLevel)}
                className="bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="success">✅ Success (2xx)</option>
                <option value="warn">⚠️ Warning (4xx)</option>
                <option value="error">❌ Error (5xx)</option>
              </select>
            </div>

            {typeFilter === "all" && (
              <button
                onClick={() => setShowManagement(!showManagement)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  showManagement
                    ? "bg-zinc-700 border-zinc-600 text-foreground"
                    : "bg-background-tertiary border-zinc-700 text-foreground-muted"
                }`}
              >
                {showManagement ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm">Internal</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-700">
            <button onClick={handleOpenLogsFolder} className="btn-secondary flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span>Open Folder</span>
            </button>
            <button onClick={handleExportLogs} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={handleClearLogs}
              className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <p className="text-foreground-muted text-sm">LLM Requests</p>
            <p className="text-2xl font-bold text-foreground">{totalLLM}</p>
          </div>
          <div className="card">
            <p className="text-foreground-muted text-sm">Success (2xx)</p>
            <p className="text-2xl font-bold text-green-400">{successCount}</p>
          </div>
          <div className="card">
            <p className="text-foreground-muted text-sm">Errors (4xx/5xx)</p>
            <p className="text-2xl font-bold text-red-400">{errorCount}</p>
          </div>
          <div className="card">
            <p className="text-foreground-muted text-sm">Showing</p>
            <p className="text-2xl font-bold text-blue-400">{filteredLogs.length}</p>
          </div>
        </div>

        {/* Logs List */}
        <div className="card">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-foreground-muted animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {typeFilter === "llm" ? "No LLM Requests Found" : "No Logs Found"}
              </h2>
              <p className="text-foreground-muted">
                {typeFilter === "llm"
                  ? "LLM requests (like /v1/messages) will appear here"
                  : "Logs will appear here when the proxy handles requests"}
              </p>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-sm max-h-[500px] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 p-2 hover:bg-background-tertiary rounded transition-colors ${
                    log.isLLM ? "border-l-2 border-purple-500" : ""
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-foreground-muted whitespace-nowrap text-xs">
                    {formatTimestamp(log.timestamp)}
                  </span>

                  {/* Level Icon */}
                  <span className="flex-shrink-0">{getLevelIcon(log.level)}</span>

                  {/* Status Code */}
                  {log.statusCode && (
                    <span
                      className={`px-1.5 py-0.5 text-xs font-bold rounded border ${getStatusBadgeColor(
                        log.statusCode
                      )}`}
                    >
                      {log.statusCode}
                    </span>
                  )}

                  {/* Model Badge - PROMINENT */}
                  {log.model && (
                    <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {formatModel(log.model)}
                    </span>
                  )}

                  {/* Account */}
                  {log.account && (
                    <span className="px-1.5 py-0.5 text-xs bg-zinc-700/50 text-zinc-400 rounded flex items-center gap-1" title={log.account}>
                      <User className="w-3 h-3" />
                      {log.account.split("@")[0]}
                    </span>
                  )}

                  {/* Method */}
                  {log.method && (
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        log.method === "POST"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                      }`}
                    >
                      {log.method}
                    </span>
                  )}

                  {/* Endpoint - smaller if we have model */}
                  <span className={`text-foreground flex-1 break-all ${log.model ? "text-xs text-foreground-muted" : ""}`}>
                    {log.endpoint || log.message}
                  </span>

                  {/* Tokens (if available) */}
                  {log.tokens && (
                    <span className="text-xs text-cyan-400 whitespace-nowrap" title={`In: ${log.tokens.input} | Out: ${log.tokens.output}`}>
                      {log.tokens.total.toLocaleString()} tok
                    </span>
                  )}

                  {/* Duration */}
                  {log.durationMs !== undefined && (
                    <span
                      className={`text-xs whitespace-nowrap ${
                        log.durationMs > 5000 ? "text-amber-400" : "text-foreground-muted"
                      }`}
                    >
                      {formatDuration(log.durationMs)}
                    </span>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        <p className="text-center text-sm text-foreground-muted">
          Auto-refreshing every 2 seconds • Showing {filteredLogs.length} of {logs.length} logs
        </p>
      </div>
    </div>
  );
}
