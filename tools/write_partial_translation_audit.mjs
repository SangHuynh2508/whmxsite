import fs from "node:fs/promises";
import path from "node:path";

const [payloadPath, outputPath] = process.argv.slice(2);
if (!payloadPath || !outputPath) throw new Error("usage: writer <payload.json> <output.xlsx>");
const artifactPath = process.env.CODEX_ARTIFACT_TOOL_PATH
  || "file:///C:/Users/Legion/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";
const { SpreadsheetFile, Workbook } = await import(artifactPath);
const report = JSON.parse(await fs.readFile(payloadPath, "utf8"));

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

const workbook = Workbook.create();
for (const [name, records] of Object.entries(report)) {
  const sheet = workbook.worksheets.add(name);
  const headers = records.length ? Object.keys(records[0]) : (
    name === "SUMMARY" ? ["character_id", "translated_direct_content_count", "missing_direct_content_count", "mixed_cn_vi_count", "base_skill_missing", "ex_skill_missing", "huanzhang_missing", "zhizhi_missing", "buff_dependency_missing", "coverage_percent", "priority", "notes"] :
    name === "MISSING_FIELDS" ? ["character_id", "section", "sheet", "record_id", "relation_from", "source_field", "vi_field", "source_cn", "current_vi", "generated_value", "public_value", "missing_reason", "suggested_action"] :
    name === "SOURCE_TRACE" ? ["character_id", "ui_section", "source_sheet", "source_record_id", "localized_field", "generated_path", "public_path", "frontend_renderer", "fallback_order", "popup_reference_source"] :
    ["character_id", "reason"]
  );
  const values = [headers, ...records.map(record => headers.map(header => record[header] ?? ""))];
  sheet.getRangeByIndexes(0, 0, values.length, headers.length).values = values;
  const used = sheet.getRange(`A1:${columnName(headers.length - 1)}${values.length}`);
  const header = sheet.getRange(`A1:${columnName(headers.length - 1)}1`);
  header.format.fill = "#1F4E78";
  header.format.font = { bold: true, color: "#FFFFFF" };
  header.format.wrapText = true;
  used.format.wrapText = true;
  used.format.verticalAlignment = "top";
  used.format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
  used.format.autofitColumns();
  for (let column = 0; column < headers.length; column += 1) {
    const range = sheet.getRangeByIndexes(0, column, values.length, 1);
    if (["source_cn", "current_vi", "generated_value", "public_value", "notes", "suggested_action", "fallback_order"].includes(headers[column])) {
      range.format.columnWidth = 36;
    } else if (range.format.columnWidth > 24) {
      range.format.columnWidth = 24;
    }
  }
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  sheet.tabColor = "#1F4E78";
}
workbook.recalculate();
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?", options: { useRegex: true }, maxChars: 1000 });
if (errors?.ndjson && !errors.ndjson.includes("matched 0 entries")) throw new Error(`formula error(s): ${errors.ndjson}`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
const preview = await workbook.render({ sheetName: "SUMMARY", autoCrop: "all", scale: 1, format: "png" });
const previewPath = process.env.CODEX_AUDIT_PREVIEW || path.join(process.env.TEMP || ".", "partial_character_translations_summary.png");
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({ sheets: Object.keys(report), summaryRows: report.SUMMARY.length }));
