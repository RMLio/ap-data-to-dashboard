# AP data to dashboard

- [Purpose](#purpose)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [Generate the template files from a SHACL shape](#generate-the-template-files-from-a-shacl-shape)
    - [Output](#output)
    - [Required SHACL structure](#required-shacl-structure)
  - [Produce input data using the template Excel workbook](#produce-input-data-using-the-template-excel-workbook)
  - [Optionally include additional data](#optionally-include-additional-data)
  - [Process the input data](#process-the-input-data)
  - [Add application-specific Miravi queries](#add-application-specific-miravi-queries)
  - [To do by you](#to-do-by-you)
- [Development](#development)
  - [Work locally](#work-locally)
  - [Testing](#testing)
- [Design Choices and Known Limitations](#design-choices-and-known-limitations)
- [Markdown linter](#markdown-linter)

## Purpose

- Generate a template Excel workbook `in-shacl/template.xslx`,
a template schema JSON file `in-shacl/template.schema.json`,
and 2 Excel workbooks with dummy data `in-shacl/dummydata-a1.xsls` and `in-shacl/dummydata-a2.xsls`
based on a SHACL shapes file in `in-shacl/shacl.ttl`.  
- Convert the input data in `in/*.xlsx` combined with schema data `in-shacl/template.schema.json` to RDF output in `out/serve-me/output.ttl`.

  Note that user intervention is required to go from above-mentioned Excel workbooks with dummy data to real data in `in/*.xlsx`.
  See [Produce input data using the template Excel workbook](#produce-input-data-using-the-template-excel-workbook)
  and also [Optionally include additional data](#optionally-include-additional-data) below.

- Generate a list of prepared queries in one file `out/queries/generated-queries.rq`.
- Split this one file into separate query files in dir `out/queries/generated-queries`.
- Build a Miravi instance using the initial configuration in `miravi-initial-config`,
  extended with queries for all the separated query files generated above,
  into `node_modules/miravi/main/dist`.

## Prerequisites

Make sure you have installed:

- A platform with a bash shell
- Node >= 22 with npm
- Java version 17, e.g. 17.0.10-tem

## Installation

1. Install dependencies via

   ```shell
   npm i  
   ```

2. Run setup via

   ```shell
   npm run setup
   ```

## Usage

### Generate the template files from a SHACL shape

To generate a template Excel workbook `in-shacl/template.xslx`,
a template schema JSON file `in-shacl/template.schema.json` and
2 Excel workbooks with dummy data `in-shacl/dummydata-a1.xsls` and `in-shacl/dummydata-a2.xsls`
based on a SHACL shapes file in `in-shacl/shacl.ttl`, execute the following steps:

1. Add a Turtle file with SHACL shapes called `shacl.ttl` to the directory `in-shacl`.
   You can use, for example,
   [this SHACL file](https://data.vlaanderen.be/doc/applicatieprofiel/leermiddelen/kandidaatstandaard/2025-08-01/shacl/leermiddelen-SHACL.ttl):

   ```shell
   curl -L "https://data.vlaanderen.be/doc/applicatieprofiel/leermiddelen/kandidaatstandaard/2025-08-01/shacl/leermiddelen-SHACL.ttl" -o in-shacl/shacl.ttl
   ```

2. Generate the aforementioned files via

   ```bash
   node src/shacl-to-template.js
   ```

#### Output

This script converts a SHACL shapes file into:

- An Excel workbook (`in-shacl/template.xlsx`) where:
  - Each **NodeShape** with at least one property becomes a worksheet.
  - Each **PropertyShape** becomes a column in the corresponding worksheet.
- A template schema JSON file `in-shacl/template.schema.json` to
  facilitate the automated generation of YARRRML mappings and SPARQL queries.
- Two Excel workbooks with dummy data `in-shacl/dummydata-a1.xsls` and `in-shacl/dummydata-a2.xsls`
  for testing and as guidance for the end users.

#### Required SHACL structure

The input SHACL file must include:

Per `shacl:NodeShape`:

- `rdfs:label` – used as the worksheet name
- `shacl:targetClass`
- `shacl:property`

Per `shac:PropertyShape`:

- `rdfs:label` – used as column headers
- `shacl:path`

Additionally, the script processes the following properties of a `PropertyShape` and adds them to the `_schema` sheet:

- `shacl:class`
- `shacl:datatype`
- `shacl:minCount`
- `shacl:maxCount`

If `shacl:minCount >= 1`,
the corresponding column header in the Excel sheet is bold and underlined,
indicating it is a required field.

The script records this information in `template.schema.json` sheet to facilitate
the automated generation of YARRRML mappings and SPARQL queries.

### Produce input data using the template Excel workbook

To produce input data:

1. **Copy and rename** the generated `in-shacl/template.xlsx` to a new working file and save it in the `in`-folder.
2. **Fill in all relevant tabs** with appropriate data entries.
3. Per sheet columns with a **bold and underlined header** are required.
   Other columns are optional.
4. When adding more than one value to a cell,
   use `|` as separator.
5. Ensure each row has a **CODE** (e.g. formatted as `<SheetName>_001`, `<SheetName>_002`, etc.).
6. Pay special attention to **foreign key columns**: these must reference existing codes from the linked sheets
   as defined under `valueForeignKeySheet` in `template.schema.json`.

Maintaining consistent and valid codes ensures referential integrity across the dataset.
Several actors can add their own input data in the `in`-folder.

Note: When using a SHACL shape from an OSLO application profile as input,
the diagram of that application profile visualizes the links between the sheets and mentions the expected datatype.

### Optionally include additional data

If you want to include additional data, not defined in the SHACL template, you can add extra sheets and/or columns.
Each sheet must contain exactly one `CODE` column.

**Example**: an additional sheet with name *Agent*.

| CODE   | name  | knows  | age |
|--------|-------|--------|-----|
| agent1 | Alice | agent2 | 25  |
| agent2 | Bob   | agent3 | 30  |

You may specify a custom vocabulary per sheets and sheet/columns combination in the sheet labeled `_customVoc`:

- `sheetClass`: the class per sheet,
- `columnProperty`: the property per column,
- `valueDatatype`: the datatype per value in the column,
- `valueClass`: the class per value in the column.

**Example**: the `_customVoc` sheet.

| sheetLabel | sheetClass                        | columnLabel | columnProperty                    | valueDatatype                              | valueClass                        |
|------------|-----------------------------------|-------------|-----------------------------------|--------------------------------------------|-----------------------------------|
| Agent      | <http://xmlns.com/foaf/0.1/Agent> | age         | <http://xmlns.com/foaf/0.1/age>   | <http://www.w3.org/2001/XMLSchema#integer> |                                   |
| Agent      | <http://xmlns.com/foaf/0.1/Agent> | knows       | <http://xmlns.com/foaf/0.1/knows> |                                            | <http://xmlns.com/foaf/0.1/Agent> |

Any additional sheets and columns without such specifications will be mapped to
 `http://missing.example.com/` + `sheetLabel` or `columnlabel`.
Unspecified values will be converted to string literals.
With the above examples as input, the column *name* will be mapped to property [http://missing.example.com/name](http://missing.example.com/name),
and the values *Alice* and *Bob* to literals with datatype [xsd:string](http://www.w3.org/2001/XMLSchema#integer).

The above examples would result in the following additional RDF data:

```turtle
@prefix ex: <http://example.com/> .
@prefix missing: <http://missing.example.com/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:agent1 a foaf:Agent; 
    missing:name "Alice": 
    foaf:knows ex:agent2;
    foaf:age "25"^^^xsd:integer.

ex:agent2 a foaf:Agent; 
    missing:name "Bob": 
    foaf:knows ex:agent3;
    foaf:age "30"^^^xsd:integer.

ex:agent3 a foaf:Agent.   
```

When executing the pipeline in strict mode, the additionals sheets and columns will be ignored.

### Process the input data

To process the input data `in/*.xlsx` as promised in [purpose](#purpose) above, execute:

```sh
./run.sh -u '<the base URL where the RDF output files will be served (include trailing slash)>'
# example:
# ./run.sh -u 'https://www.example.com/'
```

Add the option `-s` to process the input data in strict mode, ignoring custom vocabulary.

```sh
./run.sh -s -u '<the base URL where the RDF output files will be served (include trailing slash)>'
```

### Add application-specific Miravi queries

If you want to add application-specific queries to the Miravi instance, proceed as follows:

1. Extend the array `"queries"` in [miravi-initial-config/config.json)](miravi-initial-config/config.json).
   Note that you don't have to add a `"comunicaContext"`: `./run.sh` does that for you.
2. Add your corresponding SPARQL queries to
   [miravi-initial-config/public/queries/](miravi-initial-config/public/queries/).
3. Re-run the `run.sh` command explained in above [Process the input data](#process-the-input-data) section.

You can find further information on Miravi configuration
[in this repository](https://github.com/SolidLabResearch/miravi-a-linked-data-viewer).

### To do by you

1. Serve the RDF output in directory `out/serve-me` at `<base URL where the RDF output will be served>`.
2. Serve the Miravi build result in `node_modules/miravi/main/dist` at a URL of your choice.

## Development

### Work locally

Execute:

```sh
./run.sh
```

In a separate shell, host the RDF output on a web server:

```sh
npm run serve
```

In a separate shell, run the Miravi build result

```sh
npm run miravi
```

Visit Miravi at <http://localhost:5173>.

### Testing

Run:

```sh
npm run test
```

## Design Choices and Known Limitations

- OSLO SHACL shapes generated by Toolchain 4 should contain the expected information.
  Older OSLO SHACL shapes do not match the requirements.
- Information about subclasses and superclasses is not available in the SHACL shapes, and
  therefore not considered within this tool chain.  
- NodeShapes with `skos:Concept` as `shacl:targetClass` are not converted to sheets in `template.xlsx`.
  As there is no one-on-one relation between a label and an iri, this leads to strange query results.
- All values with datatype `rdf:langString` are converted to RDF with language code `@nl`.
- Adding more than one data EXCEL file to the `in`-folder may impact the query processing time as
  the default queries contain several `OPTIONAL`s.
- The last row per sheet of the generated dummy data contains multiple values per cell
  when the `maxCount` for that property in the SHACL shape is not equal to 1.

## Markdown linter

You can run the Markdown linter via

```shell
npm run lint:markdown
```

If you want the tool to automatically try to fix issues, execute

```shell
npm run lint:markdown:fix
```
