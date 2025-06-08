import * as k8s from "@kubernetes/client-node";
import {
  X509Certificate,
  createPublicKey,
  createPrivateKey,
} from "node:crypto";
import { Command } from "commander";
import Table from "cli-table3";

interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  fingerprint: string;
  subjectAltNames?: string[];
}

interface RouteInfo {
  name: string;
  namespace: string;
  host: string;
  path?: string;
  service: string;
  port?: string;
  tls: {
    termination: string;
    certificateInfo?: CertificateInfo; // Optional, only if certificate is present
    hostMatchesCertificate?: boolean; // Whether the route host matches certificate
    privateKeyMatchesCertificate?: boolean; // Whether the private key matches certificate
  };
}

class OpenShiftRouteRetriever {
  private k8sApi: k8s.CustomObjectsApi;
  private kc: k8s.KubeConfig;

  constructor(token?: string, server?: string) {
    this.kc = new k8s.KubeConfig();

    if (token && server) {
      // Use provided token and server
      this.kc.loadFromOptions({
        clusters: [
          {
            name: "cluster",
            server: server,
            skipTLSVerify: true,
          },
        ],
        users: [
          {
            name: "user",
            token: token,
          },
        ],
        contexts: [
          {
            name: "context",
            cluster: "cluster",
            user: "user",
          },
        ],
        currentContext: "context",
      });
    } else {
      // Use default config
      this.kc.loadFromDefault();
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
  }

  async getRoutesFromNamespaces(namespaces: string[]): Promise<RouteInfo[]> {
    const allRoutes: RouteInfo[] = [];

    for (const namespace of namespaces) {
      try {
        const routes = await this.getRoutesFromNamespace(namespace);
        allRoutes.push(...routes);
      } catch (error) {
        console.error(
          `Failed to get routes from namespace ${namespace}:`,
          error
        );
      }
    }

    return allRoutes;
  }

  private async getRoutesFromNamespace(
    namespace: string
  ): Promise<RouteInfo[]> {
    try {
      const response = await this.k8sApi.listNamespacedCustomObject(
        // "route.openshift.io",
        // "v1",
        // namespace,
        // "routes"
        {
          group: "route.openshift.io",
          version: "v1",
          namespace: namespace,
          plural: "routes",
        }
      );

      const routes = (response as any).items;
      return routes.map((route: any) => this.parseRoute(route));
    } catch (error) {
      console.error(
        `Error fetching routes from namespace ${namespace}:`,
        error
      );
      throw error;
    }
  }

  private parseRoute(route: any): RouteInfo {
    const spec = route.spec;
    const metadata = route.metadata;

    const routeInfo: RouteInfo = {
      name: metadata.name,
      namespace: metadata.namespace,
      host: spec.host,
      path: spec.path,
      service: spec.to.name,
      port: spec.port?.targetPort,
      tls: {
        termination: spec.tls.termination,
      },
    };

    // Parse certificate if present
    if (spec.tls?.certificate) {
      try {
        const certInfo = this.parseCertificate(spec.tls.certificate);
        routeInfo.tls.certificateInfo = certInfo;
        routeInfo.tls.hostMatchesCertificate = this.checkHostMatchesCertificate(
          routeInfo.host,
          certInfo
        );

        // Check if private key matches certificate
        if (spec.tls?.key) {
          routeInfo.tls.privateKeyMatchesCertificate =
            this.checkPrivateKeyMatchesCertificate(
              spec.tls.certificate,
              spec.tls.key
            );
        }
      } catch (error) {
        console.error(
          `Failed to parse certificate for route ${routeInfo.name}:`,
          error
        );
      }
    }

    return routeInfo;
  }

  private parseCertificate(certificatePem: string): CertificateInfo {
    const cert = new X509Certificate(certificatePem);

    return {
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
  }

  private checkHostMatchesCertificate(
    host: string,
    certInfo: CertificateInfo
  ): boolean {
    // Check if host matches the common name in subject
    const cnMatch = certInfo.subject.includes(`CN=${host}`);

    // Check if host matches any of the subject alternative names
    const sanMatch =
      certInfo.subjectAltNames?.some((san) => {
        // Remove the type prefix (e.g., "DNS:")
        const cleanSan = san.replace(/^[A-Z]+:/, "");
        // Support wildcard certificates
        if (cleanSan.startsWith("*.")) {
          const domain = cleanSan.substring(2);
          return (
            host.endsWith(domain) &&
            host.split(".").length === domain.split(".").length + 1
          );
        }
        return cleanSan === host;
      }) || false;

    return cnMatch || sanMatch;
  }

  private checkPrivateKeyMatchesCertificate(
    certificatePem: string,
    privateKeyPem: string
  ): boolean {
    try {
      const cert = new X509Certificate(certificatePem);
      const privateKey = createPrivateKey(privateKeyPem);

      // Extract public key from certificate and private key
      const certPublicKeyPem = cert.publicKey.export({
        format: "pem",
        type: "spki",
      });
      const privateKeyPublicKeyPem = createPublicKey(privateKey).export({
        format: "pem",
        type: "spki",
      });

      return certPublicKeyPem === privateKeyPublicKeyPem;
    } catch (error) {
      console.error("Error comparing certificate and private key:", error);
      return false;
    }
  }
}

// CLI setup
const program = new Command();

program
  .name("openshift-route-cert-checker")
  .description("Check OpenShift routes and their TLS certificates")
  .version("1.0.0")
  .requiredOption("-t, --token <token>", "Kubernetes API token")
  .requiredOption(
    "-n, --namespaces <namespaces>",
    "Comma-separated list of namespaces"
  )
  .requiredOption("-s, --server <server>", "Kubernetes API server URL")
  .option("-o, --output <format>", "Output format (json|table)", "json")
  .option("--filter-no-cert", "Filter out routes without certificates")
  .action(async (options) => {
    try {
      const namespaces = options.namespaces
        .split(",")
        .map((ns: string) => ns.trim());
      const retriever = new OpenShiftRouteRetriever(
        options.token,
        options.server
      );

      console.log(`Checking routes in namespaces: ${namespaces.join(", ")}`);
      let routes = await retriever.getRoutesFromNamespaces(namespaces);

      // Filter out routes without certificates if requested
      if (options.filterNoCert) {
        routes = routes.filter(
          (route) => route.tls.certificateInfo !== undefined
        );
      }

      if (options.output === "table") {
        const table = new Table({
          head: ["Name", "Namespace", "Host", "TLS", "Host Match", "Key Match"],
          colWidths: [30, 15, 30, 10, 12, 12],
          wordWrap: true,
          wrapOnWordBoundary: false,
        });

        routes.forEach((route) => {
          const hostMatch = route.tls.hostMatchesCertificate;
          const keyMatch = route.tls.privateKeyMatchesCertificate;

          const hostMatchDisplay =
            hostMatch === true ? "✓" : hostMatch === false ? "✗" : "N/A";
          const keyMatchDisplay =
            keyMatch === true ? "✓" : keyMatch === false ? "✗" : "N/A";

          table.push([
            route.name,
            route.namespace,
            route.host,
            route.tls.termination,
            hostMatchDisplay,
            keyMatchDisplay,
          ]);
        });

        console.log(table.toString());
      } else {
        console.log(JSON.stringify(routes, null, 2));
      }
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse();
