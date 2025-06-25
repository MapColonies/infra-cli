import { X509Certificate, createPublicKey, createPrivateKey } from 'node:crypto';
import type { CertificateInfo, Result } from '../../types/certificate.types.js';

/**
 * Checks if the route host matches the certificate's subject or SAN
 */
export const checkHostMatchesCertificate = (host: string, certInfo: CertificateInfo): boolean => {
  const cnMatch = certInfo.subject.includes(`CN=${host}`);

  const sanMatch =
    certInfo.subjectAltNames?.some((san) => {
      const cleanSan = san.replace(/^[A-Z]+:/, '');
      if (cleanSan.startsWith('*.')) {
        const WILDCARD_PREFIX_LENGTH = 2; // Length of '*.'
        const domain = cleanSan.substring(WILDCARD_PREFIX_LENGTH);
        return host.endsWith(domain) && host.split('.').length === domain.split('.').length + 1;
      }
      return cleanSan === host;
    }) ?? false;

  return cnMatch || sanMatch;
};

/**
 * Checks if the private key matches the certificate's public key
 */
export const checkPrivateKeyMatchesCertificate = (certificatePem: string, privateKeyPem: string): Result<boolean, Error> => {
  try {
    const cert = new X509Certificate(certificatePem);
    const privateKey = createPrivateKey(privateKeyPem);

    const certPublicKeyPem = cert.publicKey.export({
      format: 'pem',
      type: 'spki',
    });
    const privateKeyPublicKeyPem = createPublicKey(privateKey).export({
      format: 'pem',
      type: 'spki',
    });

    return { ok: true, value: certPublicKeyPem === privateKeyPublicKeyPem };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};
