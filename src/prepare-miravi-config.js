const fs = require("fs");
const { Command } = require("commander");
const path = require("path");
const { exit } = require("process");

const program = new Command();

program
  .option("-i, --indir <dir>", "Input directory containing initial Miravi configuration", "some-miravi-initial-config-dir")
  .option("-s, --splitdir <dir>", "Input directory containing automatically generated queries", "some-output-dir/generated-queries")
  .option("-o, --outdir <dir>", "Output directory; subdirectory 'main' of a Miravi clone", "subprojects/miravi-a-linked-data-viewer/main")
  .option("-u, --dataurl <url>", "URL where the RDF output will be served", "https://www.example.com/output.ttl");

program.parse(process.argv);

const options = program.opts();
const inDir = options.indir;
const splitDir = options.splitdir;
const outDir = options.outdir;
const dataUrl = options.dataurl;

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  if (!fs.existsSync(src)) {
    return false;
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
}

// Copy the public directory from inDir to outDir
const publicInDir = path.join(inDir, "public");
const publicOutDir = path.join(outDir, "public");
fs.rmSync(publicOutDir, { recursive: true, force: true });
if (copyDirectory(publicInDir, publicOutDir)) {
  console.log(`✅ Copied public directory from ${publicInDir} to ${publicOutDir}`);
} else {
  console.warn(`❌ Public directory ${publicInDir} does not exist; cannot continue.`);
  exit(1);
}

// Copy the queries from splitDir to outDir/public/queries
if (copyDirectory(splitDir, path.join(publicOutDir, "queries"))) {
  console.log(`✅ Copied queries from ${splitDir} to ${path.join(publicOutDir, "queries")}`);
} else {
  console.warn(`❌ Queries directory ${splitDir} does not exist; continuing without automated queries.`);
}

// Read the config.json from inDir and update it with our queries from splitDir
const defaultComunicaContext = {
  sources: [
    dataUrl
  ]
};
const groupIdNormal = "gr-tooling-other";
const groupIdJoin = "gr-tooling-join";
const additionalQueryGroups = [
  {
    id: groupIdNormal,
    name: "Automatically generated queries"
  },
  {
    id: groupIdJoin,
    name: "Automatically generated join-queries"
  }
];
let miraviConfig = JSON.parse(fs.readFileSync(path.join(inDir, "config.json"), "utf8"));
miraviConfig.queryGroups = miraviConfig.queryGroups ? [...miraviConfig.queryGroups, ...additionalQueryGroups] : additionalQueryGroups;
let idSequenceNumber = 1000;
if (!miraviConfig.queries) {
  miraviConfig.queries = [];
} else {
  for (const query of miraviConfig.queries) {
    query.comunicaContext = query.comunicaContext ? [...query.comunicaContext, ...defaultComunicaContext] : defaultComunicaContext;
    const currentId = parseInt(query.id, 10);
    if (!isNaN(currentId) && currentId >= idSequenceNumber) {
      idSequenceNumber = Math.floor((currentId + 1000)/1000)*1000;
    }
  }
}
if (fs.existsSync(splitDir)) {
  const splitFiles = fs.readdirSync(splitDir).filter(file => file.endsWith(".rq"));
  for (const file of splitFiles) {
    const queryName = path.basename(file, ".rq");
    const niceName = queryName.replace(/_/g, " ");
    miraviConfig.queries.push({
      id: idSequenceNumber.toString(),
      queryGroupId: file.startsWith("Join_") ? groupIdJoin : groupIdNormal,
      queryLocation: file,
      name: niceName,
      description: "Automatically generated query " + file,
      comunicaContext: defaultComunicaContext
    });
    idSequenceNumber += 10;
  }
}
fs.writeFileSync(path.join(outDir, "src", "config.json"), JSON.stringify(miraviConfig, null, 2), "utf8");
console.log(`✅ Wrote updated Miravi configuration to ${path.join(outDir, "config.json")}`);
