import type { CertificateInfo } from './certificate.types.js';

export interface RouteInfo {
  readonly name: string;
  readonly namespace: string;
  readonly host: string;
  readonly path?: string;
  readonly service: string;
  readonly port?: string;
  readonly tls?: RouteTlsInfo;
}

export interface RouteTlsInfo {
  readonly termination: string;
  readonly certificateInfo?: CertificateInfo;
  readonly hostMatchesCertificate?: boolean;
  readonly privateKeyMatchesCertificate?: boolean;
}
