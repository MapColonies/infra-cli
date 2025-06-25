import type { PartialDeep } from 'type-fest';
import deepMerge from 'deepmerge';
import { V1Deployment, V1StatefulSet } from '@kubernetes/client-node';

type DeploymentOverrides = PartialDeep<V1Deployment>;
type StatefulSetOverrides = PartialDeep<V1StatefulSet>;

/**
 * Generates a mock Kubernetes deployment for testing
 */
export function generateMockDeployment(name: string, namespace: string, overrides: DeploymentOverrides = {}): V1Deployment {
  const baseDeployment: V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace,
      creationTimestamp: new Date('2023-01-01T00:00:00Z'),
    },
    spec: {
      replicas: 3,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
          },
        },
        spec: {
          containers: [
            {
              name: 'app',
              image: 'nginx:latest',
              ports: [
                {
                  containerPort: 80,
                },
              ],
            },
          ],
        },
      },
    },
    status: {
      replicas: 3,
      readyReplicas: 2,
      availableReplicas: 2,
      updatedReplicas: 3,
    },
  };

  return deepMerge(baseDeployment, overrides) as V1Deployment;
}

/**
 * Generates a mock Kubernetes stateful set for testing
 */
export function generateMockStatefulSet(name: string, namespace: string, overrides: StatefulSetOverrides = {}): V1StatefulSet {
  const baseStatefulSet: V1StatefulSet = {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
      name,
      namespace,
      creationTimestamp: new Date('2023-01-01T00:00:00Z'),
    },
    spec: {
      replicas: 2,
      serviceName: `${name}-headless`,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
          },
        },
        spec: {
          containers: [
            {
              name: 'app',
              image: 'nginx:latest',
              ports: [
                {
                  containerPort: 80,
                },
              ],
            },
          ],
        },
      },
    },
    status: {
      replicas: 2,
      readyReplicas: 2,
      currentReplicas: 2,
      updatedReplicas: 2,
    },
  };

  return deepMerge(baseStatefulSet, overrides) as V1StatefulSet;
}

/**
 * Generate multiple mock deployments for testing
 */
export function generateMockDeployments(count: number, namespace: string = 'default', overrides: DeploymentOverrides = {}): V1Deployment[] {
  return Array.from({ length: count }, (_, index) => generateMockDeployment(`deployment-${index + 1}`, namespace, overrides));
}

/**
 * Generate multiple mock stateful sets for testing
 */
export function generateMockStatefulSets(count: number, namespace: string = 'default', overrides: StatefulSetOverrides = {}): V1StatefulSet[] {
  return Array.from({ length: count }, (_, index) => generateMockStatefulSet(`statefulset-${index + 1}`, namespace, overrides));
}
