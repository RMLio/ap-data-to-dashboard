/**
 * SHACL to Excel Converter
 * This script converts a SHACL shapes file to an Excel workbook.
 * Each NodeShape with propertyes becomes a worksheet, with its properties as columns.
 * A sheet with shema data is added as last sheet, as input for the creation of a YARRRML mapping and SPARQL queries.
 *  */

// Required Node.js modules
const fs = require('fs');  // File system operations
const path = require('path'); // Path manipulations
const N3 = require('n3');   // RDF/Turtle parser and store
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
const ExcelJS = require('exceljs'); // Excel file handling with formatting
const { Command } = require("commander");

const program = new Command();

program
  .option("-i, --input <file>", "Input SHACL file", "in-shacl/shacl.ttl")
  .option("-o, --output <file>", "Output Excel file", "in-shacl/template.xlsx")

program.parse(process.argv);

const options = program.opts();
const inputFile = options.input;
const outputFile = options.output;

if (!fs.existsSync(inputFile)) {
  console.error(`❌ The input SHACL file ${inputFile} does not exist.`);
  process.exit(1);
}
if (!fs.existsSync(path.dirname(outputFile))) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}

// Initialize N3 parser and store for handling RDF data
let parser = new N3.Parser();
let store = new N3.Store();

// Read input file
let inputData = fs.readFileSync(inputFile, 'utf8');

// Parse the SHACL file
// This is an asynchronous operation that processes the file quad by quad
parser.parse(inputData,
  function (error, quad, prefixes) {
    if (quad) {
      store.add(quad);    // Add the quad to our store
    }
    else {
      // When parsing is complete (quad is null), generate the Excel file
      // generateExcel is async (uses await internally) so call it and catch errors
      generateExcel(store).catch(err => {
        // eslint-disable-next-line no-console
        console.error('Error generating Excel:', err);
        process.exit(1);
      });
    }
  });

/**
 * Generates an Excel workbook from the SHACL shapes in the RDF store
 * @param {N3.Store} store - The N3 store containing the parsed SHACL shapes
 * @returns {void}
 */
async function generateExcel(store) {
  // Create a new Excel workbook
  const wb = new ExcelJS.Workbook();

  // sheet for Shema data 
  const wsSchemaData = [["domainLabel", "domainIri", "propertyLabel", "propertyIri", "rangeIri", "rangeDatatype", "rangeMinCount", "rangeMaxCount", "rangeForeignKeySheet"]];
  const iriToLabelMap = {};
  // collect cells with mincount >=1
  const requiredData = {}

  // Iterate through each NodeShape in the SHACL file
  for (const nodeShape of store.match(null, null, namedNode('http://www.w3.org/ns/shacl#NodeShape'))) {
    
    // Only create a worksheet the domain has properties  (otherwise too many sheets with only code column)  
    if (store.countQuads(nodeShape.subject, namedNode('http://www.w3.org/ns/shacl#property'), null) != 0) {

      // Get the label of the NodeShape to use as worksheet name
      let domainLabel = store.getObjects(nodeShape.subject, namedNode('http://www.w3.org/2000/01/rdf-schema#label'))[0].value; //shacl:name is not always present, also shacl:label is missing in some shapes files 
      domainLabel = saveLabel(domainLabel); // replace spaces with underscores for sheet names
      let domainIri = store.getObjects(nodeShape.subject, namedNode('http://www.w3.org/ns/shacl#targetClass'))[0].value;
      iriToLabelMap[domainIri] = domainLabel;
      // Collect all property labels for this NodeShape
      let wsColumns = ["code"];
      requiredData[domainLabel] = [1]
      let countColumns = 2;
      for (const property of store.match(nodeShape.subject, namedNode('http://www.w3.org/ns/shacl#property'), null)) {
        // Get the label of each property to use as column headers
        let propertyLabel = store.getObjects(property.object, namedNode('http://www.w3.org/2000/01/rdf-schema#label'))[0].value; //shacl:name is not always present, also shacl:label is missing in some shapes files 
        propertyLabel = saveLabel(propertyLabel); // replace spaces with underscores for column names
        let propertyIri = store.getObjects(property.object, namedNode('http://www.w3.org/ns/shacl#path'))[0].value;
        let rangeIri = getObjectValueIfExists(store, property.object, namedNode('http://www.w3.org/ns/shacl#class'));
        let rangeDatatype = getObjectValueIfExists(store, property.object, namedNode('http://www.w3.org/ns/shacl#datatype'));
        let rangeMinCount = getObjectValueIfExists(store, property.object, namedNode('http://www.w3.org/ns/shacl#minCount'));
        let rangeMaxCount = getObjectValueIfExists(store, property.object, namedNode('http://www.w3.org/ns/shacl#maxCount'));
        wsColumns.push(propertyLabel);

        wsSchemaData.push([domainLabel, domainIri, propertyLabel, propertyIri, rangeIri, rangeDatatype, rangeMinCount, rangeMaxCount, null]);
    
        // Collect required fields
        if (rangeMinCount !== null && parseInt(rangeMinCount) >= 1) {
          requiredData[domainLabel].push(countColumns);
        }
        countColumns += 1;
      }
      // Create sheet data with headers in the first row
      const ws = wb.addWorksheet(domainLabel);
      // Add the headers
      ws.addRow(wsColumns);
    }
  }

  // Add foreign key sheet names
  for (const row of wsSchemaData.slice(1)) {
    const rangeIri = row[4];
    if (rangeIri !== 'http://www.w3.org/2004/02/skos/core#Concept'){
      row[8] = iriToLabelMap[rangeIri]; 
    }
  }

  // Append schema as last sheet 
  const schemaSheet = wb.addWorksheet('_schema');
  wsSchemaData.forEach(row => schemaSheet.addRow(row));

  //Format the the sheets
  wb.eachSheet(sheet => {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach(column => {
      column.width = 40; // Set a default column width
      column.alignment = { wrapText: true }; // Enable text wrapping
    });
    const headerRow = sheet.getRow(1);
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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
  wb.removeWorksheet('Sheet1'); // Remove default sheet 

  // Export to Excel file
  try {
    // Write the workbook to disk
    await wb.xlsx.writeFile(outputFile);
    // eslint-disable-next-line no-console
    console.log(`✅ EXCEL file written to ${outputFile}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`❌ Error writing Excel file: ${error.message}`);
    process.exit(1);
  }
}

// Helper function to get the value of an object for a given subject and predicate, or null if it doesn't exist
function getObjectValueIfExists(store, subject, predicate) {
  const objects = store.getObjects(subject, predicate);
  if (objects.length > 0) {
    return objects[0].value;
  } else {
    return null;
  }
}

function saveLabel(label) {
  return label
    // Replace spaces and special characters with underscores
    .replace(/[^a-zA-Z0-9]/g, '_')
    // Replace multiple consecutive underscores with a single one
    .replace(/_+/g, '_')
    // Ensure it starts with a letter (prepend 'n' if it doesn't)
    .replace(/^([^a-zA-Z])/, 'n$1')
    // Remove trailing underscores
    .replace(/_+$/, '');
}