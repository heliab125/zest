/**
 * Service for fetching available models from the proxy
 * Implements cache with stale-while-revalidate pattern
 */

import { invoke } from "@tauri-apps/api/core";

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  isDefault: boolean;
}

interface AuthFileModel {
  id: string;
  name: string | null;
  provider: string | null;
  owned_by: string | null;
}

interface ModelListResponse {
  data: Array<{
    id: string;
    owned_by?: string;
  }>;
}

// Cache de modelos por authFile
const modelCacheByAuth: Map<string, { models: AvailableModel[]; timestamp: number }> = new Map();
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutos

/**
 * Fetches available models for a specific auth file from the proxy
 * Uses the /auth-files/models?name=<authFileName> endpoint (matching Swift implementation)
 *
 * @param authFileName - The name of the auth file to fetch models for
 * @param forceRefresh - Force refresh the cache
 */
export async function fetchModelsForAuthFile(
  authFileName: string,
  forceRefresh = false
): Promise<AvailableModel[]> {
  // Verificar cache (retorna imediatamente se não está stale)
  const cached = modelCacheByAuth.get(authFileName);
  if (!forceRefresh && cached) {
    const age = Date.now() - cached.timestamp;
    if (age < STALE_THRESHOLD) {
      return cached.models;
    }
  }

  try {
    // Use the new Tauri command that calls /auth-files/models?name=<authFileName>
    const authModels = await invoke<AuthFileModel[]>("fetch_auth_file_models", {
      authFileName,
    });

    const models: AvailableModel[] = authModels.map((item) => ({
      id: item.id,
      name: item.name || item.id,
      provider: item.provider || item.owned_by || inferProvider(item.id),
      isDefault: false,
    }));

    // Salvar no cache
    modelCacheByAuth.set(authFileName, { models, timestamp: Date.now() });

    return models;
  } catch (error) {
    console.error("Failed to fetch models for auth file:", authFileName, error);
    // Fallback para cache stale ou array vazio
    if (cached) {
      return cached.models;
    }
    return [];
  }
}

/**
 * Fetches available models from the proxy endpoint (generic /models)
 * Uses cache with stale-while-revalidate pattern
 *
 * IMPORTANT: This uses the proxy's management_key (via get_proxy_api_key),
 * NOT a provider-specific API key. The proxy handles authentication with
 * providers internally - all we need is the management key to talk to the proxy.
 *
 * This matches the Swift implementation in AgentConfigurationService.fetchAvailableModels()
 * which uses config.apiKey (the proxyManager.managementKey).
 *
 * @param proxyUrl - The proxy URL to fetch models from
 * @param _authFilePath - Deprecated, not used (kept for API compatibility)
 * @param forceRefresh - Force refresh the cache
 */
export async function fetchModels(
  proxyUrl: string,
  _authFilePath?: string,
  forceRefresh = false
): Promise<AvailableModel[]> {
  // Cache global para endpoint /models genérico
  const cacheKey = "__global__";
  const cached = modelCacheByAuth.get(cacheKey);

  // Verificar cache (retorna imediatamente se não está stale)
  if (!forceRefresh && cached) {
    const age = Date.now() - cached.timestamp;
    if (age < STALE_THRESHOLD) {
      return cached.models;
    }
  }

  try {
    // CORREÇÃO: Usar sempre a management_key do proxy
    // O endpoint /models do proxy aceita a management_key e retorna todos os modelos
    // disponíveis de todos os provedores conectados. Isso espelha o comportamento
    // do Swift em AgentConfigurationService.fetchAvailableModels() que usa config.apiKey
    // (que é o proxyManager.managementKey)
    let apiKey: string;
    try {
      apiKey = await invoke<string>("get_proxy_api_key");
    } catch {
      // Fallback apenas para desenvolvimento local
      console.warn("[models] get_proxy_api_key failed, using fallback");
      apiKey = "zest-proxy-key";
    }

    console.log("[models] Fetching from:", `${proxyUrl}/models`);

    const response = await fetch(`${proxyUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[models] Fetch failed:", response.status, errorText);
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data: ModelListResponse = await response.json();
    console.log("[models] Received", data.data?.length ?? 0, "models");

    const models: AvailableModel[] = (data.data || []).map((item) => ({
      id: item.id,
      name: item.id,
      provider: inferProvider(item.id, item.owned_by),
      isDefault: false,
    }));

    // Salvar no cache
    modelCacheByAuth.set(cacheKey, { models, timestamp: Date.now() });

    return models;
  } catch (error) {
    console.error("[models] Error fetching models:", error);
    // Fallback para cache stale ou array vazio
    if (cached) {
      return cached.models;
    }
    return getDefaultModels();
  }
}

/**
 * Infers the provider from model ID and owned_by field
 */
export function inferProvider(modelId: string, ownedBy?: string): string {
  if (ownedBy) return ownedBy;

  const id = modelId.toLowerCase();
  if (id.includes("claude") || id.includes("anthropic")) return "anthropic";
  if (id.includes("gemini") || id.includes("google")) return "google";
  if (id.includes("gpt") || id.includes("openai")) return "openai";
  if (id.includes("deepseek")) return "deepseek";
  if (id.includes("qwen")) return "qwen";

  return "openai"; // Default fallback
}

/**
 * Returns empty array when proxy is not available
 * This prevents showing hardcoded models that may not match connected providers
 */
export function getDefaultModels(): AvailableModel[] {
  return [];
}

/**
 * Clears the model cache
 */
export function clearModelCache(): void {
  modelCacheByAuth.clear();
}

/**
 * Clears cache for a specific auth file
 */
export function clearModelCacheForAuth(authFileName: string): void {
  modelCacheByAuth.delete(authFileName);
}
