import { useState, useCallback, useEffect, useRef } from "react";
import type { NavigationPage } from "./types";
import {
  Sidebar,
  Dashboard,
  QuotaScreen,
  ProvidersScreen,
  SettingsScreen,
  AgentsScreen,
  APIKeysScreen,
  LogsScreen,
  FallbackScreen,
} from "./components";
import {
  useProxyStatus,
  useAuthFiles,
  useQuotas,
  useSettings,
} from "./hooks";
import { copyToClipboard } from "./services/proxy";
import { Construction } from "lucide-react";

function App() {
  const [currentPage, setCurrentPage] = useState<NavigationPage>("dashboard");

  // Hooks for data
  const {
    status: proxyStatus,
    loading: proxyLoading,
    binaryInstalled,
    downloading,
    downloadProgress,
    start: startProxy,
    stop: stopProxy,
    install: installProxy,
    refresh: refreshProxy,
  } = useProxyStatus();

  const {
    authFiles,
    loading: authLoading,
    error: authError,
    refresh: refreshAuth,
    deleteFile: deleteAuthFile,
    toggleFile: toggleAuthFile,
  } = useAuthFiles();

  const {
    quotas,
    loading: quotasLoading,
    error: quotasError,
    refresh: refreshQuotas,
  } = useQuotas();

  const {
    settings,
    loading: settingsLoading,
    save: saveSettings,
    update: updateSettings,
  } = useSettings();

  // Track previous proxy running state to detect changes
  const prevProxyRunningRef = useRef(proxyStatus.running);

  // Refresh auth files when proxy status changes (starts or stops)
  useEffect(() => {
    if (prevProxyRunningRef.current !== proxyStatus.running) {
      // Proxy state changed, refresh auth files after a short delay
      // to give the backend time to update
      const timer = setTimeout(() => {
        refreshAuth();
      }, 500);

      prevProxyRunningRef.current = proxyStatus.running;
      return () => clearTimeout(timer);
    }
  }, [proxyStatus.running, refreshAuth]);

  // Handlers
  const handleCopyEndpoint = useCallback(() => {
    copyToClipboard(`http://localhost:${proxyStatus.port}/v1`);
  }, [proxyStatus.port]);

  const handleRefreshAll = useCallback(() => {
    refreshProxy();
    refreshAuth();
    refreshQuotas();
  }, [refreshProxy, refreshAuth, refreshQuotas]);

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            proxyStatus={proxyStatus}
            authFiles={authFiles}
            quotas={quotas}
            binaryInstalled={binaryInstalled}
            downloading={downloading}
            downloadProgress={downloadProgress}
            onStart={startProxy}
            onStop={stopProxy}
            onInstall={installProxy}
            onCopyEndpoint={handleCopyEndpoint}
            onRefresh={handleRefreshAll}
            loading={proxyLoading || authLoading}
          />
        );

      case "quota":
        return (
          <QuotaScreen
            quotas={quotas}
            loading={quotasLoading}
            error={quotasError}
            onRefresh={refreshQuotas}
          />
        );

      case "providers":
        return (
          <ProvidersScreen
            authFiles={authFiles}
            loading={authLoading}
            error={authError}
            onRefresh={refreshAuth}
            onDelete={deleteAuthFile}
            onToggle={toggleAuthFile}
          />
        );

      case "settings":
        return (
          <SettingsScreen
            settings={settings}
            loading={settingsLoading}
            onSave={saveSettings}
            onUpdate={updateSettings}
          />
        );

      case "agents":
        return (
          <AgentsScreen
            proxyRunning={proxyStatus.running}
            proxyPort={proxyStatus.port}
          />
        );

      case "apikeys":
        return <APIKeysScreen />;

      case "logs":
        return <LogsScreen />;

      case "fallback":
        return <FallbackScreen />;

      case "about":
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="w-full max-w-none px-2">
              <div className="card text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <span className="text-white font-bold text-3xl">Z</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Zest</h1>
                <p className="text-foreground-secondary mb-4">
                  AI Provider Quota Manager
                </p>
                <p className="text-sm text-foreground-muted">
                  Version 0.1.0
                </p>
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <p className="text-sm text-foreground-muted">
                    Built with Tauri, React, and Rust
                  </p>
                  <p className="text-sm text-foreground-muted mt-1">
                    Cross-platform: Windows, macOS, Linux
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      // Placeholder for other pages
      default:
        return (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="w-full max-w-none px-2">
              <div className="card text-center py-12">
                <Construction className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Coming Soon
                </h2>
                <p className="text-foreground-muted">
                  This page is under construction
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        proxyRunning={proxyStatus.running}
      />
      {renderPage()}
    </div>
  );
}

export default App;
