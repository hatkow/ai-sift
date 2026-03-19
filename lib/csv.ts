import * as XLSX from "xlsx";

export function exportJsonToCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "data");
  XLSX.writeFile(workbook, filename.endsWith(".csv") ? filename : `${filename}.csv`, {
    bookType: "csv"
  });
}

export function exportJsonToExcel<T extends Record<string, unknown>>(rows: T[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "data");
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function parseCsvText(text: string) {
  const workbook = XLSX.read(text, { type: "string" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(firstSheet, {
    defval: ""
  });
}

export async function parseSpreadsheet(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv")) {
    const buffer = new Uint8Array(arrayBuffer);
    const encodings = ["utf-8", "shift-jis"] as const;

    for (const encoding of encodings) {
      try {
        const text = new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "");
        const rows = parseCsvText(text);
        const headerKeys = rows[0] ? Object.keys(rows[0]).join("") : "";
        if (rows.length > 0 && !headerKeys.includes("�")) return rows;
      } catch {
        // Try the next encoding.
      }
    }

    const fallbackText = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
    return parseCsvText(fallbackText);
  }

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(firstSheet, {
    defval: ""
  });
}
