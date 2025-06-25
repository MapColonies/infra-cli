import { Command, Flags } from '@oclif/core';
import { AppsV1Api } from '@kubernetes/client-node';
import type { WorkloadMetricsInfo } from '../../types/workload.types.js';
import { KubernetesWorkloadRetriever } from '../../lib/k8s/workload-retriever.js';
import { createKubernetesClient } from '../../lib/k8s/client-factory.js';
import { createTable } from '../../utils/table-output.js';
import type { TableColumn } from '../../utils/table-output.js';
import { createCsv } from '../../utils/csv-output.js';
import type { CsvColumn } from '../../utils/csv-output.js';

const workloadTableColumns: TableColumn<WorkloadMetricsInfo>[] = [
  {
    header: 'Name',
    width: 30,
    getValue: (workload) => workload.name,
  },
  {
    header: 'Namespace',
    width: 15,
    getValue: (workload) => workload.namespace,
  },
  {
    header: 'Type',
    width: 12,
    getValue: (workload) => workload.type,
  },
  {
    header: 'Metrics Enabled',
    width: 15,
    getValue: (workload): string => {
      const annotations = workload.metricsAnnotations;
      if (annotations?.scrapeEnabled === undefined) {
        return 'N/A';
      }
      return annotations.scrapeEnabled ? '✓' : '✗';
    },
  },
  {
    header: 'Metrics Port',
    width: 12,
    getValue: (workload) => workload.metricsAnnotations?.port ?? 'N/A',
  },
  {
    header: 'Metrics Path',
    width: 15,
    getValue: (workload) => workload.metricsAnnotations?.path ?? 'N/A',
  },
];

const workloadCsvColumns: CsvColumn<WorkloadMetricsInfo>[] = [
  {
    header: 'Name',
    getValue: (workload) => workload.name,
  },
  {
    header: 'Namespace',
    getValue: (workload) => workload.namespace,
  },
  {
    header: 'Type',
    getValue: (workload) => workload.type,
  },
  {
    header: 'Replicas',
    getValue: (workload) => workload.replicas?.toString(),
  },
  {
    header: 'Ready Replicas',
    getValue: (workload) => workload.readyReplicas?.toString(),
  },
  {
    header: 'Metrics Enabled',
    getValue: (workload) => workload.metricsAnnotations?.scrapeEnabled?.toString(),
  },
  {
    header: 'Metrics Port',
    getValue: (workload) => workload.metricsAnnotations?.port,
  },
  {
    header: 'Metrics Path',
    getValue: (workload) => workload.metricsAnnotations?.path,
  },
  {
    header: 'Created At',
    getValue: (workload) => workload.createdAt,
  },
];

export default class MetricsAnnotations extends Command {
  public static override description = 'Check Kubernetes deployments and stateful sets for Prometheus metrics annotations';

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
    'label-selector': Flags.string({
      char: 'l',
      description: 'Label selector to filter workloads',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format',
      options: ['json', 'table', 'csv'],
      default: 'table',
    }),
    'only-no-metrics': Flags.boolean({
      description: 'Only show workloads without metrics annotations',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(MetricsAnnotations);

    const clientResult = createKubernetesClient(AppsV1Api, {
      token: flags.token,
      server: flags.server,
    });

    if (!clientResult.ok) {
      this.error(`Failed to create Kubernetes client: ${clientResult.error.message}`);
    }

    const retriever = new KubernetesWorkloadRetriever(clientResult.value);

    this.logToStderr(`Checking workloads in namespaces: ${flags.namespaces.join(', ')}`);

    const workloadsResult = await retriever.getWorkloadMetricsInfoFromNamespaces(flags.namespaces, flags['label-selector']);

    if (!workloadsResult.ok) {
      this.error(`Error: ${workloadsResult.error.message}`);
    }

    if (flags['only-no-metrics']) {
      workloadsResult.value = workloadsResult.value.filter((workload) => workload.metricsAnnotations?.scrapeEnabled === undefined);
    }

    const workloads = workloadsResult.value;

    if (flags.output === 'table') {
      const tableOutput = createTable(workloads, workloadTableColumns, {
        wordWrap: true,
        wrapOnWordBoundary: false,
      });
      this.log(tableOutput);
    } else if (flags.output === 'csv') {
      const csvOutput = createCsv(workloads, workloadCsvColumns);
      this.log(csvOutput);
    } else {
      this.log(JSON.stringify(workloads, null, 0));
    }
  }
}
