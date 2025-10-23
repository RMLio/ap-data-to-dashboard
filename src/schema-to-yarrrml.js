const fs = require("fs");
const { Command } = require("commander");
const path = require("path");
const glob = require("glob");
const yaml = require("js-yaml");
const deepMergeStrict = require("./util/deep-merge-strict");

const program = new Command();

program
    .option("-g, --glob <pattern>", "Glob pattern for input JSON Schema files", "some-input-dir/*.schema.json")
    .option("-o, --output <file>", "Output YARRRML file", "some-output-dir/all.yarrrml.yaml");

program.parse(process.argv);

const options = program.opts();
const globPattern = options.glob;
const outputFile = options.output;

const base = "http://example.com/"; // Base IRI

// Helper to get YARRRML value mapping for a property
function getYarrrmlValue(key, prop) {
    if (prop.type === "array") {
        // Array: map each element
        return `$(${key}[*])`;
    } else {
        // Scalar
        return `$(${key})`;
    }
}

function getRelation(key) {
    return predicateMap[key] || `http://example.org/relation/${encodeURIComponent(key.toLowerCase())}`;
}

const predicateMap = {
    'label': 'http://www.w3.org/2000/01/rdf-schema#label',
    'beschrijving': 'http://purl.org/dc/terms/description',
};

let plainObject = {
    prefixes: {
        ex: "http://example.org/",
        exr: "http://example.org/relation/",
        skos: "http://www.w3.org/2004/02/skos/core#",
        dcterms: "http://purl.org/dc/terms/",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#"
    },
    mappings: {}
};

glob.sync(globPattern).forEach(schemaFile => {
    const className = path.basename(schemaFile, ".schema.json").split('-').pop();
    const oldMapping = plainObject.mappings[className] || {};
    const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
    const properties = schema.items.properties;
    const id = properties["code"] ? "$(code)" : properties["#"] ? "$(#)" : null;

    let newMapping = {
        sources: [
            [`${path.basename(schemaFile, ".schema.json")}.json~jsonpath`, "$.[*]"]
        ],
        s: `http://example.org/${className}/${id || "$(id)"}`,
        po: [
            ["rdf:type", `http://example.org/${className}~iri`]
        ]
    };

    if (id) {
        newMapping.po.push(["http://www.w3.org/2004/02/skos/core#notation", id]);
    }

    Object.entries(properties).forEach(([key, prop]) => {
        // Skip comment fields
        if (key === "_comment") return;
        // Skip # fields
        if (key === "#") return;
        // Skip code field (already mapped as notation)
        if (key === "code") return;
        if (key.endsWith("_label")) return;
        if (key === "#Parent") {
            newMapping.po.push([ "skos:broader", `http://example.org/${className}/${getYarrrmlValue(key, prop)}~iri` ]);
            return;
        };
        if (key[0].toUpperCase() === key[0]) {
            // Assume it's a reference to another class
            if(properties[`${key}_relatie`]) {
                // TODO lookup
                // TODO fix function for predicate in YARRRML, support should include: 
                /*
      - p: 
          - function: idlab-fn:lookup(idlab-fn:str = $(Doel[*]), idlab-fn:inputFile = "./codelijsten-relaties.csv", idlab-fn:fromColumn = "0", idlab-fn:toColumn = "1")
        o: "http://example.org/Doel/$(Doel[*])~iri"
                */
            }
            newMapping.po.push([ getRelation(key), `http://example.org/${key}/${getYarrrmlValue(key, prop)}~iri` ]);
            return;
        }
        if (predicateMap[key]) {
            newMapping.po.push([ predicateMap[key], `${getYarrrmlValue(key, prop)}` ]);
            return;
        }

        newMapping.po.push([ `http://example.org/relation/${key}`, `${getYarrrmlValue(key, prop)}` ]);
    });
    plainObject.mappings[className] = deepMergeStrict(oldMapping, newMapping);
});

if(!fs.existsSync(path.dirname(outputFile))){
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
const yarrrml = yaml.dump(plainObject, {
    flowLevel: 4, // YARRRML parser expects block style in source and po arrays!
    noRefs: true,
    quotingType: '"',
    forceQuotes: true
});
fs.writeFileSync(outputFile, yarrrml, "utf8");
console.log(`✅ YARRRML mapping written to ${outputFile}`);