import { captureOutput } from '@oclif/test';
import { expect, describe, it, beforeEach, afterEach, vi, MockedObject } from 'vitest';
import { disableNetConnect } from 'nock';
import { AppsV1Api } from '@kubernetes/client-node';
import metricsAnnotations from '../../src/commands/monitoring/metrics-annotations.js';
import * as k8sFactory from '../../src/lib/k8s/client-factory.js';
import type { WorkloadMetricsInfo } from '../../src/types/workload.types.js';
import { generateMockDeployment, generateMockStatefulSet } from '../utils/generateWorkload.js';

vi.mock(import('../../src/lib/k8s/client-factory.js'));

disableNetConnect();

describe('monitoring metrics-annotations command', () => {
  let mockedKubeClient: MockedObject<AppsV1Api>;

  beforeEach(() => {
    // Create mock kubeClient
    const mockedK8sFactory = vi.mocked(k8sFactory);
    mockedKubeClient = vi.mockObject(AppsV1Api.prototype);

    mockedK8sFactory.createKubernetesClient.mockReturnValue({
      ok: true,
      value: mockedKubeClient,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should display workloads in table format by default', async () => {
      const deployment = generateMockDeployment('test-deployment', 'default', {
        spec: { template: { metadata: { annotations: { 'prometheus.io/scrape': 'true', 'prometheus.io/port': '8080' } } } },
      });

      const statefulSet = generateMockStatefulSet('test-statefulset', 'default');

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deployment],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [statefulSet],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default'])
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain('test-deployment');
      expect(stdout).toContain('test-statefulset');
      expect(stdout).toContain('Deployment');
      expect(stdout).toContain('✓'); // For enabled metrics
      expect(stdout).toContain('N/A'); // For missing metrics
    });

    it('should output workloads in JSON format when specified', async () => {
      const deployment = generateMockDeployment('test-deployment', 'default', {
        spec: {
          template: {
            metadata: {
              annotations: {
                'prometheus.io/scrape': 'true',
                'prometheus.io/port': '9090',
                'prometheus.io/path': '/custom-metrics',
              },
            },
          },
        },
      });

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deployment],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(Array.isArray(jsonOutput)).toBe(true);
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]).toMatchObject({
        name: 'test-deployment',
        namespace: 'default',
        type: 'Deployment',
        metricsAnnotations: {
          scrapeEnabled: true,
          port: '9090',
          path: '/custom-metrics',
        },
      });
    });

    it('should output workloads in CSV format when specified', async () => {
      const deployment = generateMockDeployment('test-deployment', 'default', {
        spec: {
          template: {
            metadata: {
              annotations: {
                'prometheus.io/scrape': 'false',
                'prometheus.io/port': '8080',
              },
            },
          },
        },
      });

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deployment],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=csv'])
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain('Name,Namespace,Type,Replicas,Ready Replicas');
      expect(stdout).toContain('test-deployment,default,Deployment,3,2');
      expect(stdout).toContain('false'); // scrape enabled value
    });

    it('should filter workloads without metrics annotations when flag is set', async () => {
      const deploymentWithMetrics = generateMockDeployment('with-metrics', 'default', {
        spec: {
          template: {
            metadata: {
              annotations: {
                'prometheus.io/scrape': 'true',
                'prometheus.io/port': '8080',
              },
            },
          },
        },
      });

      const deploymentWithoutMetrics = generateMockDeployment('without-metrics', 'default');

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deploymentWithMetrics, deploymentWithoutMetrics],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json', '--only-no-metrics'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]?.name).toBe('without-metrics');
    });

    it('should handle multiple namespaces', async () => {
      const deployment1 = generateMockDeployment('deploy-ns1', 'namespace1', {
        spec: { template: { metadata: { annotations: { 'prometheus.io/scrape': 'true' } } } },
      });

      const statefulSet2 = generateMockStatefulSet('sts-ns2', 'namespace2');

      mockedKubeClient.listNamespacedDeployment.mockResolvedValueOnce({ items: [deployment1] }).mockResolvedValueOnce({ items: [] });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [statefulSet2] });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=namespace1,namespace2', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(jsonOutput).toHaveLength(2);
      expect(jsonOutput.map((w) => w.name)).toContain('deploy-ns1');
      expect(jsonOutput.map((w) => w.name)).toContain('sts-ns2');
    });

    it('should handle different metrics annotation configurations', async () => {
      const deployments = [
        generateMockDeployment('scrape-enabled', 'default', {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'prometheus.io/scrape': 'true',
                  'prometheus.io/port': '8080',
                  'prometheus.io/path': '/metrics',
                },
              },
            },
          },
        }),
        generateMockDeployment('scrape-disabled', 'default', {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'prometheus.io/scrape': 'false',
                  'prometheus.io/port': '9090',
                },
              },
            },
          },
        }),
        generateMockDeployment('partial-annotations', 'default', {
          spec: {
            template: {
              metadata: {
                annotations: {
                  'prometheus.io/port': '3000',
                },
              },
            },
          },
        }),
        generateMockDeployment('no-annotations', 'default'),
      ];

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: deployments,
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(jsonOutput).toHaveLength(4);

      const scrapeEnabled = jsonOutput.find((w) => w.name === 'scrape-enabled');
      const scrapeDisabled = jsonOutput.find((w) => w.name === 'scrape-disabled');
      const partialAnnotations = jsonOutput.find((w) => w.name === 'partial-annotations');
      const noAnnotations = jsonOutput.find((w) => w.name === 'no-annotations');

      expect(scrapeEnabled?.metricsAnnotations?.scrapeEnabled).toBe(true);
      expect(scrapeEnabled?.metricsAnnotations?.port).toBe('8080');
      expect(scrapeEnabled?.metricsAnnotations?.path).toBe('/metrics');

      expect(scrapeDisabled?.metricsAnnotations?.scrapeEnabled).toBe(false);
      expect(scrapeDisabled?.metricsAnnotations?.port).toBe('9090');

      expect(partialAnnotations?.metricsAnnotations?.scrapeEnabled).toBeUndefined();
      expect(partialAnnotations?.metricsAnnotations?.port).toBe('3000');

      expect(noAnnotations?.metricsAnnotations?.scrapeEnabled).toBeUndefined();
      expect(noAnnotations?.metricsAnnotations?.port).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle Kubernetes client creation failure', async () => {
      const mockedK8sFactory = vi.mocked(k8sFactory);
      mockedK8sFactory.createKubernetesClient.mockReturnValue({
        ok: false,
        error: new Error('Invalid token'),
      });

      const { error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=invalid-token', '--server=https://api.test.com', '--namespaces=default'])
      );

      expect(error).toHaveProperty('message', 'Failed to create Kubernetes client: Invalid token');
    });

    it('should handle API call failures for deployments', async () => {
      mockedKubeClient.listNamespacedDeployment.mockRejectedValue(new Error('Namespace not found'));
      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({ items: [] });

      const { error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=nonexistent'])
      );

      expect(error?.message).toContain('Namespace not found');
    });

    it('should handle API call failures for stateful sets', async () => {
      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({ items: [] });
      mockedKubeClient.listNamespacedStatefulSet.mockRejectedValue(new Error('Permission denied'));

      const { error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default'])
      );

      expect(error?.message).toContain('Permission denied');
    });

    it('should handle empty workload lists', async () => {
      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(jsonOutput).toHaveLength(0);
    });
  });

  describe('workload type handling', () => {
    it('should properly identify deployment and stateful set types', async () => {
      const deployment = generateMockDeployment('test-deployment', 'default');
      const statefulSet = generateMockStatefulSet('test-statefulset', 'default');

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deployment],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [statefulSet],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(jsonOutput).toHaveLength(2);

      const deploymentOutput = jsonOutput.find((w) => w.name === 'test-deployment');
      const statefulSetOutput = jsonOutput.find((w) => w.name === 'test-statefulset');

      expect(deploymentOutput?.type).toBe('Deployment');
      expect(statefulSetOutput?.type).toBe('StatefulSet');
    });

    it('should handle replica counts correctly', async () => {
      const deployment = generateMockDeployment('test-deployment', 'default', {
        spec: { replicas: 5 },
        status: { readyReplicas: 3 },
      });

      mockedKubeClient.listNamespacedDeployment.mockResolvedValue({
        items: [deployment],
      });

      mockedKubeClient.listNamespacedStatefulSet.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        metricsAnnotations.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as WorkloadMetricsInfo[];
      expect(jsonOutput[0]?.replicas).toBe(5);
      expect(jsonOutput[0]?.readyReplicas).toBe(3);
    });
  });
});
