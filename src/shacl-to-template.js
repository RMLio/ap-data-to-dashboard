/**
 * SHACL to Template Converter
 * This script converts a SHACL shapes file to a template XLSX file
 * Each NodeShape with propertyes becomes a worksheet, with its properties as columns.
 * Additionally, a template schema JSON file and dummy data XLSX files are created .
 *  */

// Required Node.js modules
const fs = require("fs");  // File system operations
const path = require("path"); // Path manipulations
const N3 = require("n3");   // RDF/Turtle parser and store
const { DataFactory } = N3;
const { namedNode } = DataFactory;
const ExcelJS = require("exceljs"); // Excel file handling with formatting
const { Command } = require("commander");
const { safeLabel } = require("./util");
const defaultVoc = require("./defaultVoc")

const program = new Command();

program
  .option("-i, --input <file>", "Input SHACL file", "in-shacl/shacl.ttl")
  .option("-o, --output <dir>", "Output directory", "in-shacl")
  .option("-d, --dummy <number>", "Amount of dummy data files", 2)

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const outputDir = options.output;
const dummy = options.dummy;

const templateFile = path.join(outputDir, "template.xlsx");
const schemaFile = path.join(outputDir, "template.schema.json");
const dummyFiles = []
for (let i = 1; i <= dummy; i++) {
  dummyFiles.push(path.join(outputDir, "dummydata-a" + i + ".xlsx"));
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ The input SHACL file ${inputFile} does not exist.`);
  process.exit(1);
}
if (!fs.existsSync(path.dirname(outputDir))) {
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
}

// Initialize N3 parser and store for handling RDF data
let parser = new N3.Parser();
let store = new N3.Store();

// Read input file
let inputData = fs.readFileSync(inputFile, "utf8");

// Parse the SHACL file
// This is an asynchronous operation that processes the file quad by quad
parser.parse(inputData,
  function (error, quad, prefixes) {
    if (quad) {
      store.add(quad);    // Add the quad to our store
    }
    else {
      // When parsing is complete (quad is null), generate the templates
      // generateTemplate is async (uses await internally) so call it and catch errors
      generateTemplates(store).catch(err => {
        // eslint-disable-next-line no-console
        console.error("Error generating Excel:", err);
        process.exit(1);
      });
    }
  });

/**
 * Generates the templates from the SHACL shapes in the RDF store
 * @param {N3.Store} store - The N3 store containing the parsed SHACL shapes
 * @returns {void}
 */
async function generateTemplates(store) {

  // collect data for foreign key mapping
  const iriToLabelMap = {};
  // collect sheet data as json
  const schema = {}
  // collect cells with mincount >=1
  const requiredData = {}

  // Iterate through each NodeShape in the SHACL file
  for (const nodeShape of store.getSubjects(null, namedNode("http://www.w3.org/ns/shacl#NodeShape"))) {

    // Only create a worksheet the domain has properties  (otherwise too many sheets with only code column)  
    const properties = store.getObjects(nodeShape, namedNode("http://www.w3.org/ns/shacl#property"))
    if (properties.length != 0) {
      let sheetLabel = getObjectValueIfExists(store, nodeShape, namedNode("http://www.w3.org/2000/01/rdf-schema#label"));
      if (sheetLabel == null) {
        console.error(`❌ Missing rdfs:label for ${nodeShape.value}, skipping sheet creation`);
        continue;
      }
      let sheetClass = getObjectValueIfExists(store, nodeShape, namedNode("http://www.w3.org/ns/shacl#targetClass"));
      if (sheetClass == null) {
        console.error(`❌ Missing shacl:targetClass for ${nodeShape.value}, skipping sheet creation`);
        continue;
      }
      sheetLabel = safeLabel(sheetLabel);
      iriToLabelMap[sheetClass] = sheetLabel;
      schema[sheetLabel] = {
        "sheetLabel": sheetLabel,
        "sheetClass": sheetClass,
        "columns": {}
      };

      // Collect all property labels for this NodeShape
      let wsColumns = ["CODE"]; // 
      requiredData[sheetLabel] = [1]
      let countColumns = 2;
      for (const property of properties) {
        // Get the label of each property to use as column headers
        let columnLabel = getObjectValueIfExists(store, property, namedNode("http://www.w3.org/2000/01/rdf-schema#label"));
        if (columnLabel == null) {
          console.error(`❌ Missing rdfs:label for property ${property.value} of ${nodeShape.value}, skipping column creation`);
          continue;
        }
        let columnProperty = getObjectValueIfExists(store, property, namedNode("http://www.w3.org/ns/shacl#path"));
        if (columnProperty == null) {
          console.error(`❌ Missing shacl:path for property ${property.value} of ${nodeShape.value}, skipping column creation`);
          continue;
        }
        columnLabel = safeLabel(columnLabel);
        let valueClass = getObjectValueIfExists(store, property, namedNode("http://www.w3.org/ns/shacl#class"));
        let valueDatatype = getObjectValueIfExists(store, property, namedNode("http://www.w3.org/ns/shacl#datatype"));
        let valueMinCount = getObjectValueIfExists(store, property, namedNode("http://www.w3.org/ns/shacl#minCount"));
        let valueMaxCount = getObjectValueIfExists(store, property, namedNode("http://www.w3.org/ns/shacl#maxCount"));
        wsColumns.push(columnLabel);

        schema[sheetLabel]["columns"][columnLabel] = {
          "columnLabel": columnLabel,
          "columnProperty": columnProperty,
          "valueClass": valueClass,
          "valueDatatype": valueDatatype,
          "valueMinCount": valueMinCount,
          "valueMaxCount": valueMaxCount
        }

        // Collect required fields
        if (valueMinCount !== null && parseInt(valueMinCount) >= 1) {
          requiredData[sheetLabel].push(countColumns);
        }
        countColumns += 1;
      }
    }
  }

  // Add foreign keys to the schema
  for (const sheet in schema) {
    for (const column in schema[sheet]["columns"]) {
      if (column.valueClass !== "http://www.w3.org/2004/02/skos/core#Concept") {
        const valueClass = schema[sheet]["columns"][column]["valueClass"]
        schema[sheet]["columns"][column]["valueForeignKeySheet"] = iriToLabelMap[valueClass]
      }
    }
  }

  // Create a new Excel workbook
  const wb = new ExcelJS.Workbook();
  // Create worksheets for each NodeShape, in alphabetical order
  const sheetLablesSorted = Object.keys(schema).sort();
  for (const sheetLabel of sheetLablesSorted) {
    const columns = schema[sheetLabel]['columns'];
    // Sort columns alphabetically, but always put CODE first.
    const columnLablesSorted = Object.keys(columns).sort();
    let wsColumns = ["CODE"]; // First column is always CODE      
    for (const columnLabel of columnLablesSorted) {
      if (!(columnLabel === "CODE")) {// Skip CODE as it is already added      
        wsColumns.push(columnLabel);
      }
    }
    const ws = wb.addWorksheet(sheetLabel);
    // Add the headers
    ws.addRow(wsColumns);
  }
  // Add a _customVoc sheet
  const customVocSheet = wb.addWorksheet("_customVoc");
  // No min and max count for the custom voc
  for (const row of defaultVoc.customVocSheet) {
    customVocSheet.addRow(row);
  }

  // Add a _prefixes sheet
  const prefixSheet = wb.addWorksheet("_prefixes");
  for (const row of defaultVoc.prefixesSheet) {
    prefixSheet.addRow(row);
  }

  //Format the the sheets
  wb.eachSheet(sheet => {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach(column => {
      column.width = 40; // Set a default column width
      column.alignment = { wrapText: true }; // Enable text wrapping
    });
    const headerRow = sheet.getRow(1);
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.height = 20;
    // Highlight required fields
    for (const column in requiredData[sheet.name]) {
      const cell = sheet.getRow(1).getCell(requiredData[sheet.name][column]);
      cell.font = {
        bold: true,
        underline: true
      };
    }
  });
  wb.removeWorksheet("Sheet1"); // Remove default sheet 

  // Export to Template Excel file
  try {
    // Write the workbook to disk
    await wb.xlsx.writeFile(templateFile);
    // eslint-disable-next-line no-console
    console.log(`✅ Template EXCEL file written to ${templateFile}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`❌ Error writing Template Excel file: ${error.message}`);
    process.exit(1);
  }

  // Export to Schema JSON file   
  fs.writeFile(schemaFile, JSON.stringify(schema, null, 2), (error) => {
    if (error) {
      console.error(`❌ Error writing JSON file: ${error.message}`);
    } else {
      console.log(`✅ Schema JSON file written to ${schemaFile}`);
    }
  });

  // Create dummy data files
  for (const [index, dummyFile] of dummyFiles.entries()) {
    actor = index + 1
    const prefix = "a" + actor
    wb.eachSheet(sheet => {
      if (!(sheet.name == "_customVoc") && !(sheet.name == "_prefixes")) {
        const columnNames = sheet.getRow(1);
        for (let i = 1; i <= 5; i++) { // Add 5 rows of dummy data
          const dummyRow = [];
          // Add the primary key per row: code column
          dummyRow.push(`${prefix}/code/${sheet.name}_${i}`);
          // Add values for the other columns
          for (let j = 2; j <= columnNames.cellCount; j++) {
            const columnName = columnNames.getCell(j).value
            const columnDetails = schema[sheet.name]["columns"][columnName]
            const addArray = columnDetails["valueMaxCount"] != 1 && i == 5;
            let v = `${prefix}_${columnName}_${i}`;
            if (addArray) {
              v += "|" + v + "b";
            }
            if (columnDetails["valueForeignKeySheet"]) {
              v = `${prefix}/code/${columnDetails["valueForeignKeySheet"]}_${getRandomInteger(1, 5)}`
              if (addArray) {
                v += "|" + `${prefix}/code/${columnDetails["valueForeignKeySheet"]}_${getRandomInteger(1, 5)}`
              }
            } else if (columnDetails["valueDatatype"] === "http://www.w3.org/2001/XMLSchema#integer") {
              v = randomArray(() => getRandomInteger(), addArray);
            } else if (columnDetails["valueDatatype"] === "http://www.w3.org/2001/XMLSchema#decimal") {
              v = randomArray(() => getRandomDecimal(), addArray);
            } else if (columnDetails["valueDatatype"] === "http://www.w3.org/2001/XMLSchema#date") {
              v = randomArray(() => getRandomDate(), addArray);
            } else if (columnDetails["valueDatatype"] === "http://www.w3.org/2001/XMLSchema#time") {
              v = randomArray(() => getRandomTime(), addArray);
            } else if (columnDetails["valueDatatype"] === "http://www.w3.org/2001/XMLSchema#dateTime") {
              v = randomArray(() => getRandomDateTime(), addArray);
            } else if (columnDetails["valueDatatype"] === "http://www.w3.org/2001/XMLSchema#anyURI") {
              v = `http://example.com/au/${columnName}_${i}`;
              if (addArray) {
                v += "|" + v + "b"
              }
            }
            dummyRow.push(v)
          }
          sheet.addRow(dummyRow);
        }
      }
    }
    );

    // Save the workbook with dummy data
    try {
      await wb.xlsx.writeFile(dummyFile);
      console.log(`✅ EXCEL file with dummy data written to ${dummyFile}`);
    } catch (error) {
      console.error(`❌ Error writing Excel file with dummy data: ${error.message}`);
      process.exit(1);
    }
    // remove added lines before making next dummy data file
    wb.eachSheet(sheet => {
      if (!(sheet.name == "_customVoc") && !(sheet.name == "_prefixes")) {
        // Remove all rows except the header row (row 1) 
        for (let i = 0; i < 6; i++) {
          sheet.spliceRows(2, 1);
        }
      }
    });
  }
}

// Helper function to get the value of an object for a given subject and predicate, or null if it doesn"t exist
function getObjectValueIfExists(store, subject, predicate) {
  const objects = store.getObjects(subject, predicate);
  if (objects.length > 0) {
    return objects[0].value;
  } else {
    return null;
  }
}


function getRandomInteger(min = -1000, max = 1000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function getRandomDecimal(min = -1000, max = 1000, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return (Math.random() * (max - min) + min).toFixed(decimals);
}


function getRandomDate(startYear = 2000, endYear = 2030) {
  const start = new Date(`${startYear}-01-01`);
  const end = new Date(`${endYear}-12-31`);
  const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return randomDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
}

function getRandomTime() {
  const msInDay = 24 * 60 * 60 * 1000;
  const randomMs = Math.floor(Math.random() * msInDay);
  const date = new Date(0);
  date.setMilliseconds(randomMs);

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`; // Format: HH:MM:SS
}


function getRandomDateTime(startYear = 2000, endYear = 2030) {
  const start = new Date(`${startYear}-01-01T00:00:00`);
  const end = new Date(`${endYear}-12-31T23:59:59`);
  const randomDateTime = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return randomDateTime.toISOString(); // Format: YYYY-MM-DDTHH:MM:SS.sssZ
}

function randomArray(randomValueFn, isArray) {
  if (isArray) {
    const v1 = randomValueFn();
    const v2 = randomValueFn();
    return v1 + "|" + v2
  } else {
    return randomValueFn();
  }
}



