// Quota service - handles quota fetching for different providers

import { invoke } from "@tauri-apps/api/core";
import type { QuotaInfo } from "../types";

/**
 * Fetch quota for a specific provider and account
 */
export async function fetchQuota(provider: string, account: string): Promise<QuotaInfo> {
  return await invoke<QuotaInfo>("fetch_quota", { provider, account });
}

/**
 * Fetch all quotas
 */
export async function fetchAllQuotas(): Promise<QuotaInfo[]> {
  return await invoke<QuotaInfo[]>("fetch_all_quotas");
}

/**
 * Format quota display string
 */
export function formatQuota(quota: QuotaInfo): string {
  if (quota.is_unlimited) {
    return "Unlimited";
  }

  const used = formatNumber(quota.used);
  const limit = formatNumber(quota.limit);
  return `${used} / ${limit}`;
}

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Calculate quota percentage
 */
export function getQuotaPercentage(quota: QuotaInfo): number {
  if (quota.is_unlimited || quota.limit === 0) {
    return 0;
  }
  return Math.min(100, Math.round((quota.used / quota.limit) * 100));
}

/**
 * Get quota status color
 */
export function getQuotaColor(quota: QuotaInfo): string {
  if (quota.is_unlimited) {
    return "#3b82f6"; // blue
  }

  const percentage = getQuotaPercentage(quota);

  if (percentage >= 90) {
    return "#ef4444"; // red
  } else if (percentage >= 70) {
    return "#f59e0b"; // orange
  } else {
    return "#22c55e"; // green
  }
}

/**
 * Format reset time
 */
export function formatResetTime(resetAt: string | undefined): string {
  if (!resetAt) {
    return "Unknown";
  }

  const resetDate = new Date(resetAt);
  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Now";
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMins}m`;
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m`;
  }
}
