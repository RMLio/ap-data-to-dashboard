import { describe, it } from "vitest";
import { execFile } from "node:child_process";
import { join, sep } from "node:path";
import { emptyDirSync, copySync, pathExistsSync } from "fs-extra";
import { compareDirectories } from "./compare-utilities.js";

const assetsDir = join("tests", "assets");
const outDir = join("tests", "out");

describe("Testing run.sh -n", () => {

  it("should generate final outputs as expected", async () => {
    const integrationRefDir = join(assetsDir, "integration");
    const integrationActualDir = join(outDir, "integration");
    const integrationActualDirInSacl = join(integrationActualDir, "in-shacl");
    const integrationActualDirIn = join(integrationActualDir, "in");
    const integrationActualDirOut = join(integrationActualDir, "out");
    const integrationActualDirMiravi = join(integrationActualDir, "node_modules", "miravi", "main");

    emptyDirSync(integrationActualDirInSacl);
    copySync(join(integrationRefDir, "in-shacl", "template.schema.json"), join(integrationActualDirInSacl, "template.schema.json"));

    emptyDirSync(integrationActualDirIn);
    copySync(join(integrationRefDir, "in", "data2-custom-and-missing-voc.xlsx"), join(integrationActualDirIn, "data2-custom-and-missing-voc.xlsx"));

    emptyDirSync(integrationActualDirOut);

    emptyDirSync(integrationActualDirMiravi);
    copySync(join("node_modules", "miravi", "main"), integrationActualDirMiravi);

    await new Promise((resolve, reject) => {
      execFile("./run.sh", ["-u", "https://www.example.com/", "-p", integrationActualDir + sep, "-n"], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await compareDirectories(integrationRefDir, integrationActualDir, { exclude: ["in-shacl/*", "in/*"] });
  }, 120000 /* this test takes 48s on my laptop, so setting timeout to 120s */);

  it("should process XLSX files with spaces in the filename", async () => {
    const integrationRefDir = join(assetsDir, "integration");
    const integrationActualDir = join(outDir, "integration-spaces");
    const integrationActualDirInSacl = join(integrationActualDir, "in-shacl");
    const integrationActualDirIn = join(integrationActualDir, "in");
    const integrationActualDirOut = join(integrationActualDir, "out");
    const integrationActualDirMiravi = join(integrationActualDir, "node_modules", "miravi", "main");
    const spacedBaseName = "data 2 custom and missing voc";

    emptyDirSync(integrationActualDirInSacl);
    copySync(join(integrationRefDir, "in-shacl", "template.schema.json"), join(integrationActualDirInSacl, "template.schema.json"));

    emptyDirSync(integrationActualDirIn);
    copySync(
      join(integrationRefDir, "in", "data2-custom-and-missing-voc.xlsx"),
      join(integrationActualDirIn, `${spacedBaseName}.xlsx`)
    );

    emptyDirSync(integrationActualDirOut);

    emptyDirSync(integrationActualDirMiravi);
    copySync(join("node_modules", "miravi", "main"), integrationActualDirMiravi);

    await new Promise((resolve, reject) => {
      execFile("./run.sh", ["-u", "https://www.example.com/", "-p", integrationActualDir + sep, "-n"], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const expectedFiles = [
      {
        path: join(integrationActualDirOut, `${spacedBaseName}.json`),
        errorMessage: "Expected data JSON for spaced filename was not generated",
      },
      {
        path: join(integrationActualDirOut, `${spacedBaseName}.mapping.yml`),
        errorMessage: "Expected YARRRML mapping for spaced filename was not generated",
      },
      {
        path: join(integrationActualDirOut, `${spacedBaseName}.mapping.rml.ttl`),
        errorMessage: "Expected RML mapping for spaced filename was not generated",
      },
      {
        path: join(integrationActualDirOut, "serve-me", `${spacedBaseName}.ttl`),
        errorMessage: "Expected RDF output for spaced filename was not generated",
      },
      {
        path: join(integrationActualDirOut, "queries", "generated-queries.rq"),
        errorMessage: "Expected combined queries file was not generated",
      },
    ];

    for (const { path, errorMessage } of expectedFiles) {
      if (!pathExistsSync(path)) {
        throw new Error(errorMessage);
      }
    }
  }, 120000);
});
