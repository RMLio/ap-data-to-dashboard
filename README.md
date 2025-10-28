# README

## Purpose

* Generate a template Excel workbook `in-shacl/template.xslx` based on a SHACL shapes file in `in-shacl/shacl.ttl`.  
* Convert the input data in `in/*.xlsx` to RDF output in `out/serve-me/output.ttl`.
* Generate a list of prepared queries in one file `out/queries/generated-queries.rq`.
* Split this one file into separate query files in dir `out/queries/generated-queries`.
* Build a Miravi instance using the initial configuration in `miravi-initial-config`,
  extended with queries for all the separated query files generated above,
  into `subprojects/miravi-a-linked-data-viewer/main/dist`.

## Prerequisites

Make sure you have installed:

* A Linux platform with a bash shell
* Node >= 22 with npm
* Java version 17, e.g. 17.0.10-tem

## Installation

```sh
# make node_modules/
npm i
npm run setup
# make a Miravi clone in subprojects/miravi-a-linked-data-viewer/ (-b selects the Miravi version)
rm -rf subprojects && mkdir subprojects && pushd subprojects
git clone -b v2.1.1 https://github.com/SolidLabResearch/miravi-a-linked-data-viewer.git
(cd miravi-a-linked-data-viewer/main && npm i)
popd
```

## Usage

### Generate the template Excel workbook from a SHACL shape

To generate the template Excel workbook `in-shacl/template.xslx` based on the SHACL shapes file in `in-shacl/shacl.ttl`, execute:

```bash
node src/shacl-to-xlsx.js
```

#### Output

This script converts a SHACL shapes file into an Excel workbook (`in-shacl/template.xlsx`) where:

* Each **NodeShape** with at least one property becomes a worksheet. 
* Each **PropertyShape** becomes a column in the corresponding worksheet.
* A `_schema` sheet is added to support YARRRML mappings and SPARQL query generation.

#### Required SHACL structure

The input SHACL file must include:

Per `shacl:NodeShape`:

* `rdfs:label` – used as the worksheet name
* `shacl:targetClass`
* `shacl:property`

Per `shac:PropertyShape`:

* `rdfs:label` – used as column headers
* `shacl:path`

Additionally, the following properties of `PropertyShape`s are processed and added to the `_schema` sheet:

* `shacl:class`
* `shacl:datatype`
* `shacl:minCount`
* `shacl:maxCount`

If `shacl:minCount >= 1`, the corresponding column header in the Excel sheet is **bold and underlined**, indicating it is a required field.

This information is also recorded in the `_schema sheet` to facilitate the automated generation of YARRRML mappings and SPARQL queries.

### Produce input data Using the template Excel workbook

To produce input data:

1. **Copy and rename** the generated `in-shacl/template.xlsx` to a new working file and save it in the `in`-folder.
2. **Fill in all relevant tabs** with appropriate data entries.
3. Ensure each row has a **code** (e.g. formatted as `<SheetName>_001`, `<SheetName>_002`, etc.).
4. Pay special attention to **foreign key columns**: these must reference existing codes from the linked sheets as defined in the `_schema` and foreign key overview.

Maintaining consistent and valid codes ensures referential integrity across the dataset.

Several actors can add their own input data in the `in`-folder.

### Process the input data

To process the input data `in/*.xlsx` as promised in [purpose](#purpose) above, execute:

```sh
./run.sh -u '<the base URL where the RDF output files will be served (include trailing slash)>'
# example:
# ./run.sh -u 'https://www.example.com/'
```

To do by you:

* Serve the RDF output in directory `out/serve-me` at `<base URL where the RDF output will be served>`.
* Serve the Miravi build result in `subprojects/miravi-a-linked-data-viewer/main/dist` at a URL of your choice.

## Development

### Work locally

Execute:

```sh
./run.sh --noMiraviBuild
```

In a separate shell, host the RDF output on a web server:

```sh
npm run serve
```

In a separate shell, run Miravi in development mode

```sh
npm run miravi
```

Visit Miravi at <http://localhost:5173>.
