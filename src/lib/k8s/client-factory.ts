import type { CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import type { Result } from '../../types/certificate.types.js';

export interface KubernetesClientOptions {
  readonly token?: string;
  readonly server?: string;
}

/**
 * Creates and configures a Kubernetes client
 */
export function createKubernetesClient(options?: KubernetesClientOptions): Result<{ kc: KubeConfig; api: CustomObjectsApi }, Error> {
  try {
    const kc = new k8s.KubeConfig();

    if (options?.token !== undefined && options.server !== undefined) {
      kc.loadFromOptions({
        clusters: [
          {
            name: 'cluster',
            server: options.server,
            skipTLSVerify: true,
          },
        ],
        users: [
          {
            name: 'user',
            token: options.token,
          },
        ],
        contexts: [
          {
            name: 'context',
            cluster: 'cluster',
            user: 'user',
          },
        ],
        currentContext: 'context',
      });
    } else {
      kc.loadFromDefault();
    }
    console.log('xd');
    const api = kc.makeApiClient(k8s.CustomObjectsApi);
    return { ok: true, value: { kc, api } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
