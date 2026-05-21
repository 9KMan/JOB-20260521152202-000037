interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  transport: string;
  activeConnections: number;
  uptime: number;
  timestamp: string;
  version: string;
  checks: {
    memory: { status: 'ok' | 'warning' | 'error'; used: number; total: number };
    tools: { status: 'ok' | 'warning'; registered: number };
  };
}

export function getHealthStatus(transport: string, activeConnections = 0): HealthStatus {
  const memUsage = process.memoryUsage();
  const memTotal = memUsage.heapTotal;
  const memUsed = memUsage.heapUsed;

  // Memory warning if using > 80% of heap
  const memoryStatus = memUsed / memTotal > 0.8 ? 'warning' : 'ok';

  return {
    status: memoryStatus === 'error' ? 'unhealthy' : memoryStatus === 'warning' ? 'degraded' : 'healthy',
    transport,
    activeConnections,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.MCP_SERVER_VERSION || '1.0.0',
    checks: {
      memory: {
        status: memoryStatus,
        used: Math.round(memUsed / 1024 / 1024),
        total: Math.round(memTotal / 1024 / 1024),
      },
      tools: {
        status: 'ok',
        registered: 0, // Would be populated by registry
      },
    },
  };
}