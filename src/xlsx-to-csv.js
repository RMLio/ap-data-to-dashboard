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
const outputDir = options.outdir;
const delimiter = options.delimiter;

// Get base name without extension
const baseName = path.basename(inputFile, path.extname(inputFile));

// Load Excel file
const workbook = XLSX.readFile(inputFile);

workbook.SheetNames.forEach(sheetName => {
    if (!sheetName.startsWith('_')) {
        console.log(`⚠️  Sheet "${sheetName}" is ignored (doesn't start with '_')`);
        return;
    }
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (jsonData.length === 0) {
        console.log(`⚠️  Sheet "${sheetName}" is empty, skipping.`);
        return;
    }

    // Step 1: Analyze headers and detect which need expansion
    let expandedHeaders = [];
    let splitMap = {}; // maps header -> number of splits needed

    jsonData.forEach(row => {
        Object.entries(row).forEach(([key, value]) => {
            if (typeof value === "string" && value.includes(delimiter)) {
                const parts = value.split(delimiter).map(v => v.trim());
                splitMap[key] = Math.max(splitMap[key] || 0, parts.length);
            }
        });
    });

    // Build expanded headers
    Object.keys(jsonData[0]).forEach(header => {
        if (splitMap[header]) {
            for (let i = 1; i <= splitMap[header]; i++) {
                expandedHeaders.push(`${header}_${i}`);
            }
        } else {
            expandedHeaders.push(header);
        }
    });

    // Step 2: Expand rows
    const expandedRows = jsonData.map(row => {
        let newRow = {};
        Object.entries(row).forEach(([key, value]) => {
            if (splitMap[key]) {
                const parts = String(value).split(delimiter).map(v => v.trim());
                for (let i = 1; i <= splitMap[key]; i++) {
                    newRow[`${key}_${i}`] = parts[i - 1] || "";
                }
            } else {
                newRow[key] = value;
            }
        });
        return newRow;
    });

    // Step 3: Convert to CSV
    const csv = [
        expandedHeaders.join(","), // header row
        ...expandedRows.map(row =>
            expandedHeaders.map(h => JSON.stringify(row[h] || "")).join(",")
        ),
    ].join("\n");

    // Save file
    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, `${baseName}-${sheetName.slice(1)}.csv`);
    fs.writeFileSync(outputFile, csv);

    console.log(`✅ CSV written to ${outputFile}`);
});