import * as k8s from '@kubernetes/client-node';
import type { Result } from '../../types/certificate.types.js';

export interface KubernetesClientOptions {
  readonly token?: string;
  readonly server?: string;
}

/**
 * Creates and configures a Kubernetes client
 */
export function createKubernetesClient<T extends k8s.ApiType>(apiClass: k8s.ApiConstructor<T>, options?: KubernetesClientOptions): Result<T, Error> {
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

    const api = kc.makeApiClient(apiClass);
    return { ok: true, value: api };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
