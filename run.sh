#!/usr/bin/env bash
# Usage: find out by running:
#   ./run.sh -h

# Exit on error, undefined variable, or error in pipeline
set -euo pipefail
# Unmatched globs expand to nothing
shopt -s nullglob  

# Constants
in_dir="in"
out_dir="out"
yarrrml_file="$out_dir/all.yarrrml.yaml"
rml_file="$out_dir/all.rml.ttl"
queries_combined_file="$out_dir/queries/generated-queries.rq"
queries_split_dir="$out_dir/queries/generated-queries"
rdf_dir="$out_dir/serve-me"
rdf_file="$out_dir/serve-me/output.ttl"
miravi_main_dir="subprojects/miravi-a-linked-data-viewer/main"
miravi_initial_config_dir="miravi-initial-config"

# Default argument values
dataUrl="http://localhost:5500/output.ttl"
delimiter="|"
buildMiravi=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -u)
      dataUrl="$2"
      shift 2
      ;;
    -d)
      delimiter="$2"
      shift 2
      ;;
    -n|--noMiraviBuild)
      buildMiravi=false
      shift
      ;;
    -h|--help)
      echo "Usage: $0 -u <dataUrl> -d <delimiter> [-n | --noMiraviBuild]"
      echo "  <dataUrl>:     default='http://localhost:5500'"
      echo "  <delimiter>:   default='|'"
      echo "  noMiraviBuild: do not build Miravi and delete previous build"
      exit 1
      ;;
    -*)
      echo "Unknown option: $1"
      exit 1
      ;;
    *)
      echo "Unexpected argument: $1"
      exit 1
      ;;
  esac
done

rm -rf $out_dir

noInputFiles=false
inputs=("$in_dir"/*.xlsx)
if [ ${#inputs[@]} -eq 0 ]; then
  echo "❌ No input files found."
  noInputFiles=true
fi

if [[ "$noInputFiles" == false ]]; then
  for input in "$in_dir"/*.xlsx; do
    echo "ℹ️  Processing file: $input"
    node ./src/xlsx-to-csv.js  -i $input -o $out_dir -d $delimiter
    node ./src/xlsx-to-json.js -i $input -o $out_dir -d $delimiter -s
  done

  echo "ℹ️  Generating file: $yarrrml_file"
  node ./src/schema-to-yarrrml.js -g "$out_dir/*.schema.json" -o "$yarrrml_file"

  echo "ℹ️  Generating combined queries file $queries_combined_file and split queries in $queries_split_dir"
  node ./src/yarrrml-to-sparql.js -i "$yarrrml_file" -o "$queries_combined_file" -s "$queries_split_dir"

  echo "ℹ️  Generating file: $rml_file"
  npx @rmlio/yarrrml-parser -i "$yarrrml_file" -o "$rml_file" -p

  echo "ℹ️  Generating file: $rdf_file"
  mkdir -p $rdf_dir
  java -jar ./rmlmapper-7.3.3-r374-all.jar -m $rml_file -o $rdf_file -s turtle
else
  echo "ℹ️  Generating an empty $rdf_file."
  mkdir -p $rdf_dir
  echo "" > $rdf_file
fi

echo "ℹ️  Preparing Miravi configuration in $miravi_main_dir"
node ./src/prepare-miravi-config.js -i "$miravi_initial_config_dir" -s "$queries_split_dir" -o "$miravi_main_dir" -u "$dataUrl"

if [[ "$buildMiravi" == true ]]; then
  echo "ℹ️  Building Miravi in $miravi_main_dir into $miravi_main_dir/dist; see $miravi_main_dir/build.log for details..."
  (cd $miravi_main_dir && npm run build > build.log 2>&1)
else
  echo "ℹ️  Skipping Miravi build; deleting previous Miravi build..."
  rm -rf $miravi_main_dir/dist
fi