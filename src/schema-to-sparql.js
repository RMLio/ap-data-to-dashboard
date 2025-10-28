const fs = require("fs");
const { Command } = require("commander");
const path = require("path");

const program = new Command();
program
  .option("-i, --input <file>", "Input mapping data json file", "some-dir/file.json")
  .option("-o, --outfile <file>", "Output file for combined queries", "some-output-dir/generated-queries.rq")
  .option("-s, --splitdir <dir>", "Output directory for split queries", "some-output-dir/generated-queries");

program.parse(process.argv);

const options = program.opts();
const mappingDataFile = options.input;
const outputFile = options.outfile;
const splitDir = options.splitdir;

if(!fs.existsSync(path.dirname(outputFile))){
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
    .replace(/[^a-zA-Z0-9 ]/g, '') // verwijder speciale tekens
    .split(' ')
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

function converLabeltoVarName(label, isIri) {
  let varName = toCamelCase(label);
  if (isIri) {
    varName = toIriName(varName);
  } 
  return '?' + varName;
} 

function toValidFilename(str, maxLength = 255) {
  // Replace invalid characters with underscores
  let filename = str
    // replace non-ASCII characters with underscore
    .replace(/[^\x00-\x7F]/g, "_")
    // replace control characters and invalid filename chars with underscore
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    // replace multiple spaces or underscores with a single underscore
    .replace(/[\s_]+/g, '_')
    // remove leading/trailing dots or underscores
    .replace(/^[_\.]+|[_\.]+$/g, '');

  // Limit length (most file systems limit filenames to 255 bytes)
  if (filename.length > maxLength) {
    filename = filename.substring(0, maxLength);
  }

  // Fallback if result is empty
  if (!filename) {
    filename = 'untitled';
  }

  return filename;
}


function domainToSelect(domainName, domain, prefixes) {
  let triples = [];
  let vars = [];
  const sVar = `?${toIriName(domainName)}`;
  vars.push(sVar);
  triples.push(`${sVar} a <${domain.sheetIri}> .`);
  domain.properties.forEach(property => {
    const v = converLabeltoVarName(property.columnLabel, property.valueIri);
    triples.push(`OPTIONAL { ${sVar} <${property.columnIri}> ${v} . }`);
    vars.push(v);
    });
  const queryTitle = `${domainName}`;
  const query = `# ${queryTitle} 
SELECT DISTINCT ${vars.join(" ")} WHERE {
  ${triples.join("\n  ")}
}
`;
  const filename = path.join(splitDir, toValidFilename(queryTitle) + ".rq");
  fs.writeFileSync(filename, query, "utf8");
  console.log(`✅ Query for mapping ${domainName} written to ${filename}`);
  return query;
}

function domainToCrossMappingQuery(domain, property, iriToLabelMap) {
  let triples = [];
  const domainName = domain.sheetName;
  const rangeName = iriToLabelMap[property.valueIri]; 
  if (!rangeName) {
    console.log(`⚠️  No label found for IRI ${property.valueIri}, skipping cross-mapping query.`);
    return '';
  } 
  const domainVar = converLabeltoVarName(domainName, true);
  let rangeVar = converLabeltoVarName(rangeName, true);
  //avoid duplicate variables
  if (domainVar === rangeVar) { 
    rangeVar += "2";
  }
  triples.push(`${domainVar} a <${domain.sheetIri}> .`);
  triples.push(`${rangeVar} a <${property.valueIri}> .`);

  
  const queryTitle = `Join ${domainName} → ${property.columnLabel} → ${rangeName}`; 
  const query = `# ${queryTitle}
SELECT DISTINCT ${domainVar} ${rangeVar} WHERE {
  ${domainVar} a <${domain.sheetIri}> .
  ${rangeVar} a <${property.valueIri}> .
  ${domainVar} <${property.columnIri}> ${rangeVar} .
}
`;
  const filename = path.join(splitDir, toValidFilename(queryTitle) + ".rq");
  fs.writeFileSync(filename, query, "utf8");
  console.log(`✅ Query for cross-mapping ${domainName} to ${rangeName} written to ${filename}`);
  return query
}

// Main
const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), mappingDataFile), "utf8"));
const schema = data.schema;
if (schema.length === 0) {
  console.error("❌ No mapping data found in the mapping data file.");
  process.exit(1);
}
let output = `# SPARQL queries generated from ${path.basename(mappingDataFile)}\n\n`;
for (const domain of schema) {
  //skip if domain has no properties
  if (domain.properties.length === 0) {
    console.log(`⚠️  ${domain.sheetName} has no properties, skipping query generation.`);
  } 
  //skip if domain is skos:Concept
  else if (domain.sheetIri === "http://www.w3.org/2004/02/skos/core#Concept") {
    console.log(`⚠️  ${domain.sheetName} is skos:Concept, skipping query generation.`);
  } 
  else {
    output += domainToSelect(domain.sheetName, domain) + "\n";
  }
}
output += "# Example cross-mapping queries\n\n";
iriToLabelMap = {};
for (const domain of schema) {
  iriToLabelMap[domain.sheetIri] = domain.sheetName;
}

for (const domain of schema) {
  domain.properties.forEach(property => {
    if (property.valueIri) {
      output += domainToCrossMappingQuery(domain, property, iriToLabelMap) + "\n";
    } 
  });
}

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✅ SPARQL queries written to ${outputFile}`);



