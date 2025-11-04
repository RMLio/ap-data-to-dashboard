const fs = require("fs");
const { Command } = require("commander");
const path = require("path");

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

function convertLabeltoVariable(label, isIri){
  if (isIri){
    label = label + "_url";
  };
  // "id" is reserved for internal use in Miravi
  if (label === "id"){
    label = "ID";
  }
  return "?" + label ;
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
  const sVar = `${convertLabeltoVariable(sheetLabel, true)}`;
  vars.push(sVar);
  triples.push(`${sVar} a <${sheet.sheetClass}> .`);
  
  for (const column of Object.values(sheet.columns)){
    const oVar = convertLabeltoVariable(column.columnLabel, column.valueClass);
    if (column.valueMinCount >= 1){
      triples.push(`${sVar} <${column.columnProperty}> ${oVar} . `); 
    } else {
      triples.push(`OPTIONAL { ${sVar} <${column.columnProperty}> ${oVar} . }`);
    }
    vars.push(oVar);
  }

  const queryTitle = sheetLabel;
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
  let valueLabel = iriToLabelMap[column.valueClass];
  if (!valueLabel) {
    console.log(`⚠️  No label found for IRI ${column.valueClass}, skipping cross-mapping query.`);
    return "";
  }
  //avoid duplicate variables
  if (sheetLabel === valueLabel) {
    valueLabel += "2";
  }
  const sheetVar = convertLabeltoVariable(sheetLabel, true);
  const valueVar = convertLabeltoVariable(valueLabel, true);;
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
const classToLabelMap = {};
for (const sheet of Object.values(schema)) {
  classToLabelMap[sheet.sheetClass] = sheet.sheetLabel;
}
for (const sheet of Object.values(schema)) {
  for (const column of Object.values(sheet.columns)) {
    if (column.valueClass) {
      output += sheetToCrossMappingQuery(sheet, column, classToLabelMap) + "\n";
    }
  }
}

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✅ SPARQL queries written to ${outputFile}`);



