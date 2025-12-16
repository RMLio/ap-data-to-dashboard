
// used in shacl-to-template.js
const prefixesSheet = [
    ["prefix", "uri"],
    ["rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#"],
    ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
    ["xsd", "http://www.w3.org/2001/XMLSchema#"],
    ["skos", "http://www.w3.org/2004/02/skos/core#"]
];

//used in shacl-to-template.js
// No min and max count for the custom voc
const customVocSheet = [
    ["sheetLabel", "sheetClass", "columnLabel", "columnProperty", "valueDatatype", "valueClass"],
    [null, null, "parentCode", "skos:broader", null, "skos:Concept"],
    [null, null, "relatedCode", "skos:related", null, "skos:Concept"],
    [null, null, "prefLabel", "skos:prefLabel", "rdf:langString", null],
    [null, null, "altLabel", "skos:altLabel", "rdf:langString", null],
    [null, null, "definition", "skos:definition", "rdf:langString", null],
    [null, null, "name", "dcterms:title", "rdf:langString", null],
    [null, null, "label", "rdfs:label", "rdf:langString", null],
]

// used in schema-to-sparql.js
const skosConceptSheet = {
    "sheetLabel": "SkosConcept",
    "sheetClass": "http://www.w3.org/2004/02/skos/core#Concept",
    "columns": {
        "prefLabel": {
            "columnLabel": "prefLabel",
            "columnProperty": "http://www.w3.org/2004/02/skos/core#prefLabel",
            "valueDatatype": "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
            "valueClass": null,
            "valueMinCount": null,
            "valueMaxCount": null
        },
        "definition": {
            "columnLabel": "definition",
            "columnProperty": "http://www.w3.org/2004/02/skos/core#definition",
            "valueDatatype": "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
            "valueClass": null,
            "valueMinCount": null,
            "valueMaxCount": null
        },
        "altLabel": {
            "columnLabel": "altLabel",
            "columnProperty": "http://www.w3.org/2004/02/skos/core#altLabel",
            "valueDatatype": "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
            "valueClass": null,
            "valueMinCount": null,
            "valueMaxCount": null
        },
        "parentCode": {
            "columnLabel": "parentCode",
            "columnProperty": "http://www.w3.org/2004/02/skos/core#broader",
            "valueDatatype": null,
            "valueClass": "http://www.w3.org/2004/02/skos/core#Concept",
            "valueMinCount": null,
            "valueMaxCount": null
        },
        "relatedCode": {
            "columnLabel": "relatedCode",
            "columnProperty": "http://www.w3.org/2004/02/skos/core#related",
            "valueDatatype": null,
            "valueClass": "http://www.w3.org/2004/02/skos/core#Concept",
            "valueMinCount": null,
            "valueMaxCount": null
        }
    }
}

module.exports = { prefixesSheet: prefixesSheet, customVocSheet: customVocSheet, skosConceptSheet: skosConceptSheet };