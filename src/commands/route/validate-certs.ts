import { Command, Flags } from '@oclif/core';
import type { RouteInfo } from '../../types/route.types.js';
import { OpenShiftRouteRetriever } from '../../lib/openshift/route-retriever.js';
import { createKubernetesClient } from '../../lib/k8s/client-factory.js';
import { createTable } from '../../utils/table-output.js';
import type { TableColumn } from '../../utils/table-output.js';
import { createCsv } from '../../utils/csv-output.js';
import type { CsvColumn } from '../../utils/csv-output.js';

const routeTableColumns: TableColumn<RouteInfo>[] = [
  {
    header: 'Name',
    width: 30,
    getValue: (route) => route.name,
  },
  {
    header: 'Namespace',
    width: 15,
    getValue: (route) => route.namespace,
  },
  {
    header: 'Host',
    width: 30,
    getValue: (route) => route.host,
  },
  {
    header: 'TLS',
    width: 10,
    getValue: (route) => route.tls?.termination ?? 'None',
  },
  {
    header: 'Host Match',
    width: 12,
    getValue: (route): string => {
      const hostMatch = route.tls?.hostMatchesCertificate;
      return hostMatch === true ? '✓' : hostMatch === false ? '✗' : 'N/A';
    },
  },
  {
    header: 'Key Match',
    width: 12,
    getValue: (route): string => {
      const keyMatch = route.tls?.privateKeyMatchesCertificate;
      return keyMatch === true ? '✓' : keyMatch === false ? '✗' : 'N/A';
    },
  },
];

const routeCsvColumns: CsvColumn<RouteInfo>[] = [
  {
    header: 'Name',
    getValue: (route) => route.name,
  },
  {
    header: 'Namespace',
    getValue: (route) => route.namespace,
  },
  {
    header: 'Host',
    getValue: (route) => route.host,
  },
  {
    header: 'Path',
    getValue: (route) => route.path,
  },
  {
    header: 'Service',
    getValue: (route) => route.service,
  },
  {
    header: 'Port',
    getValue: (route) => route.port,
  },
  {
    header: 'TLS Termination',
    getValue: (route) => route.tls?.termination,
  },
  {
    header: 'Certificate Subject',
    getValue: (route) => route.tls?.certificateInfo?.subject,
  },
  {
    header: 'Certificate Issuer',
    getValue: (route) => route.tls?.certificateInfo?.issuer,
  },
  {
    header: 'Certificate Valid From',
    getValue: (route) => route.tls?.certificateInfo?.validFrom,
  },
  {
    header: 'Certificate Valid To',
    getValue: (route) => route.tls?.certificateInfo?.validTo,
  },
  {
    header: 'Certificate Serial Number',
    getValue: (route) => route.tls?.certificateInfo?.serialNumber,
  },
  {
    header: 'Certificate Fingerprint',
    getValue: (route) => route.tls?.certificateInfo?.fingerprint,
  },
  {
    header: 'Certificate Subject Alt Names',
    getValue: (route) => route.tls?.certificateInfo?.subjectAltNames,
  },
  {
    header: 'Host Matches Certificate',
    getValue: (route) => route.tls?.hostMatchesCertificate?.toString(),
  },
  {
    header: 'Private Key Matches Certificate',
    getValue: (route) => route.tls?.privateKeyMatchesCertificate?.toString(),
  },
];

export default class ValidateRouteCerts extends Command {
  public static override description = 'Check OpenShift routes and their TLS certificates';

  public static override examples = ['<%= config.bin %> <%= command.id %> --token=abc123 --server=https://api.cluster.com --namespaces=ns1,ns2'];

  public static override flags = {
    token: Flags.string({
      char: 't',
      description: 'Kubernetes API token',
      required: true,
    }),
    server: Flags.string({
      char: 's',
      description: 'Kubernetes API server URL',
      required: true,
    }),
    namespaces: Flags.string({
      char: 'n',
      description: 'Comma-separated list of namespaces',
      required: true,
      delimiter: ',',
      multiple: true,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format',
      options: ['json', 'table', 'csv'],
      default: 'table',
    }),
    'filter-no-cert': Flags.boolean({
      description: 'Filter out routes without certificates',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ValidateRouteCerts);

    const clientResult = createKubernetesClient({
      token: flags.token,
      server: flags.server,
    });

    if (!clientResult.ok) {
      this.error(`Failed to create Kubernetes client: ${clientResult.error.message}`);
    }

    const retriever = new OpenShiftRouteRetriever(clientResult.value);

    this.logToStderr(`Checking routes in namespaces: ${flags.namespaces.join(', ')}`);

    const routesResult = await retriever.getRoutesFromNamespaces(flags.namespaces);

    if (!routesResult.ok) {
      this.error(`Error: ${routesResult.error.message}`);
    }

    let routes = routesResult.value;

    if (flags['filter-no-cert']) {
      routes = routes.filter((route) => route.tls?.certificateInfo !== undefined);
    }

    if (flags.output === 'table') {
      const tableOutput = createTable(routes, routeTableColumns, {
        wordWrap: true,
        wrapOnWordBoundary: false,
      });
      this.log(tableOutput);
    } else if (flags.output === 'csv') {
      const csvOutput = createCsv(routes, routeCsvColumns);
      this.log(csvOutput);
    } else {
      this.log(JSON.stringify(routes, null, 0));
    }
  }
}
