import { stringify } from 'csv-stringify/sync';

export interface CsvColumn<TData> {
  readonly header: string;
  readonly getValue: (item: TData) => string | undefined | Date | readonly string[];
}

/**
 * Creates CSV output from data using the provided column definitions
 */
export const createCsv = <TData>(data: readonly TData[], columns: readonly CsvColumn<TData>[]): string => {
  // Transform data into rows, keeping raw values for csv-stringify to handle
  const rows = data.map((item) =>
    columns.map((col) => {
      const value = col.getValue(item);
      if (value === undefined) return '';
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.join('; ');
      // Return the raw value - let csv-stringify handle escaping
      return value;
    })
  );

  // Create CSV with headers - csv-stringify handles all escaping including newlines
  return stringify(rows, {
    header: true,
    columns: columns.map((col) => col.header),
  });
};
