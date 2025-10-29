const fs = require("fs");
const { Command } = require("commander");
const path = require("path");

const program = new Command();

program
    .option("-i, --input <file>", "Input schema json", "in-shacl/template.schema.json")
    .option("-o, --output <dir>", "Output YARRRML file", "out/some-yarrrml.yml")
    .option("-s, --source <file>", "Input source data json", "out/some-data.json")

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const outputFile = options.output;
const sourceFile = options.source;

const base = "http://base.example.com/"; // Base IRI

let yarrrml = `
prefixes:
  ex: "http://example.org/"
  exr: "http://example.org/relation/"
  skos: "http://www.w3.org/2004/02/skos/core#"
  dcterms: "http://purl.org/dc/terms/"
  rdfs: "http://www.w3.org/2000/01/rdf-schema#"

base: "${base}" 

mappings:\n`;

const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputFile), "utf8"));
let mappingCounter = 1;
for (const sheet of Object.values(schema)) {

    yarrrml += `  m_${mappingCounter}:\n`;
    yarrrml += `    sources:\n`;
    yarrrml += `      - [ ${sourceFile}~jsonpath, "$.data.${sheet.sheetLabel}[*]" ]\n`;
    yarrrml += `    s: $(CODE[*])\n`; // base IRI with code if no valid iri
    yarrrml += `    po:\n`;
    yarrrml += `      - [rdf:type, ${sheet.sheetClass}~iri]\n`;

    // collect columns with class values, for additional mapping later
    const iriAsObject = [];

    for (const column of Object.values(sheet.columns) ) {
        yarrrml += `      - p: "${column.columnProperty}"\n`;
        yarrrml += `        o: \n`;
        yarrrml += `          value:  "$(${column.columnLabel}[*])"\n`;
        if (column.valueDatatype === "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString") {
            yarrrml += `          language: nl\n`; // TODO refine now we only support Dutch
        }
        else if (column.valueDatatype) {
            yarrrml += `          datatype: ${column.valueDatatype}\n`;
        }
        else if (column.valueClass) {
            yarrrml += `          type: iri\n`;
            iriAsObject.push({ "columnLabel": column.columnLabel, "valueClass": column.valueClass });
        }
        mappingCounter += 1;
    }
    yarrrml += `\n`;

    // additional mappings for columns with value class
    for (const item of iriAsObject) {
        yarrrml += `  m_${mappingCounter}:\n`;
        yarrrml += `    sources:\n`;
        yarrrml += `      - [ ${sourceFile}~jsonpath, "$.data.${sheet.sheetLabel}[*]" ]\n`;
        yarrrml += `    s: $(${item.columnLabel}[*])\n`; // base IRI with code if no valid iri
        yarrrml += `    po:\n`;
        yarrrml += `      - [rdf:type, ${item.valueClass}~iri]\n`
        yarrrml += `\n`;
        mappingCounter += 1;
    }

}



if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
fs.writeFileSync(outputFile, yarrrml, "utf8");
console.log(`✅ YARRRML mapping written to ${outputFile}`);
