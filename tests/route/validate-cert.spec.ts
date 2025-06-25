import { captureOutput } from '@oclif/test';
import { expect, describe, it, beforeEach, afterEach, vi, beforeAll, MockedObject } from 'vitest';
import { disableNetConnect } from 'nock';
import { CustomObjectsApi } from '@kubernetes/client-node';
import validateRouteCerts from '../../src/commands/route/validate-certs.js';
import * as k8sFactory from '../../src/lib/k8s/client-factory.js';
import type { CertResult } from '../utils/generateCerts.js';
import { generateCerts } from '../utils/generateCerts.js';
import { generateRoute } from '../utils/generateRoute.js';
import { RouteInfo } from '../../src/types/route.types.js';

vi.mock(import('../../src/lib/k8s/client-factory.js'));

disableNetConnect();

describe('route validate-certs command', () => {
  const certs: CertResult[] = [];
  let mockedKubeClient: MockedObject<CustomObjectsApi>;

  beforeAll(() => {
    // Generate certificates
    for (let i = 0; i < 3; i++) {
      certs.push(
        generateCerts({
          keySize: 2048,
          days: 365,
          algorithm: 'sha256',
          attributes: {
            commonName: `app${i + 1}.example.com`,
            countryName: 'US',
            stateOrProvinceName: 'CA',
            localityName: 'San Francisco',
            organizationName: 'Test',
            organizationalUnitName: 'Test',
          },
          altNames: [`app${i + 1}.example.com`],
        })
      );
    }
  });

  beforeEach(() => {
    // Create mock kubeClient
    const mockedK8sFactory = vi.mocked(k8sFactory);
    mockedKubeClient = vi.mockObject(CustomObjectsApi.prototype);

    mockedK8sFactory.createKubernetesClient.mockReturnValue({
      ok: true,
      value: mockedKubeClient,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it('should display routes in table format by default', async () => {
      const route1 = generateRoute({
        metadata: {
          name: 'test-route-1',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      const route2 = generateRoute({
        metadata: {
          name: 'test-route-2',
          namespace: 'default',
        },
        spec: {
          host: 'app2.example.com',
          tls: {
            termination: 'passthrough',
            certificate: certs[1]?.cert,
            key: certs[1]?.private,
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [route1, route2],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default'])
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain('test-route-1');
      expect(stdout).toContain('test-route-2');
      expect(stdout).toContain('app1.example.com');
      expect(stdout).toContain('app2.example.com');
      expect(stdout).toContain('✓');
    });

    it('should output routes in JSON format when specified', async () => {
      const route1 = generateRoute({
        metadata: {
          name: 'test-route-1',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [route1],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(Array.isArray(jsonOutput)).toBe(true);
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]).toMatchObject({
        name: 'test-route-1',
        namespace: 'default',
        host: 'app1.example.com',
      });
    });

    it('should output routes in CSV format when specified', async () => {
      const route1 = generateRoute({
        metadata: {
          name: 'test-route-1',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [route1],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=csv'])
      );

      expect(error).toBeUndefined();
      expect(stdout).toContain('Name,Namespace,Host');
      expect(stdout).toContain('test-route-1,default,app1.example.com');
    });

    it('should filter out routes without certificates when flag is set', async () => {
      const routeWithCert = generateRoute({
        metadata: {
          name: 'route-with-cert',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      const routeWithoutCert = generateRoute({
        metadata: {
          name: 'route-without-cert',
          namespace: 'default',
        },
        spec: {
          host: 'app2.example.com',
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [routeWithCert, routeWithoutCert],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json', '--filter-no-cert'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]?.name).toBe('route-with-cert');
    });

    it('should handle multiple namespaces', async () => {
      const route1 = generateRoute({
        metadata: {
          name: 'route-ns1',
          namespace: 'namespace1',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      const route2 = generateRoute({
        metadata: {
          name: 'route-ns2',
          namespace: 'namespace2',
        },
        spec: {
          host: 'app2.example.com',
          tls: {
            termination: 'passthrough',
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValueOnce({ items: [route1] }).mockResolvedValueOnce({ items: [route2] });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=namespace1,namespace2', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(jsonOutput).toHaveLength(2);
      expect(jsonOutput.map((r) => r.name)).toContain('route-ns1');
      expect(jsonOutput.map((r) => r.name)).toContain('route-ns2');
    });

    it('should handle routes with different TLS termination types', async () => {
      const edgeRoute = generateRoute({
        metadata: {
          name: 'edge-route',
          namespace: 'default',
        },
        spec: {
          host: 'edge.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      const passthroughRoute = generateRoute({
        metadata: {
          name: 'passthrough-route',
          namespace: 'default',
        },
        spec: {
          host: 'passthrough.example.com',
          tls: {
            termination: 'passthrough',
          },
        },
      });

      const reencryptRoute = generateRoute({
        metadata: {
          name: 'reencrypt-route',
          namespace: 'default',
        },
        spec: {
          host: 'reencrypt.example.com',
          tls: {
            termination: 'reencrypt',
            certificate: certs[1]?.cert,
            key: certs[1]?.private,
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [edgeRoute, passthroughRoute, reencryptRoute],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(jsonOutput).toHaveLength(3);

      const edgeRouteOutput = jsonOutput.find((r) => r.name === 'edge-route');
      const passthroughRouteOutput = jsonOutput.find((r) => r.name === 'passthrough-route');
      const reencryptRouteOutput = jsonOutput.find((r) => r.name === 'reencrypt-route');

      expect(edgeRouteOutput?.tls?.termination).toBe('edge');
      expect(passthroughRouteOutput?.tls?.termination).toBe('passthrough');
      expect(reencryptRouteOutput?.tls?.termination).toBe('reencrypt');
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
        validateRouteCerts.run(['--token=invalid-token', '--server=https://api.test.com', '--namespaces=default'])
      );

      expect(error).toHaveProperty('message', 'Failed to create Kubernetes client: Invalid token');
    });

    it('should handle API call failures', async () => {
      mockedKubeClient.listNamespacedCustomObject.mockRejectedValue(new Error('Namespace not found'));

      const { error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=nonexistent'])
      );

      expect(error).toHaveProperty('message', 'Error: Failed to get routes from namespace nonexistent: Namespace not found');
    });

    it('should handle empty route list', async () => {
      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(jsonOutput).toHaveLength(0);
    });
  });

  describe('certificate validation', () => {
    it('should show certificate validation status for routes with valid certificates', async () => {
      const routeWithValidCert = generateRoute({
        metadata: {
          name: 'valid-cert-route',
          namespace: 'default',
        },
        spec: {
          host: 'app1.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [routeWithValidCert],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]?.tls).toBeDefined();
      expect(jsonOutput[0]?.tls?.hostMatchesCertificate).toBe(true);
      expect(jsonOutput[0]?.tls?.privateKeyMatchesCertificate).toBe(true);
    });

    it('should handle routes with certificate/key mismatches', async () => {
      const routeWithMismatch = generateRoute({
        metadata: {
          name: 'mismatch-route',
          namespace: 'default',
        },
        spec: {
          host: 'wrong-host.example.com',
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert, // Certificate for app1.example.com
            key: certs[1]?.private, // Key for different certificate
          },
        },
      });

      mockedKubeClient.listNamespacedCustomObject.mockResolvedValue({
        items: [routeWithMismatch],
      });

      const { stdout, error } = await captureOutput(async () =>
        validateRouteCerts.run(['--token=test-token', '--server=https://api.test.com', '--namespaces=default', '--output=json'])
      );

      expect(error).toBeUndefined();
      const jsonOutput = JSON.parse(stdout) as RouteInfo[];
      expect(jsonOutput).toHaveLength(1);
      expect(jsonOutput[0]?.tls?.hostMatchesCertificate).toBe(false);
      expect(jsonOutput[0]?.tls?.privateKeyMatchesCertificate).toBe(false);
    });
  });
});
