import cliTable from 'cli-table3';

export interface TableColumn<TData> {
  readonly header: string;
  readonly width?: number;
  readonly getValue: (item: TData) => string;
}

export interface TableOptions {
  readonly wordWrap?: boolean;
  readonly wrapOnWordBoundary?: boolean;
}

/**
 * Creates a formatted table from data using the provided column definitions
 */
export const createTable = <TData>(data: readonly TData[], columns: readonly TableColumn<TData>[], options: TableOptions = {}): string => {
  const table = new cliTable({
    head: columns.map((col) => col.header),
    colWidths: columns.map((col) => col.width).filter((width): width is number => width !== undefined),
    wordWrap: options.wordWrap ?? true,
    wrapOnWordBoundary: options.wrapOnWordBoundary ?? false,
  });

  data.forEach((item) => {
    const row = columns.map((col) => col.getValue(item));
    table.push(row);
  });

  return table.toString();
};
