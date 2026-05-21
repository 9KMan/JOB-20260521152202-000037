import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { ServerConfig } from '../types.js';

let sdk: NodeSDK | null = null;

export function setupObservability(config: ServerConfig): void {
  const serviceName = config.name;
  const serviceVersion = config.version;

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  // Only setup if OTLP endpoint is configured
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (otlpEndpoint) {
    const traceExporter = new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` });
    const metricExporter = new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` });

    sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();
    console.error(`OpenTelemetry initialized with endpoint: ${otlpEndpoint}`);
  } else {
    console.error('OpenTelemetry: No OTLP endpoint configured, skipping tracing setup');
  }

  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    if (sdk) {
      await sdk.shutdown();
    }
  });
}

// Span creation helper
export function createSpan(name: string, fn: () => Promise<unknown>): Promise<unknown> {
  const { trace } = await import('@opentelemetry/api');
  const tracer = trace.getTracer('mcp-server');

  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 0 }); // OK
      return result;
    } catch (e) {
      span.setStatus({ code: 2, message: String(e) }); // ERROR
      throw e;
    } finally {
      span.end();
    }
  });
}