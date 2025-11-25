const fs = require("fs");
const { Command } = require("commander");
const path = require("path");
const { exit } = require("process");

const program = new Command();

program
  .option("-i, --indir <dir>", "Input directory containing initial Miravi configuration", "some-miravi-initial-config-dir")
  .option("-s, --splitdir <dir>", "Input directory containing automatically generated queries", "some-output-dir/generated-queries")
  .option("-o, --outdir <dir>", "Output directory; subdirectory 'main' of a miravi", "node_modules/miravi/main")
  .option("-u, --dataurl <url>", "Base URL where the RDF output will be served", "https://www.example.com/")  // all ttl files are served from here
  .option("-d, --datadir <dir>", "Directory holding the RDF output that will be served", "some-out/serve-me-dir"); // all ttl files are stored here

program.parse(process.argv);

const options = program.opts();
const inDir = options.indir;
const splitDir = options.splitdir;
const outDir = options.outdir;
const dataUrl = options.dataurl;
const dataDir = options.datadir;

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

function getTitleLine(path) {
  const data = fs.readFileSync(path, "utf8");
  const line = data.split(/\r?\n/).find(l => l.startsWith("# "));
  return line ? line.slice(2) : null;
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

// Read all .ttl files from dataDir to set up the default comunica context
let sources = [];
if (fs.existsSync(dataDir)) {
  sources = fs.readdirSync(dataDir)
    .filter(file => file.endsWith('.ttl'))
    .map(file => dataUrl + path.basename(file));
} else {
  console.warn('❌ Data directory does not exist:', dataDir);
}
const defaultComunicaContext = {
  sources: sources
};

let miraviConfig = JSON.parse(fs.readFileSync(path.join(inDir, "config.json"), "utf8"));
// Add to additionalQueryGroups only if the group with this id is not present in the miravi config
const groupIdNormal = "gr-tooling-other";
const groupIdJoin = "gr-tooling-join";
additionalQueryGroups = [];
const existsGroupIdNormal = miraviConfig.queryGroups.some(obj => obj.id === groupIdNormal)
if (!existsGroupIdNormal) {
  additionalQueryGroups.push({
    id: groupIdNormal,
    name: "Automatically generated queries"
  });
}
const existsGroupIdJoin = miraviConfig.queryGroups.some(obj => obj.id === groupIdNormal)
if (!existsGroupIdJoin) {
  additionalQueryGroups.push({
    id: groupIdJoin,
    name: "Automatically generated join-queries"
  })
}
miraviConfig.queryGroups = miraviConfig.queryGroups ? [...miraviConfig.queryGroups, ...additionalQueryGroups] : additionalQueryGroups;
let idSequenceNumber = 1000;
if (!miraviConfig.queries) {
  miraviConfig.queries = [];
} else {
  for (const query of miraviConfig.queries) {
    query.comunicaContext = query.comunicaContext ? [...query.comunicaContext, ...defaultComunicaContext] : defaultComunicaContext;
    const currentId = parseInt(query.id, 10);
    if (!isNaN(currentId) && currentId >= idSequenceNumber) {
      idSequenceNumber = Math.floor((currentId + 1000) / 1000) * 1000;
    }
  }
}
if (fs.existsSync(splitDir)) {
  const splitFiles = fs.readdirSync(splitDir).filter(file => file.endsWith(".rq"));
  for (const file of splitFiles) {
    const queryName = getTitleLine(path.join(splitDir, file));
    miraviConfig.queries.push({
      id: idSequenceNumber.toString(),
      queryGroupId: file.startsWith("Join_") ? groupIdJoin : groupIdNormal,
      queryLocation: file,
      name: queryName,
      description: "Automatically generated query " + file,
      comunicaContext: defaultComunicaContext
    });
    idSequenceNumber += 10;
  }
}

const outSrcDir = path.join(outDir, "src")
if (!fs.existsSync(outSrcDir)) {
    fs.mkdirSync(outSrcDir, { recursive: true });
  }
fs.writeFileSync(path.join(outSrcDir, "config.json"), JSON.stringify(miraviConfig, null, 2), "utf8");
console.log(`✅ Wrote updated Miravi configuration to ${path.join(outSrcDir, "config.json")}`);
