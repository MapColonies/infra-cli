import type { AppsV1Api, V1Deployment, V1StatefulSet } from '@kubernetes/client-node';
import type { WorkloadMetricsInfo, MetricsAnnotations } from '../../types/workload.types.js';
import type { Result } from '../../types/shared.types.js';

export class KubernetesWorkloadRetriever {
  public constructor(private readonly kubeClient: AppsV1Api) {}

  public async getWorkloadMetricsInfoFromNamespaces(namespaces: string[]): Promise<Result<WorkloadMetricsInfo[], Error>> {
    try {
      const allWorkloads: WorkloadMetricsInfo[] = [];

      for (const namespace of namespaces) {
        const deployments = await this.getDeployments(namespace);
        const statefulSets = await this.getStatefulSets(namespace);

        const deploymentWorkloads = deployments.map((deployment) => ({
          name: deployment.metadata?.name ?? '',
          namespace: deployment.metadata?.namespace ?? '',
          type: 'Deployment' as const,
          replicas: deployment.spec?.replicas,
          readyReplicas: deployment.status?.readyReplicas,
          createdAt: deployment.metadata?.creationTimestamp?.toISOString(),
          metricsAnnotations: this.extractMetricsAnnotations(deployment.spec?.template.metadata?.annotations),
        }));

        const statefulSetWorkloads = statefulSets.map((statefulSet) => ({
          name: statefulSet.metadata?.name ?? '',
          namespace: statefulSet.metadata?.namespace ?? '',
          type: 'StatefulSet' as const,
          replicas: statefulSet.spec?.replicas,
          readyReplicas: statefulSet.status?.readyReplicas,
          createdAt: statefulSet.metadata?.creationTimestamp?.toISOString(),
          metricsAnnotations: this.extractMetricsAnnotations(statefulSet.spec?.template.metadata?.annotations),
        }));

        allWorkloads.push(...deploymentWorkloads, ...statefulSetWorkloads);
      }

      return { ok: true, value: allWorkloads };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  public async getDeployments(namespace: string): Promise<V1Deployment[]> {
    const response = await this.kubeClient.listNamespacedDeployment({ namespace });
    return response.items;
  }

  public async getStatefulSets(namespace: string): Promise<V1StatefulSet[]> {
    const response = await this.kubeClient.listNamespacedStatefulSet({ namespace });
    return response.items;
  }

  private extractMetricsAnnotations(annotations?: { [key: string]: string }): MetricsAnnotations {
    if (!annotations) {
      return { scrapeEnabled: undefined };
    }

    const prometheusAnnotations = {
      scrape: annotations['prometheus.io/scrape'],
      port: annotations['prometheus.io/port'],
      path: annotations['prometheus.io/path'],
    };

    return {
      scrapeEnabled: prometheusAnnotations.scrape !== undefined ? prometheusAnnotations.scrape === 'true' : undefined,
      port: prometheusAnnotations.port,
      path: prometheusAnnotations.path,
    };
  }
}
