const fs = require("fs");
const { Command } = require("commander");
const path = require("path");
const XLSX = require("xlsx"); // Missing import
const { saveLabel } = require("./util");

const program = new Command();

program
    .option("-i, --input <file>", "Input Excel file", "some-input-dir/somefile.xlsx")
    .option("-o, --output <dir>", "Output dir for enriched schema", "some-output-dir")
    .option("-s, --schema <file>", "Input schema json", "out/some-schema.json")

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const outputDir = options.output;
const schemaFile = options.schema;

const missingEx = "http://missing.example.com/";
const baseName = path.basename(inputFile, path.extname(inputFile));

// Load Excel file
const workBook = XLSX.readFile(inputFile);

// Process _customVoc sheet
const customVocSheet = workBook.Sheets["_customVoc"];
const customVoc = XLSX.utils.sheet_to_json(customVocSheet, { defval: "" });

const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), schemaFile), "utf8"));

// shaclVoc has priority over customVoc
for (const row of customVoc) {
    if ("sheetLabel" in row) {
        const sheetLabel = saveLabel(saveGet(row, "sheetLabel"));

        if (!(sheetLabel in schema)) {
            schema[sheetLabel] = {
                "sheetLabel": sheetLabel,
                "sheetClass": null,
                "columns": {}
            };
        }
        if (sheetLabel) {
            const sheetClass = saveGet(row, "sheetClass")
            console.log(sheetClass)
            saveAdd(schema[sheetLabel], "sheetClass", sheetClass);

            const columnLabel = saveLabel(row.columnLabel);
            if (columnLabel) {
                const sheetColumns = schema[sheetLabel]["columns"];
                if (columnLabel && !(columnLabel in sheetColumns)) {
                    sheetColumns[columnLabel] = {
                        columnLabel: columnLabel,
                    };
                }
                saveAdd(sheetColumns[columnLabel], "columnProperty", saveGet(row, "columnProperty"));
                saveAdd(sheetColumns[columnLabel], "valueDatatype", saveGet(row, "valueDatatype"));
                saveAdd(sheetColumns[columnLabel], "valueForeignKeySheet", saveGet(row, "valueForeignKeySheet"));
                sheetColumns[columnLabel]["valueMinCount"] = null
                sheetColumns[columnLabel]["valueMaxCount"] = null
            }
        }
    }
}

// Iterate sheets and add missing voc (shape voc and custom voc have priority)
workBook.SheetNames.forEach((sheetName) => {
    if (sheetName.startsWith("_")) {
        console.log(`⚠️ Sheet "${sheetName}" is ignored when adding missing voc (starts with '_')`);
        return;
    } else {
        const sheetLabel = saveLabel(sheetName);
        if (!(sheetLabel in schema)) {
            schema[sheetLabel] = {
                "sheetLabel": sheetLabel,
                "sheetClass": missingEx + sheetLabel,
                "columns": {}
            };
        }
        const sheet = workBook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const headers = data[0];
        const sheetColumns = schema[sheetLabel]["columns"];
        for (const header of headers) {
            const columnLabel = saveLabel(header);
            if (!(header === "CODE") && !(columnLabel in sheetColumns)) {
                sheetColumns[columnLabel] = {
                    "columnLabel": columnLabel,
                    "columnProperty": missingEx + columnLabel,
                    "valueDatatype": null,
                    "valueMinCount": null,
                    "valueMaxCount": null,
                    "valueForeignKeySheet": null
                }
            }
        }
    }
});


// Save enriched schema as JSON
const outputFile = path.join(outputDir, `${baseName}-enrichedschema.json`);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFile(outputFile, JSON.stringify(schema, null, 2), (error) => {
    if (error) {
        console.error(`❌ Error writing enriched schema JSON file: ${error.message}`);
    } else {
        console.log(`✅ Enriched schema JSON file written to ${outputFile}`);
    }
});

// Helper functions
function saveAdd(dict, key, value) {
    if (value === "") {
        value = null
    }
    if (!(key in dict) || !dict[key]) {

        dict[key] = value;
    }
}

function saveGet(dict, key) {
    return key in dict ? dict[key] : null;
}