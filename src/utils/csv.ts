export interface CsvData {
  columns: string[];
  rows: Record<string, string>[];
}

/** RFC-4180-ish parser: quoted fields, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): CsvData {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let touched = false;

  const pushField = () => {
    record.push(field);
    field = "";
    touched = false;
  };
  const pushRecord = () => {
    if (touched || record.length > 0) {
      pushField();
      records.push(record);
      record = [];
    }
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      touched = true;
    } else if (c === ",") {
      pushField();
      touched = true;
    } else if (c === "\n") {
      pushRecord();
    } else if (c !== "\r") {
      field += c;
      touched = true;
    }
  }
  pushRecord();

  if (records.length === 0) return { columns: [], rows: [] };
  const columns = records[0].map((c) => c.trim());
  const rows = records
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) =>
      Object.fromEntries(columns.map((c, i) => [c, r[i] ?? ""])),
    );
  return { columns, rows };
}

export function toCsv(rows: (string | number | boolean | null)[][]): string {
  const escape = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\r\n");
}