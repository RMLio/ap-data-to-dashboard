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
  .option("-s, --schema", "Generate JSON Schema files", false);

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const delimiter = options.delimiter;
const outputDir = options.outdir;
const generateSchema = options.schema;

// Get base name without extension
const baseName = path.basename(inputFile, path.extname(inputFile));

// Load Excel file
const workbook = XLSX.readFile(inputFile);

workbook.SheetNames.forEach(sheetName => {
  if (sheetName.startsWith('_')) {
    console.log(`⚠️  Sheet "${sheetName}" is ignored (starts with '_')`);
    return;
  }
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (jsonData.length === 0) {
    console.log(`⚠️  Sheet "${sheetName}" is empty, skipping.`);
    return;
  }

  // Step 0: Remove spaces from keys
  jsonData.forEach(row => {
    Object.keys(row).forEach(key => {
      const niceKey = key.replaceAll(' ', '');
      if (niceKey !== key) {
        row[niceKey] = row[key];
        delete row[key];
      }
    });
  });

  // Step 1: Find keys that ever have a delimited value
  const arrayKeys = new Set();
  jsonData.forEach(row => {
    Object.entries(row).forEach(([key, value]) => {
      if (typeof value === "string" && value.includes(delimiter)) {
        arrayKeys.add(key);
      }
    });
  });

  // Step 2: Convert delimited cells to arrays, and for arrayKeys always output an array
  const processedRows = jsonData.map(row => {
    let newRow = {};
    Object.entries(row).forEach(([key, value]) => {
      if (arrayKeys.has(key)) {
        if (typeof value === "string" && value.includes(delimiter)) {
          newRow[key] = value.split(delimiter).map(v => v.trim());
        } else if (value !== "" && value !== undefined) {
          newRow[key] = [value];
        } // else: skip key if empty
      } else {
        if (value !== "" && value !== undefined) {
          newRow[key] = value;
        } // else: skip key if empty
      }
    });
    return newRow;
  });

  // Save as JSON
  const outputFile = path.join(outputDir, `${baseName}-${sheetName}.json`);
  if (!fs.existsSync(outputDir)){
      fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputFile, JSON.stringify(processedRows, null, 2), "utf8");
  console.log(`✅ JSON written to ${outputFile}`);

  // Optional: Generate JSON Schema
  if (generateSchema) {
    // Collect all keys
    const allKeys = new Set();
    processedRows.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });

    // Infer types
    const properties = {};
    allKeys.forEach(key => {
      let type = "string";
      let isArray = arrayKeys.has(key);
      let foundType = null;

      for (const row of processedRows) {
        if (row[key] !== undefined) {
          if (isArray) {
            if (row[key].length > 0) {
              foundType = typeof row[key][0];
              break;
            }
          } else {
            foundType = typeof row[key];
            break;
          }
        }
      }

      if (isArray) {
        properties[key] = {
          type: "array",
          items: { type: foundType === "number" ? "number" : "string" }
        };
      } else {
        properties[key] = {
          type: foundType === "number" ? "number" : "string"
        };
      }
    });

    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "array",
      items: {
        type: "object",
        properties,
        additionalProperties: false
      }
    };

    const schemaFile = path.join(outputDir, `${baseName}-${sheetName}.schema.json`);
    fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2), "utf8");
    console.log(`✅ JSON Schema written to ${schemaFile}`);
  }
});
