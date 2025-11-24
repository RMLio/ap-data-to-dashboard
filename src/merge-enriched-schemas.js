const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { Command } = require("commander");

const program = new Command();

program
  .option("-i, --input <dir>", "Input dir to look for files ending with '-enriched-schema.json", "some-input-dir")
  // TODO generic solution for input
  .option("-o, --output <file>", "Output merged schema file", "out/some-merged-schema.json");

program.parse(process.argv);

const options = program.opts();
const inputDir = options.input;
const outputFile = options.output;


// Read all files in the directory
const files = fs.readdirSync(inputDir);

// Filter files ending with -enriched-schema.json
const schemaFiles = files.filter(file => file.endsWith('-enriched-schema.json'));

let merged = {}
schemaFiles.forEach(file => {
  const filePath = path.join(inputDir, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  merged = _.merge(merged, content);
});

if (!fs.existsSync(path.dirname(outputFile))) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}
// Write merged result to output file
fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2));
console.log(`✅ Merged ${schemaFiles.length} files into ${outputFile}`);






