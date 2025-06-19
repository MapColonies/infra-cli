import type { RouteTlsInfo, RouteInfo } from "../../types/route.types.js";
import type { CertificateInfo } from "../../types/certificate.types.js";
import { parseCertificate } from "../crypto/certificate-parser.js";
import {
  checkHostMatchesCertificate,
  checkPrivateKeyMatchesCertificate,
} from "../crypto/certificate-matcher.js";

/**
 * Parses a raw route object from the Kubernetes API into a structured RouteInfo
 */
export const parseRoute = (route: any): RouteInfo => {
  const spec = route.spec;
  const metadata = route.metadata;

  let tlsInfo: RouteTlsInfo | undefined;

  if (spec.tls) {
    let certificateInfo: CertificateInfo | undefined;
    let hostMatchesCertificate: boolean | undefined;
    let privateKeyMatchesCertificate: boolean | undefined;

    if (spec.tls.certificate) {
      const parseResult = parseCertificate(spec.tls.certificate);

      if (parseResult.ok) {
        certificateInfo = parseResult.value;
        hostMatchesCertificate = checkHostMatchesCertificate(
          spec.host,
          certificateInfo
        );

        if (spec.tls.key) {
          const keyMatchResult = checkPrivateKeyMatchesCertificate(
            spec.tls.certificate,
            spec.tls.key
          );

          if (keyMatchResult.ok) {
            privateKeyMatchesCertificate = keyMatchResult.value;
          } else {
            console.error(
              `Failed to validate private key for route ${metadata.name}:`,
              keyMatchResult.error.message
            );
          }
        }
      } else {
        console.error(
          `Failed to parse certificate for route ${metadata.name}:`,
          parseResult.error.message
        );
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
    name: metadata.name,
    namespace: metadata.namespace,
    host: spec.host,
    path: spec.path,
    service: spec.to.name,
    port: spec.port?.targetPort,
    tls: tlsInfo,
  };
};
