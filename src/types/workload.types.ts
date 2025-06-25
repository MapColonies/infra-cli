export interface MetricsAnnotations {
  scrapeEnabled?: boolean;
  port?: string;
  path?: string;
}

export interface WorkloadMetricsInfo {
  name: string;
  namespace: string;
  type: 'Deployment' | 'StatefulSet';
  replicas?: number;
  readyReplicas?: number;
  createdAt?: string;
  metricsAnnotations?: MetricsAnnotations;
}
