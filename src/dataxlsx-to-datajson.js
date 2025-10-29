// Install dependencies first:
//   npm install xlsx fs commander

const XLSX = require("xlsx");
const fs = require("fs");
const { Command } = require("commander");
const path = require("path");

const program = new Command();

program
  .option("-d, --delimiter <char>", "Delimiter used inside cells", "|")
  .option("-i, --input <file>", "Input Excel file", "some-input-dir/somefile.xlsx")
  .option("-o, --outdir <dir>", "Output directory", "some-output-dir")


program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const delimiter = options.delimiter;
const outputDir = options.outdir;
const generateSchema = options.schema;

// Get base name without extension
const baseName = path.basename(inputFile, path.extname(inputFile));

// Load Excel file
const totalXlsx = XLSX.readFile(inputFile);

// To hold all sheets' data
const allSheetsData = {};

// Process each sheet
totalXlsx.SheetNames.forEach(sheetName => {
  if (sheetName.startsWith('_')) {
    console.log(`⚠️  Sheet "${sheetName}" is ignored (starts with '_')`);
    return;
  }
  const sheet = totalXlsx.Sheets[sheetName];
  const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (sheetData.length === 0) {
    console.log(`⚠️  Sheet "${sheetName}" is empty, skipping.`);
    return;
  }
  // We convert the values of all keys to array (easier to make mappings later)
  const processedRows = sheetData.map(row => {
    let newRow = {};
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === "string" && value.includes(delimiter)) {
        newRow[key] = value.split(delimiter).map(v => v.trim());
      } else if (value !== "" && value !== undefined) {
        newRow[key] = [value];
      } // else: skip key if empty
    });
    return newRow;
  });
  allSheetsData[sheetName] = processedRows;
  });

// Save as mapping data as JSON
const jsonFile = path.join(outputDir, `${baseName}.json`);

if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(jsonFile, JSON.stringify(allSheetsData, null, 2), "utf8");
console.log(`✅ JSON written to ${jsonFile}`);