import { faker } from '@faker-js/faker';
import type { PartialDeep } from 'type-fest';
import deepMerge from 'deepmerge';
import type { components } from '../../src/types/openshift-route.types.js';

type RouteOverrides = PartialDeep<components['schemas']['com.github.openshift.api.route.v1.Route']>;

/**
 * Generates a fake OpenShift route for testing with optional field overrides
 */
export function generateRoute(overrides: RouteOverrides = {}): components['schemas']['com.github.openshift.api.route.v1.Route'] {
  const name = faker.internet.domainWord();
  const namespace = faker.internet.domainWord();

  const baseRoute: components['schemas']['com.github.openshift.api.route.v1.Route'] = {
    apiVersion: 'route.openshift.io/v1',
    kind: 'Route',
    metadata: {
      name,
      namespace,
      uid: faker.string.uuid(),
      resourceVersion: faker.number.int({ min: 1000, max: 999999 }).toString(),
      generation: faker.number.int({ min: 1, max: 100 }),
      creationTimestamp: faker.date.past().toISOString(),
      labels: {
        app: faker.internet.domainWord(),
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/instance': faker.internet.domainWord(),
      },
      annotations: {
        'openshift.io/host.generated': 'true',
      },
    },
    spec: {
      host: `${name}-${namespace}.${faker.internet.domainName()}`,
      to: {
        kind: 'Service',
        name: `${name}-service`,
        weight: 100,
      },
      port: {
        targetPort: faker.helpers.arrayElement(['http', 'https', '8080', '3000', '80']),
      },
      wildcardPolicy: 'None',
    },
    status: {
      ingress: [
        {
          host: `${name}-${namespace}.${faker.internet.domainName()}`,
          routerName: `router-${faker.internet.domainWord()}`,
          conditions: [
            {
              type: 'Admitted',
              status: 'True',
              lastTransitionTime: faker.date.recent().toISOString(),
            },
          ],
          wildcardPolicy: 'None',
          routerCanonicalHostname: `router-${faker.internet.domainWord()}.${faker.internet.domainName()}`,
        },
      ],
    },
  };

  // Deep merge the overrides with the base route
  return deepMerge(baseRoute, overrides) as components['schemas']['com.github.openshift.api.route.v1.Route'];
}

/**
 * Generate multiple routes for testing
 */
export function generateRoutes(
  count: number,
  overrides: RouteOverrides = {}
): readonly components['schemas']['com.github.openshift.api.route.v1.Route'][] {
  return Array.from({ length: count }, () => generateRoute(overrides));
}
