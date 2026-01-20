// Custom hooks for Zest

import { useState, useEffect, useCallback } from "react";
import type { ProxyStatus, AuthFile, QuotaInfo, AppSettings } from "../types";
import * as proxyService from "../services/proxy";
import * as quotaService from "../services/quota";
import * as settingsService from "../services/settings";

/**
 * Hook for proxy status with auto-refresh
 */
export function useProxyStatus(refreshInterval = 5000) {
  const [status, setStatus] = useState<ProxyStatus>({
    running: false,
    port: 8317,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [binaryInstalled, setBinaryInstalled] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [newStatus, installed] = await Promise.all([
        proxyService.getProxyStatus(),
        proxyService.isBinaryInstalled(),
      ]);
      setStatus(newStatus);
      setBinaryInstalled(installed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  // Poll download progress when downloading
  useEffect(() => {
    if (!downloading) return;

    const pollProgress = async () => {
      try {
        const [progress, stillDownloading] = await Promise.all([
          proxyService.getDownloadProgress(),
          proxyService.isDownloading(),
        ]);
        setDownloadProgress(progress);
        if (!stillDownloading) {
          setDownloading(false);
          refresh();
        }
      } catch {
        // ignore errors during progress polling
      }
    };

    const interval = setInterval(pollProgress, 500);
    return () => clearInterval(interval);
  }, [downloading, refresh]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const newStatus = await proxyService.startProxy();
      setStatus(newStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      const newStatus = await proxyService.stopProxy();
      setStatus(newStatus);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const install = useCallback(async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      await proxyService.installProxyBinary();
      setBinaryInstalled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
      refresh();
    }
  }, [refresh]);

  return {
    status,
    loading,
    error,
    binaryInstalled,
    downloading,
    downloadProgress,
    refresh,
    start,
    stop,
    install,
  };
}

/**
 * Hook for auth files
 * Uses proxy API when running, falls back to direct file scan
 */
export function useAuthFiles(refreshInterval = 10000) {
  const [authFiles, setAuthFiles] = useState<AuthFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDirectScan, setUsingDirectScan] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // Try to get files with fallback to direct scan
      const files = await proxyService.getAuthFilesWithFallback();
      setAuthFiles(files);
      setError(null);

      // Check if we're using direct scan (proxy not running)
      try {
        const status = await proxyService.getProxyStatus();
        setUsingDirectScan(!status.running);
      } catch {
        setUsingDirectScan(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  const deleteFile = useCallback(
    async (fileId: string, filePath?: string, fileName?: string) => {
      if (usingDirectScan && filePath) {
        // Use direct delete when proxy is not running
        await proxyService.deleteAuthFileDirect(filePath);
      } else if (fileName) {
        // Use proxy API with file name (matches Swift ManagementAPIClient)
        await proxyService.deleteAuthFile(fileName);
      } else {
        // Fallback: use fileId as fileName for backwards compatibility
        await proxyService.deleteAuthFile(fileId);
      }
      await refresh();
    },
    [refresh, usingDirectScan]
  );

  const toggleFile = useCallback(
    async (fileId: string, disabled: boolean, filePath?: string) => {
      if (usingDirectScan && filePath) {
        // Use direct toggle when proxy is not running
        await proxyService.toggleAuthFileDirect(filePath, disabled);
      } else {
        // Use proxy API
        await proxyService.toggleAuthFile(fileId, disabled);
      }
      await refresh();
    },
    [refresh, usingDirectScan]
  );

  const createFile = useCallback(
    async (provider: string, email: string, token: string) => {
      await proxyService.createAuthFile(provider, email, token);
      await refresh();
    },
    [refresh]
  );

  return {
    authFiles,
    loading,
    error,
    usingDirectScan,
    refresh,
    deleteFile,
    toggleFile,
    createFile,
  };
}

/**
 * Hook for quotas
 */
export function useQuotas(refreshInterval = 30000) {
  const [quotas, setQuotas] = useState<QuotaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await quotaService.fetchAllQuotas();
      setQuotas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return { quotas, loading, error, refresh };
}

/**
 * Hook for settings
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(settingsService.DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (newSettings: AppSettings) => {
    setLoading(true);
    try {
      await settingsService.saveSettings(newSettings);
      setSettings(newSettings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, loading, error, load, save, update };
}

/**
 * Hook for API keys
 */
export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
    refresh();
  }, [refresh]);

  const addKey = useCallback(async (key: string) => {
    await proxyService.addApiKey(key);
    await refresh();
  }, [refresh]);

  const deleteKey = useCallback(async (key: string) => {
    await proxyService.deleteApiKey(key);
    await refresh();
  }, [refresh]);

  return { apiKeys, loading, error, refresh, addKey, deleteKey };
}
