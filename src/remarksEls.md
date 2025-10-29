## shacl
- only works on the new shacl file of data.vlaanderen
- difference shacl:name and rdfs:label? in older shacl files not available
  
## YARRRML
- http://www.w3.org/2000/01/rdf-schema#Literal   as datatype? 
- base not working in YARRRML
- any iri as datatype?   

## SPARQL
- Skos:concept with properties leads to strange query results. See Doelgroep query

## MIRAVI 
very slow for long queries in combination with multiple sources due to many optionals


## DESIGN CHOICES: 
- We made all langStrings @nl
- Every cell in the excel is treated as an array
- Every code that is not an IRI, will be concatenated with the base IRI


## USEFUL INFO FROM EAP OR ONTOLOGY
- is subclass of > to add the additional class during mapping (to be in line with the range of some shacl shapes), and to add properties of the superclass to the sheet of the subclass? 
- Labels of skos:Concept as range of a property > as skos:Concept comes with many labels, we cannot know this from the shape, where for other classes we deduct it, if in the shape and no duplicates, could be used in join queries ... not sure if really useful without other properties ...

## TODO
- skos-concept solution
