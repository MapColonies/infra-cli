import {
  X509Certificate,
  createPublicKey,
  createPrivateKey,
} from "node:crypto";
import type { CertificateInfo, Result } from "../../types/certificate.types.js";

/**
 * Parses an X.509 certificate from PEM format
 */
export const parseCertificate = (
  certificatePem: string
): Result<CertificateInfo, Error> => {
  try {
    const cert = new X509Certificate(certificatePem);

    const certificateInfo: CertificateInfo = {
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: new Date(cert.validFrom),
      validTo: new Date(cert.validTo),
      serialNumber: cert.serialNumber,
      fingerprint: cert.fingerprint,
      subjectAltNames: cert.subjectAltName
        ? cert.subjectAltName.split(", ")
        : undefined,
    };

    return { ok: true, value: certificateInfo };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};
