import { runCommand } from '@oclif/test';
import { expect, describe, it, beforeEach, afterEach, vi, beforeAll, MockedObject } from 'vitest';
import { disableNetConnect } from 'nock';
import type { ObjectCustomObjectsApi } from '@kubernetes/client-node/dist/gen/types/ObjectParamAPI.js';
import type { KubeConfig } from '@kubernetes/client-node';
import * as k8sFactory from '../../src/lib/k8s/client-factory.js';
import type { CertResult } from '../utils/generateCerts.js';
import { generateCerts } from '../utils/generateCerts.js';
import { generateRoute } from '../utils/generateRoute.js';

disableNetConnect();

describe('route validate-certs command', () => {
  const certs: CertResult[] = [];
  let kubeClient: MockedObject<ObjectCustomObjectsApi>;
  let createKubernetesClientSpy: ReturnType<typeof vi.spyOn>;

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
    kubeClient = {
      listNamespacedCustomObject: vi.fn(),
    } as MockedObject<ObjectCustomObjectsApi>;

    // Spy on the actual function and mock its return value
    createKubernetesClientSpy = vi.spyOn(k8sFactory, 'createKubernetesClient').mockReturnValue({
      ok: true,
      value: {
        kc: {} as KubeConfig,
        api: kubeClient,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful execution', () => {
    it.only('should display routes in table format by default', async () => {
      const route = generateRoute({
        spec: {
          tls: {
            termination: 'edge',
            certificate: certs[0]?.cert,
            key: certs[0]?.private,
          },
        },
      });

      kubeClient.listNamespacedCustomObject.mockResolvedValue({
        body: {
          items: [route],
        },
      });

      const { stdout, error } = await runCommand([
        'route validate-certs',
        '--token=test-token',
        '--server=https://api.test.com',
        '--namespaces=default',
      ]);

      expect(error).toBeUndefined();
      expect(stdout).toContain('test-route-1');
      expect(stdout).toContain('test-route-2');
      expect(stdout).toContain('app1.example.com');
      expect(stdout).toContain('app2.example.com');
      expect(stdout).toContain('edge');
      expect(stdout).toContain('passthrough');
    });
  });
});
