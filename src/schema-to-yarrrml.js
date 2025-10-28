const fs = require("fs");
const { Command } = require("commander");
const path = require("path");

const program = new Command();

program
    .option("-i, --input <file>", "Input json", "some-input-dir/file.json")
    .option("-o, --output <dir>", "Output YARRRML file", "some-output-dir/all.yarrrml.yaml")

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const outputFile = options.output;

const base = "http://example.com/"; // Base IRI

let yarrrml = `
prefixes:
  ex: "http://example.org/"
  exr: "http://example.org/relation/"
  skos: "http://www.w3.org/2004/02/skos/core#"
  dcterms: "http://purl.org/dc/terms/"
  rdfs: "http://www.w3.org/2000/01/rdf-schema#"

base: "${base}"

mappings:\n`;

const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputFile), "utf8"));
let mappingCounter = 1;
for (const domain of data.schema) {

    yarrrml += `  m_${mappingCounter}:\n`;
    yarrrml += `    sources:\n`;
    yarrrml += `      - [ ${inputFile}~jsonpath, "$.data.${domain.domainLabel}[*]" ]\n`;
    yarrrml += `    s: $(code[*])\n`; // base IRI with code if no valid iri
    yarrrml += `    po:\n`;
    yarrrml += `      - [rdf:type, ${domain.domainIri}~iri]\n`;

    // collect properties with iri as range, to additional mapping later
    const iriAsRange = [];

    for (const property of domain.properties) {
        yarrrml += `      - p: '${property.propertyIri}'\n`;
        yarrrml += `        o: \n`;
        yarrrml += `          value:  "$(${property.propertyLabel}[*])"\n`;
        if (property.rangeDatatype === "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString") {
            yarrrml += `          language: nl\n`; // TODO refine now we only support Dutch
        }
        else if (property.rangeDatatype) {
            yarrrml += `          datatype: ${property.rangeDatatype}\n`;
        }
        else if (property.rangeIri) {
            yarrrml += `          type: iri\n`;
            iriAsRange.push({ 'propertyLabel': property.propertyLabel, 'rangeIri': property.rangeIri });
        }
        mappingCounter += 1;
    }
    yarrrml += `\n`;

    // additional mappings for properties with iri as range
    for (const item of iriAsRange) {
        yarrrml += `  m_${mappingCounter}:\n`;
        yarrrml += `    sources:\n`;
        yarrrml += `      - [ ${inputFile}~jsonpath, "$.data.${domain.domainLabel}[*]" ]\n`;
        yarrrml += `    s: $(${item.propertyLabel}[*])\n`; // base IRI with code if no valid iri
        yarrrml += `    po:\n`;
        yarrrml += `      - [rdf:type, ${item.rangeIri}~iri]\n`
        yarrrml += `\n`;
        mappingCounter += 1;
    }

}



if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
fs.writeFileSync(outputFile, yarrrml, "utf8");
console.log(`✅ YARRRML mapping written to ${outputFile}`);
