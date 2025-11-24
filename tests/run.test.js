import { describe, it } from "vitest";
import { execFile } from "node:child_process";
import { join, sep } from "node:path";
import { emptyDirSync, copySync } from "fs-extra";
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
    await compareDirectories(integrationRefDir, integrationActualDir, { exclude: ["in-shaccl/*", "in/*"] });
  }, 120000 /* this test takes 48s on my laptop, so setting timeout to 120s */);
});

