import { generate } from 'selfsigned';

interface CertificateOptions {
  keySize?: number;
  days?: number;
  algorithm?: string;
  altNames?: string[];
  attributes: {
    commonName: string;
    countryName?: string;
    stateOrProvinceName?: string;
    localityName?: string;
    organizationName?: string;
    organizationalUnitName?: string;
  };
}

export interface CertResult {
  private: string;
  public: string;
  cert: string;
}

export function generateCerts(options: CertificateOptions): CertResult {
  const attrs = [
    { name: 'commonName', value: options.attributes.commonName },
    { name: 'countryName', value: options.attributes.countryName },
    { shortName: 'ST', value: options.attributes.stateOrProvinceName },
    { name: 'localityName', value: options.attributes.localityName },
    { name: 'organizationName', value: options.attributes.organizationName },
    { name: 'organizationalUnitName', value: options.attributes.organizationalUnitName },
  ];
  // attrs.filter((attr) => attr.value !== undefined);

  return generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: options.altNames?.map((name) => ({ type: 2, value: name })) ?? [],
      },
    ],
  });
}
