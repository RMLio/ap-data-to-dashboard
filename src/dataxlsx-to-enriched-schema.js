const fs = require("fs");
const { Command } = require("commander");
const path = require("path");
const XLSX = require("xlsx");
const { safeLabel: safeLabel } = require("./util");

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
const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), schemaFile), "utf8"));

// Load Excel file
const workBook = XLSX.readFile(inputFile);

// Process _prefixes sheet if it exists
const prefixesDict = {}
if (workBook.SheetNames.includes(sheetName = "_prefixes")) {
    const prefixesSheet = workBook.Sheets["_prefixes"];
    const prefixes = XLSX.utils.sheet_to_json(prefixesSheet, { defval: null });

    for (const row of prefixes) {
        if ("prefix" in row) {
            prefixesDict[row.prefix] = row.uri
        }
    }
}

// Process _customVoc sheet if it exists
const defaultProperties = {};
if (workBook.SheetNames.includes(sheetName = "_customVoc")) {
    const customVocSheet = workBook.Sheets["_customVoc"];
    const customVoc = XLSX.utils.sheet_to_json(customVocSheet, { defval: null });

    // shaclVoc has priority over customVoc
    for (const row of customVoc) {
        if (row.sheetLabel) {
            const sheetLabel = safeLabel(safeGet(row, "sheetLabel"));

            if (!(sheetLabel in schema)) {
                schema[sheetLabel] = {
                    "sheetLabel": sheetLabel,
                    "sheetClass": null,
                    "columns": {}
                };
            }
            let sheetClass = safeGet(row, "sheetClass")
            sheetClass = expandCompactUri(sheetClass, prefixesDict);
            safeAdd(schema[sheetLabel], "sheetClass", sheetClass);
            if (row.columnLabel) {
                const columnLabel = safeLabel(row.columnLabel);
                const sheetColumns = schema[sheetLabel]["columns"];
                if (columnLabel && !(columnLabel in sheetColumns)) {
                    sheetColumns[columnLabel] = {
                        columnLabel: columnLabel,
                    };
                }
                let columnProperty = safeGet(row, "columnProperty");
                columnProperty = expandCompactUri(columnProperty, prefixesDict)
                safeAdd(sheetColumns[columnLabel], "columnProperty", columnProperty);
                let valueDatatype = safeGet(row, "valueDatatype");
                valueDatatype = expandCompactUri(valueDatatype, prefixesDict)
                safeAdd(sheetColumns[columnLabel], "valueDatatype", valueDatatype);
                let valueClass = safeGet(row, "valueClass");
                valueClass = expandCompactUri(valueClass, prefixesDict)
                safeAdd(sheetColumns[columnLabel], "valueClass", valueClass);
                sheetColumns[columnLabel]["valueMinCount"] = null
                sheetColumns[columnLabel]["valueMaxCount"] = null
            }
        }
        // default custom properties, not linked to any sheet
        else if (row.columnLabel) {
            const columnLabel = safeLabel(row.columnLabel);
            defaultProperties[columnLabel] = { "columnLabel": columnLabel };
            let columnProperty = safeGet(row, "columnProperty");
            columnProperty = expandCompactUri(columnProperty, prefixesDict)
            safeAdd(defaultProperties[columnLabel], "columnProperty", columnProperty);
            let valueDatatype = safeGet(row, "valueDatatype");
            valueDatatype = expandCompactUri(valueDatatype, prefixesDict)
            safeAdd(defaultProperties[columnLabel], "valueDatatype", valueDatatype);
            let valueClass = safeGet(row, "valueClass");
            valueClass = expandCompactUri(valueClass, prefixesDict)
            safeAdd(defaultProperties[columnLabel], "valueClass", valueClass);
            defaultProperties[columnLabel]["valueMinCount"] = null
            defaultProperties[columnLabel]["valueMaxCount"] = null
        }
    }
}
// Iterate sheets and add default and missing voc (shape voc and custom voc have priority)
workBook.SheetNames.forEach((sheetName) => {
    if (sheetName.startsWith("_")) {
        console.log(`ℹ️ Sheet "${sheetName}" is ignored when adding missing voc (starts with '_')`);
        return;
    } else {
        const sheetLabel = safeLabel(sheetName);
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
            const columnLabel = safeLabel(header);
            if (columnLabel !== "CODE" && !(columnLabel in sheetColumns)) {
                if (columnLabel in defaultProperties) {
                    sheetColumns[columnLabel] = defaultProperties[columnLabel];
                } else {
                    sheetColumns[columnLabel] = {
                        "columnLabel": columnLabel,
                        "columnProperty": missingEx + columnLabel,
                        "valueDatatype": null,
                        "valueMinCount": null,
                        "valueMaxCount": null,
                    }
                }
            }
        }
    }
});

// Add foreign keys to the schema
iriToLabelMap = {}
for (const sheetLabel in schema) {
    const sheetClass = schema[sheetLabel]["sheetClass"];
    iriToLabelMap[sheetClass] = sheetLabel;
    for (const sheet in schema) {
        for (const column in schema[sheet]["columns"]) {
            if (column.valueClass !== "http://www.w3.org/2004/02/skos/core#Concept") {
                const valueClass = schema[sheet]["columns"][column]["valueClass"]
                schema[sheet]["columns"][column]["valueForeignKeySheet"] = iriToLabelMap[valueClass]
            }
        }
    }
}


// Save enriched schema as JSON
const outputFile = path.join(outputDir, `${baseName}-enriched-schema.json`);

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
function safeAdd(dict, key, value) {
    if (value === "") {
        value = null
    }
    if (!(key in dict) || !dict[key]) {
        // Trim if string   
        if (typeof value === "string") {
            value = value.trim();
        }
        dict[key] = value;
    }
}

function safeGet(dict, key) {
    return key in dict ? dict[key] : null;
}

function expandCompactUri(inputUri, prefixesDict) {
    if (!inputUri) {
        return null;
    }
    const idx = inputUri.indexOf(":");
    if (idx === -1) {
        return inputUri; // No colon → not a compact URI
    }
    const prefix = inputUri.slice(0, idx); // may be empty
    const local = inputUri.slice(idx + 1);
    const base = prefixesDict[prefix];
    if (!base) {
        return inputUri;
    }
    return base + local;
}

