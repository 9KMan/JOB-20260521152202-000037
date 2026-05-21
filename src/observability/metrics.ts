import type { ToolResult } from '../types.js';

interface ToolMetrics {
  invocations: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
  lastInvoked: string | null;
  lastSuccess: string | null;
  lastFailure: string | null;
}

const toolMetrics: Map<string, ToolMetrics> = new Map();

// Record tool invocation
export function recordToolInvocation(
  toolName: string,
  result: ToolResult,
  durationMs: number
): void {
  let metrics = toolMetrics.get(toolName);
  if (!metrics) {
    metrics = {
      invocations: 0,
      successes: 0,
      failures: 0,
      totalDurationMs: 0,
      lastInvoked: null,
      lastSuccess: null,
      lastFailure: null,
    };
    toolMetrics.set(toolName, metrics);
  }

  metrics.invocations++;
  metrics.totalDurationMs += durationMs;
  metrics.lastInvoked = new Date().toISOString();

  if (result.success) {
    metrics.successes++;
    metrics.lastSuccess = new Date().toISOString();
  } else {
    metrics.failures++;
    metrics.lastFailure = new Date().toISOString();
  }
}

// Get metrics for a tool
export function getToolMetrics(toolName: string): ToolMetrics | null {
  return toolMetrics.get(toolName) || null;
}

// Get all metrics
export function getAllMetrics(): Map<string, ToolMetrics> {
  return new Map(toolMetrics);
}

// Calculate p50, p95, p99 latencies (simplified)
export function getLatencyStats(toolName: string): { p50: number; p95: number; p99: number } | null {
  const metrics = toolMetrics.get(toolName);
  if (!metrics || metrics.invocations === 0) return null;

  const avg = metrics.totalDurationMs / metrics.invocations;
  return {
    p50: Math.round(avg * 1.0),  // Simplified - real impl would track histogram
    p95: Math.round(avg * 2.0),
    p99: Math.round(avg * 3.0),
  };
}