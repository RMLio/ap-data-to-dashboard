import { describe, it, beforeEach } from "vitest";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { emptyDirSync } from "fs-extra";
import { compareJsonFiles, compareTxtFiles, compareXlsxFiles, compareYamlFiles, compareDirectories } from "./compareUtilities.js";

const assetsDir = join("tests", "assets");
const outDir = join("tests", "out");

describe("Testing js scripts", () => {

  this.hookTimeout = 20000;

  beforeEach(() => {
    emptyDirSync(outDir);
  });

  describe("shacl-to-template template JSON", () => {
    it("should generate template schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/shacl-to-template.js", "-i", join(assetsDir, "shacl.ttl"), "-o", outDir, "-d", 2], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareJsonFiles(join(assetsDir, "template.schema.json"), join(outDir, "template.schema.json"));
    });
  });

  describe("shacl-to-template template XSLX", () => {
    it("should generate template XLSX", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/shacl-to-template.js", "-i", join(assetsDir, "shacl.ttl"), "-o", outDir, "-d", 2], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareXlsxFiles(join(assetsDir, "template.xlsx"), join(outDir, "template.xlsx"));
    });

  });

  describe("dataxlsx-to-datajson", () => {
    it("should generate data JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-datajson.js", "-i", join(assetsDir, "data1-nocustomvocsheet.xlsx"), "-o", outDir, "-d", "|"], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareJsonFiles(join(assetsDir, "data1-nocustomvocsheet.json"), join(outDir, "data1-nocustomvocsheet.json"));
    });
  });

  //data2-customandmissingvoc.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("dataxlsx-to-enrichedschema", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enrichedschema.js", "-i", join(assetsDir, "data2-customandmissingvoc.xlsx"), "-o", outDir, "-s", join(assetsDir, "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareJsonFiles(join(assetsDir, "data2-customandmissingvoc-enrichedschema.json"), join(outDir, "data2-customandmissingvoc-enrichedschema.json"));
    });
  });

  //data1-nocustomvocsheet.xlsx in tests/assets has no _customVoc sheet
  describe("dataxlsx-to-enrichedschema from  XLSX without _customVoc sheet", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enrichedschema.js", "-i", join(assetsDir, "data1-nocustomvocsheet.xlsx"), "-o", outDir, "-s", join(assetsDir, "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareJsonFiles(join(assetsDir, "data1-nocustomvocsheet-enrichedschema.json"), join(outDir, "data1-nocustomvocsheet-enrichedschema.json"));
    });
  });

  describe("schema-to-yarrrml starting from template schema JSON", () => {
    it("should generate YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "template.schema.json"), "-o", join(outDir, "data1-nocustomvocsheet.mapping.yml"), "-s", join(assetsDir, "data1-nocustomvocsheet.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareYamlFiles(join(assetsDir, "data1-nocustomvocsheet.mapping.yml"), join(outDir, "data1-nocustomvocsheet.mapping.yml"));
    });
  });

  //data2-customandmissingvoc.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("schema-to-yarrrml starting from enriched schema JSON", () => {
    it("should generate YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "data2-customandmissingvoc-enrichedschema.json"), "-o", join(outDir, "data2-customandmissingvoc.mapping.yml"), "-s", join(assetsDir, "data1-nocustomvocsheet.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareYamlFiles(join(assetsDir, "data2-customandmissingvoc.mapping.yml"), join(outDir, "data2-customandmissingvoc.mapping.yml"));
    });
  })

  describe("merge-enrichedschemas", () => {
    it("should generate merged YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/merge-enrichedschemas.js", "-i", join(assetsDir), "-o", join(outDir, "mergedschema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareJsonFiles(join(assetsDir, "mergedschema.json"), join(outDir, "mergedschema.json"));
    });
  })

  describe("schema-to-sparql starting from template schema JSON", () => {
    it("should generate queries", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "template.schema.json"),
          "-o", join(outDir, "generated-queries.rq"), "-s", join(outDir, "generated-queries")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareTxtFiles(join(assetsDir, "generated-queries.rq"), join(outDir, "generated-queries.rq"));
      await compareDirectories(join(assetsDir, "generated-queries"), join(outDir, "generated-queries"));
    });
  })

  describe("schema-to-sparql from merged schema JSON", () => {
    it("should generate queries", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "mergedschema.json"),
          "-o", join(outDir, "generated-queries-merged.rq"), "-s", join(outDir, "generated-queries-merged")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareTxtFiles(join(assetsDir, "generated-queries-merged.rq"), join(outDir, "generated-queries-merged.rq"));
      await compareDirectories(join(assetsDir, "generated-queries-merged"), join(outDir, "generated-queries-merged"));
    });
  })
});
