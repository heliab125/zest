import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Shield,
} from "lucide-react";
import * as proxyService from "../services/proxy";
import { copyToClipboard } from "../services/proxy";

interface APIKey {
  id: string;
  key: string;
  name: string;
  provider: string;
  createdAt: string;
  lastUsed?: string;
}

export function APIKeysScreen() {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const keys = await proxyService.getApiKeys();
      setApiKeys(keys);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleAddKey = async () => {
    if (!newKey.trim()) return;

    setAdding(true);
    setError(null);
    try {
      await proxyService.addApiKey(newKey.trim());
      setNewKey("");
      setShowAddForm(false);
      setSuccess("API key added successfully");
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteKey = async (key: string) => {
    setDeleting(key);
    setError(null);
    try {
      await proxyService.deleteApiKey(key);
      setSuccess("API key deleted successfully");
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await copyToClipboard(key);
      setSuccess("API key copied to clipboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleKeyVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
  };

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="w-full max-w-none px-2 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
            <p className="text-foreground-secondary">
              Manage API keys for proxy authentication
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Key</span>
            </button>
            <button
              onClick={loadApiKeys}
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

        {/* Add Key Form */}
        {showAddForm && (
          <div className="card border border-blue-500/30">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Add New API Key
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-foreground-secondary mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Enter your API key..."
                  className="w-full bg-background-tertiary text-foreground border border-zinc-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="mt-1 text-xs text-foreground-muted">
                  This key will be used to authenticate requests to the proxy
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddKey}
                  disabled={adding || !newKey.trim()}
                  className="btn-success flex items-center gap-2"
                >
                  {adding ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Add Key</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey("");
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="card bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">
                About API Keys
              </h3>
              <p className="text-sm text-foreground-secondary mt-1">
                API keys are used to authenticate requests to the proxy server.
                When network access is enabled, clients must provide one of these
                keys in the Authorization header to use the proxy.
              </p>
            </div>
          </div>
        </div>

        {/* API Keys List */}
        {loading ? (
          <div className="card">
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-foreground-muted animate-spin" />
            </div>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="card text-center py-12">
            <Key className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No API Keys
            </h2>
            <p className="text-foreground-muted mb-4">
              Add an API key to enable authenticated access to the proxy
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Key</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key, index) => {
              const isVisible = visibleKeys.has(key);
              const isDeleting = deleting === key;

              return (
                <div key={index} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Key className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-mono text-foreground">
                          {isVisible ? key : maskKey(key)}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          Key #{index + 1}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKeyVisibility(key)}
                        className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
                        title={isVisible ? "Hide key" : "Show key"}
                      >
                        {isVisible ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyKey(key)}
                        className="p-2 text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
                        title="Copy key"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteKey(key)}
                        disabled={isDeleting}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete key"
                      >
                        {isDeleting ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Usage Example */}
        {apiKeys.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Usage Example
            </h2>
            <p className="text-foreground-secondary mb-3">
              Include the API key in your requests:
            </p>
            <div className="bg-background-tertiary rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <code className="text-green-400">
                curl -H "Authorization: Bearer YOUR_API_KEY" \<br />
                &nbsp;&nbsp;http://localhost:8317/v1/chat/completions
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
