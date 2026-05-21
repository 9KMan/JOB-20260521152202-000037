import { describe, it, expect } from 'vitest';
import { getHealthStatus } from '../src/observability/health.js';

describe('HealthCheck', () => {
  it('should return healthy status', () => {
    const status = getHealthStatus('stdio', 0);

    expect(status.status).toBe('healthy');
    expect(status.transport).toBe('stdio');
    expect(status.uptime).toBeGreaterThan(0);
    expect(status.timestamp).toBeDefined();
  });

  it('should track active connections', () => {
    const status = getHealthStatus('http-sse', 5);

    expect(status.activeConnections).toBe(5);
    expect(status.transport).toBe('http-sse');
  });
});