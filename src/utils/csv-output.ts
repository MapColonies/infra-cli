export interface CsvColumn<TData> {
  readonly header: string;
  readonly getValue: (
    item: TData
  ) => string | undefined | Date | readonly string[];
}

/**
 * Escapes a CSV value by handling quotes, commas, and newlines
 */
const escapeCsvValue = (
  value: string | undefined | Date | readonly string[]
): string => {
  if (value === undefined || value === null) return "";
  let stringValue: string;
  if (value instanceof Date) {
    stringValue = value.toISOString();
  } else if (Array.isArray(value)) {
    stringValue = value.join("; ");
  } else {
    stringValue = String(value);
  }
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    stringValue = stringValue.replace(/\r?\n/g, "\\n");
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Creates CSV output from data using the provided column definitions
 */
export const createCsv = <TData>(
  data: readonly TData[],
  columns: readonly CsvColumn<TData>[]
): string => {
  const lines: string[] = [];

  // Add header row
  const headers = columns.map((col) => col.header).join(",");
  lines.push(headers);

  // Add data rows
  data.forEach((item) => {
    const row = columns.map((col) => escapeCsvValue(col.getValue(item)));
    lines.push(row.join(","));
  });

  return lines.join("\n");
};
