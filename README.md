# README

## Purpose

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

To do as promised in [purpose](#purpose) above, execute:

```sh
./run.sh -u '<URL where the RDF output will be served>'
# example:
# ./run.sh -u 'https://www.example.com/output.ttl'
```

To do by you:

* Serve the RDF output in `out/serve-me/output.ttl` at `<URL where the RDF output will be served>`.
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
