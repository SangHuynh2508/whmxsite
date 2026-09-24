#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const REQUIRED_HEADERS = [
  "sheet",
  "record_id",
  "character_id",
  "field",
  "source_cn",
  "current_vi",
  "source_placeholders",
  "vi_placeholders",
  "source_color_tokens",
  "vi_color_tokens",
  "source_tagged_spans",
  "vi_tagged_spans",
  "validator_error",
  "error_type",
  "translation_review_status",
  "repair_proposed_vi",
  "repair_notes",
  "skill_id",
  "skill_name_cn",
  "skill_name_vi",
  "buff_id",
  "buff_name_cn",
  "buff_name_vi",
  "brilliant_id",
  "icon_name_cn",
];

function columnName(index) {
  let n = index + 1;
  let out = "";
  while (n) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function usage() {
  console.error("Usage: node tools/write_richtext_repair_workbook.mjs input.json output.xlsx");
  process.exitCode = 2;
}

async function main() {
  const [, , input, output] = process.argv;
  if (!input || !output) return usage();
  const payload = JSON.parse(await fs.readFile(input, "utf8"));
  const rows = payload.rows || [];
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("RichText Repair");
  const headers = [...REQUIRED_HEADERS, ...[...new Set(rows.flatMap((row) => Object.keys(row)))].filter((header) => !REQUIRED_HEADERS.includes(header))];
  const end = columnName(headers.length - 1);
  sheet.getRange(`A1:${end}1`).values = [headers];
  for (let start = 0; start < rows.length; start += 20) {
    const chunk = rows.slice(start, start + 20).map((row) => headers.map((header) => row[header] ?? ""));
    sheet.getRange(`A${start + 2}:${end}${start + 1 + chunk.length}`).values = chunk;
  }
  sheet.getRange(`A1:${end}1`).format = {
    fill: "#1F4E78",
    font: { name: "Arial", bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  const usedRows = Math.max(1, rows.length + 1);
  sheet.getRange(`A1:${end}${usedRows}`).format.font = { name: "Arial", size: 10 };
  sheet.getRange(`A1:${end}${usedRows}`).format.wrapText = true;
  sheet.freezePanes.freezeRows(1);
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const width = /(source_cn|current_vi|tagged_spans|validator_error|repair)/.test(header) ? 45 : Math.min(28, Math.max(12, header.length + 2));
    sheet.getRange(`${columnName(index)}:${columnName(index)}`).format.columnWidth = width;
  }
  workbook.recalculate();
  const preview = await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 3000, tableMaxRows: 3, tableMaxCols: 8 });
  if (!preview.ndjson.includes("RichText Repair")) throw new Error("Workbook verification failed: RichText Repair sheet missing.");
  await fs.mkdir(path.dirname(output), { recursive: true });
  const blob = await SpreadsheetFile.exportXlsx(workbook);
  await blob.save(output);

  const verify = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const verifySheet = verify.worksheets.getItem("RichText Repair");
  const values = verifySheet.getUsedRange().values;
  if (values.length !== rows.length + 1) throw new Error(`Saved workbook row count mismatch: ${values.length - 1} != ${rows.length}`);
  console.log(JSON.stringify({ output, rows: rows.length }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
