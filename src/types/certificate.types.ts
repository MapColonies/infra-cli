import type { Result } from "./shared.types.js";

export interface CertificateInfo {
  readonly subject: string;
  readonly issuer: string;
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly serialNumber: string;
  readonly fingerprint: string;
  readonly subjectAltNames?: readonly string[];
}

// Re-export Result for backward compatibility
export type { Result };
