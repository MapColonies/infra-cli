import type { CustomObjectsApi } from '@kubernetes/client-node';
import type { RouteInfo } from '../../types/route.types.js';
import type { Result } from '../../types/certificate.types.js';
import type { components } from '../../types/openshift-route.types.js';
import { parseRoute } from './route-parser.js';

export class OpenShiftRouteRetriever {
  private readonly k8sApi: CustomObjectsApi;

  public constructor(k8sApi: CustomObjectsApi) {
    this.k8sApi = k8sApi;
  }

  /**
   * Retrieves routes from multiple namespaces
   */
  public async getRoutesFromNamespaces(namespaces: readonly string[]): Promise<Result<RouteInfo[], Error>> {
    const allRoutes: RouteInfo[] = [];
    const errors: string[] = [];

    for (const namespace of namespaces) {
      const result = await this.getRoutesFromNamespace(namespace);
      if (result.ok) {
        allRoutes.push(...result.value);
      } else {
        errors.push(`Failed to get routes from namespace ${namespace}: ${result.error.message}`);
      }
    }

    if (errors.length > 0 && allRoutes.length === 0) {
      return { ok: false, error: new Error(errors.join('; ')) };
    }

    return { ok: true, value: allRoutes };
  }

  private async getRoutesFromNamespace(namespace: string): Promise<Result<RouteInfo[], Error>> {
    try {
      const response = (await this.k8sApi.listNamespacedCustomObject({
        group: 'route.openshift.io',
        version: 'v1',
        namespace: namespace,
        plural: 'routes',
      })) as components['schemas']['com.github.openshift.api.route.v1.RouteList'];

      const routes = response.items;
      const parsedRoutes = routes.map((route) => parseRoute(route));

      return { ok: true, value: parsedRoutes };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
