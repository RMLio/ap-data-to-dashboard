const fs = require("fs");
const { Command } = require("commander");
const path = require("path");
const { compileFunction } = require("vm");

const program = new Command();
program
  .option("-i, --input <file>", "Input template schema json file", "in/template.schema.json")
  .option("-o, --outfile <file>", "Output file for combined queries", "some-output-dir/generated-queries.rq")
  .option("-s, --splitdir <dir>", "Output directory for split queries", "some-output-dir/generated-queries");

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const outputFile = options.outfile;
const splitDir = options.splitdir;

if (!fs.existsSync(path.dirname(outputFile))) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
if (!fs.existsSync(splitDir)) {
  fs.mkdirSync(splitDir, { recursive: true });
}


function capitalize(str) {
  if (!str || typeof str !== "string") return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toIriName(str) {
  if (!str) return str;
  return str + "_url";
}

function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9 ]/g, "") // verwijder speciale tekens
    .split(" ")
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join("");
}

function converLabeltoVarName(label, isIri) {
  let varName = toCamelCase(label);
  if (isIri) {
    varName = toIriName(capitalize(varName));
  }
  // "id" is reserved for internal use in Miravi
  if (varName === "id"){
    varName = "ID";
  }
  return "?" + varName;
}

function toValidFilename(str, maxLength = 255) {
  // Replace invalid characters with underscores
  let filename = str
    // replace non-ASCII characters with underscore
    .replace(/[^\x00-\x7F]/g, "_")
    // replace control characters and invalid filename chars with underscore
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    // replace multiple spaces or underscores with a single underscore
    .replace(/[\s_]+/g, "_")
    // remove leading/trailing dots or underscores
    .replace(/^[_\.]+|[_\.]+$/g, "");

  // Limit length (most file systems limit filenames to 255 bytes)
  if (filename.length > maxLength) {
    filename = filename.substring(0, maxLength);
  }

  // Fallback if result is empty
  if (!filename) {
    filename = "untitled";
  }

  return filename;
}


function sheetToSelect(sheetLabel, sheet) {
  let triples = [];
  let vars = [];
  const sVar = `?${toIriName(sheetLabel)}`;
  vars.push(sVar);
  triples.push(`${sVar} a <${sheet.sheetClass}> .`);
  
  // Solution for same column property with multiple column labels in on sheet
  // TODO This feels like a design mistake. It would be good to flag this in some evaluation report  
  const propertyLabelMap = {}
  for (const column of Object.values(sheet.columns)){
    if (!propertyLabelMap[column.columnProperty]){
      propertyLabelMap[column.columnProperty] = []
    } 
    propertyLabelMap[column.columnProperty].push(column.columnLabel) 
  }
  for (const [columnProperty, columnLabels] of Object.entries(propertyLabelMap)){
    const firstColumn = sheet['columns'][columnLabels[0]]
    let columnValueMinCount = firstColumn.valueMinCount
    let v = columnLabels[0];
    if (columnLabels.length > 1){
      console.log(`⚠️ ${columnProperty} has multiple labels for ${sheet.sheetClass}`);
      for (const columnLabel of columnLabels) {
        if (sheet['columns'][columnLabel]['valueMinCount'] > columnValueMinCount){
          columnValueMinCount = sheet['columns'][columnLabel]['valueMinCount']
        }
      }
    } 
    for (let i = 1; i < columnLabels.length; i++){
      v += "Of" +  columnLabels[i];
    }
    v = converLabeltoVarName(v, firstColumn.valueClass);
    if (columnValueMinCount >= 1){
      triples.push(`${sVar} <${firstColumn.columnProperty}> ${v} . `); // To reduce the number of OPTIONALS per query
    } else {
      triples.push(`OPTIONAL { ${sVar} <${firstColumn.columnProperty}> ${v} . }`);
    }
    vars.push(v);
  }
  const queryTitle = `${sheetLabel}`;
  const query = `# ${queryTitle} 
SELECT DISTINCT ${vars.join(" ")} WHERE {
  ${triples.join("\n  ")}
}
`;
  const filename = path.join(splitDir, toValidFilename(queryTitle) + ".rq");
  fs.writeFileSync(filename, query, "utf8");
  console.log(`✅ Query for mapping ${sheetLabel} written to ${filename}`);
  return query;
}

function sheetToCrossMappingQuery(sheet, column, iriToLabelMap) {
  let triples = [];
  const sheetLabel = sheet.sheetLabel;
  const valueLabel = iriToLabelMap[column.valueClass];
  if (!valueLabel) {
    console.log(`⚠️  No label found for IRI ${column.valueClass}, skipping cross-mapping query.`);
    return "";
  }
  const sheetVar = converLabeltoVarName(sheetLabel, true);
  let valueVar = converLabeltoVarName(valueLabel, true);
  //avoid duplicate variables
  if (sheetVar === valueVar) {
    valueVar += "2";
  }
  triples.push(`${sheetVar} a <${sheet.sheetClass}> .`);
  triples.push(`${valueVar} a <${column.valueClass}> .`);


  const queryTitle = `Join ${sheetLabel} → ${column.columnLabel} → ${valueLabel}`;
  const query = `# ${queryTitle}
SELECT DISTINCT ${sheetVar} ${valueVar} WHERE {
  ${sheetVar} a <${sheet.sheetClass}> .
  ${valueVar} a <${column.valueClass}> .
  ${sheetVar} <${column.columnProperty}> ${valueVar} .
}
`;
  const filename = path.join(splitDir, toValidFilename(queryTitle) + ".rq");
  fs.writeFileSync(filename, query, "utf8");
  console.log(`✅ Query for cross-mapping ${sheetLabel} to ${valueLabel} written to ${filename}`);
  return query
}

// Main
const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputFile), "utf8"));
if (Object.values(schema).length === 0) {
  console.error("❌ No schema data found in the schema file.");
  process.exit(1);
}
let output = `# SPARQL queries generated from ${path.basename(inputFile)}\n\n`;
for (const sheet of Object.values(schema)) {
  //skip if sheet has no columns
  if (sheet.columns.length === 0) {
    console.log(`⚠️  ${sheet.sheetLabel} has no columns, skipping query generation.`);
  }
  //skip if sheet class is skos:Concept
  else if (sheet.sheetClass === "http://www.w3.org/2004/02/skos/core#Concept") {
    console.log(`⚠️  ${sheet.sheetLabel} is skos:Concept, skipping query generation.`);
  }
  else {
    output += sheetToSelect(sheet.sheetLabel, sheet) + "\n";
  }
}
output += "# Example cross-mapping queries\n\n";
iriToLabelMap = {};
for (const sheet of Object.values(schema)) {
  iriToLabelMap[sheet.sheetClass] = sheet.sheetLabel;
}

for (const sheet of Object.values(schema)) {
  for (const column of Object.values(sheet.columns)) {
    if (column.valueClass) {
      output += sheetToCrossMappingQuery(sheet, column, iriToLabelMap) + "\n";
    }
  }
}

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✅ SPARQL queries written to ${outputFile}`);



