import type { RouteTlsInfo, RouteInfo } from '../../types/route.types.js';
import type { CertificateInfo } from '../../types/certificate.types.js';
import type { components } from '../../types/openshift-route.types.js';
import { parseCertificate } from '../crypto/certificate-parser.js';
import { checkHostMatchesCertificate, checkPrivateKeyMatchesCertificate } from '../crypto/certificate-matcher.js';

/**
 * Parses a raw route object from the Kubernetes API into a structured RouteInfo
 */
export function parseRoute(route: components['schemas']['com.github.openshift.api.route.v1.Route']): RouteInfo {
  const spec = route.spec;
  const metadata = route.metadata;
  const name = metadata?.name ?? 'unknown';

  let tlsInfo: RouteTlsInfo | undefined;

  if (spec.tls) {
    let certificateInfo: CertificateInfo | undefined;
    let hostMatchesCertificate: boolean | undefined;
    let privateKeyMatchesCertificate: boolean | undefined;

    if (spec.tls.certificate !== undefined) {
      const parseResult = parseCertificate(spec.tls.certificate);

      if (parseResult.ok) {
        certificateInfo = parseResult.value;
        hostMatchesCertificate = checkHostMatchesCertificate(spec.host ?? 'unknown', certificateInfo);

        if (spec.tls.key !== undefined) {
          const keyMatchResult = checkPrivateKeyMatchesCertificate(spec.tls.certificate, spec.tls.key);

          if (keyMatchResult.ok) {
            privateKeyMatchesCertificate = keyMatchResult.value;
          } else {
            console.error(`Failed to validate private key for route ${name}:`, keyMatchResult.error.message);
          }
        }
      } else {
        console.error(`Failed to parse certificate for route ${name}:`, parseResult.error.message);
      }
    }

    tlsInfo = {
      termination: spec.tls.termination,
      certificateInfo,
      hostMatchesCertificate,
      privateKeyMatchesCertificate,
    };
  }

  return {
    name: name,
    namespace: metadata?.namespace ?? 'unknown',
    host: spec.host ?? 'unknown',
    path: spec.path,
    service: spec.to.name,
    port: spec.port?.targetPort,
    tls: tlsInfo,
  };
}
