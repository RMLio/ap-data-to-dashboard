const fs = require("fs");
const yaml = require("js-yaml");
const { Command } = require("commander");
const path = require("path");

const program = new Command();

program
  .option("-i, --input <file>", "Input YARRRML file", "some-input-dir/all.yarrrml.yaml")
  .option("-o, --outfile <file>", "Output file for combined queries", "some-output-dir/generated-queries.rq")
  .option("-s, --splitdir <dir>", "Output directory for split queries", "some-output-dir/generated-queries");

program.parse(process.argv);

const options = program.opts();
const yarrrmlFile = options.input;
const outputFile = options.outfile;
const splitDir = options.splitdir;

if(!fs.existsSync(path.dirname(outputFile))){
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
if (!fs.existsSync(splitDir)) {
  fs.mkdirSync(splitDir, { recursive: true });
}

const yarrrml = yaml.load(fs.readFileSync(yarrrmlFile, "utf8"));

function getLocalName(uri) {
  if (!uri) return "";
  const match = uri.match(/[#\/]([^#\/]+)$/);
  return match ? match[1] : uri;
}

function toNiceLocalName(str) {
  let result = '';
  let skippedPrevious = false;
  let previousWasUpper = false;

  for (const ch of str) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      if (skippedPrevious) {
        // add uppercase if previous was lowercase, else lowercase
        result += previousWasUpper ? ch.toLowerCase() : ch.toUpperCase();
        skippedPrevious = false;
      } else {
        // add without change
        result += ch;
      }
      previousWasUpper = ch === ch.toUpperCase();
    } else {
      // Skip non-alphanumeric character and mark that we skipped
      skippedPrevious = true;
    }
  }

  return result;
}

function capitalize(str) {
  if (!str || typeof str !== "string") return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toIriName(str) {
  if (!str) return str;
  return str + "IRI";
}

function getVarName(uri, isIRI) {
  let localName = getLocalName(uri);
  if (!localName) {
    return "?var";
  }
  localName = toNiceLocalName(localName);
  if (isIRI) {
    return "?" + toIriName(capitalize(localName));
  }
  return "?" + localName;
}

function toValidFilename(str, maxLength = 255) {
  // Replace invalid characters with underscores
  let filename = str
    // remove control characters and invalid filename chars
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

function isRdfTypePredicate(predicate) {
  return predicate === "rdf:type" || predicate === "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
}

function dePrefixify(iri, prefixes) {
  Object.entries(prefixes || {}).some(([prefix, uri]) => {
    if (iri.startsWith(prefix + ':')) {
      iri = uri + iri.slice(prefix.length + 1);
      return true;
    }
    return false;
  });
  return iri;
}

function mappingToSelect(mappingName, mapping, prefixes) {
  let triples = [];
  let vars = [];
  const sVar = `?${toIriName(mappingName)}`;
  const typePredicateObject = mapping.po.find(po => isRdfTypePredicate(po[0]));
  if (!typePredicateObject) {
    console.log(`⚠️  Mapping ${mappingName} has no rdf:type predicate, skipping.`);
    return "";
  }
  triples.push(`${sVar} a <${typePredicateObject[1].replace("~iri", "")}> .`);
  mapping.po.forEach(po => {
    if (isRdfTypePredicate(po[0])) {
      return;
    }
    let pred = dePrefixify(po[0].replace("~iri", ""), prefixes);
    let obj = po[1];
    let v = getVarName(pred, obj.includes("~iri"));
    if (vars.includes(v)) {
      return; // avoid double variable in case two mapping rules yield same var
    }
    if (obj.includes("$(")) {
      triples.push(`OPTIONAL { ${sVar} <${pred}> ${v} . }`);
      vars.push(v);
    }
  });
  const queryTitle = `${mappingName}`;
  const query = `# ${queryTitle} 
SELECT DISTINCT ${vars.join(" ")} WHERE {
  ${triples.join("\n  ")}
}
`;
  const filename = path.join(splitDir, toValidFilename(queryTitle) + ".rq");
  fs.writeFileSync(filename, query, "utf8");
  console.log(`✅ Query for mapping ${mappingName} written to ${filename}`);
  return query;
}

// Find cross-mapping relations (object IRIs that refer to other mappings)
function findCrossMappingQueries(mappings) {
  let queries = [];
  Object.entries(mappings).forEach(([name, mapping]) => {
    const sourceTypePo = mapping.po.find(po => isRdfTypePredicate(po[0]));
    if (!sourceTypePo) {
      console.log(`⚠️  Mapping ${name} has no rdf:type predicate, skipping.`);
      return;
    }
    mapping.po.forEach(po => {
      if (po[1].includes("~iri")) {
        // Try to guess target mapping from IRI
        const target = po[1].match(/example\.org\/([^\/]+)\//);
        if (target) {
          const targetClass = target[1];
          if (mappings[targetClass] && targetClass !== name) {
            const queryTitle = `Join ${name} to ${targetClass}`; 
            // Join query
            const n = toIriName(name);
            const t = toIriName(targetClass);
            const targetTypePo = mappings[targetClass].po.find(poT => isRdfTypePredicate(poT[0]));
            if (!targetTypePo) {
              console.log(`⚠️  Mapping ${targetClass} has no rdf:type predicate, skipping.`);
              return;
            }
            const query = `# ${queryTitle}
SELECT DISTINCT ?${n} ?${t} WHERE {
  ?${n} a <${sourceTypePo[1].replace("~iri", "")}> .
  ?${t} a <${targetTypePo[1].replace("~iri", "")}> .
  ?${n} <${po[0].replace("~iri", "")}> ?${t} .
}
`;
            const filename = path.join(splitDir, toValidFilename(queryTitle) + ".rq");
            fs.writeFileSync(filename, query, "utf8");
            console.log(`✅ Query for cross-mapping ${name} to ${targetClass} written to ${filename}`);
            queries.push(query);
          }
        }
      }
    });
  });
  return queries;
}

// Main
const usualPrefixes = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  dc: "http://purl.org/dc/elements/1.1/",
  foaf: "http://xmlns.com/foaf/0.1/",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  owl: "http://www.w3.org/2002/07/owl#"
}
const prefixes = yarrrml.prefixes ? {...yarrrml.prefixes, ...usualPrefixes} : usualPrefixes;

const mappings = yarrrml.mappings;
if (!mappings || Object.keys(mappings).length === 0) {
  console.error("❌ No mappings found in the YARRRML file.");
  process.exit(1);
}
let output = `# SPARQL queries generated from ${path.basename(yarrrmlFile)}\n\n`;

Object.entries(mappings).forEach(([name, mapping]) => {
  output += mappingToSelect(name, mapping, prefixes) + "\n";
});

output += "# Example cross-mapping queries\n\n";
output += findCrossMappingQueries(mappings).join("\n");

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✅ SPARQL queries written to ${outputFile}`);