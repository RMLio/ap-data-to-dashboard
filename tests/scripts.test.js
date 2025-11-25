import { describe, it, beforeEach } from "vitest";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { emptyDirSync } from "fs-extra";
import { compareFiles, compareDirectories } from "./compare-utilities.js";

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
      await compareFiles(join(assetsDir, "template.schema.json"), join(outDir, "template.schema.json"));
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
      await compareFiles(join(assetsDir, "template.xlsx"), join(outDir, "template.xlsx"));
    });

  });

  describe("dataxlsx-to-datajson", () => {
    it("should generate data JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-datajson.js", "-i", join(assetsDir, "data1-no-custom-voc-sheet.xlsx"), "-o", outDir, "-d", "|"], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "data1-no-custom-voc-sheet.json"), join(outDir, "data1-no-custom-voc-sheet.json"));
    });
  });

  //data2-custom-and-missing-voc.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("dataxlsx-to-enriched-schema", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enriched-schema.js", "-i", join(assetsDir, "data2-custom-and-missing-voc.xlsx"), "-o", outDir, "-s", join(assetsDir, "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "data2-custom-and-missing-voc-enriched-schema.json"), join(outDir, "data2-custom-and-missing-voc-enriched-schema.json"));
    });
  });

  //data1-no-custom-voc-sheet.xlsx in tests/assets has no _customVoc sheet
  describe("dataxlsx-to-enriched-schema from  XLSX without _customVoc sheet", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enriched-schema.js", "-i", join(assetsDir, "data1-no-custom-voc-sheet.xlsx"), "-o", outDir, "-s", join(assetsDir, "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "data1-no-custom-voc-sheet-enriched-schema.json"), join(outDir, "data1-no-custom-voc-sheet-enriched-schema.json"));
    });
  });

  describe("schema-to-yarrrml starting from template schema JSON", () => {
    it("should generate YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "template.schema.json"), "-o", join(outDir, "data1-no-custom-voc-sheet.mapping.yml"), "-s", join(assetsDir, "data1-no-custom-voc-sheet.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "data1-no-custom-voc-sheet.mapping.yml"), join(outDir, "data1-no-custom-voc-sheet.mapping.yml"));
    });
  });

  //data2-custom-and-missing-voc.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("schema-to-yarrrml starting from enriched schema JSON", () => {
    it("should generate YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "data2-custom-and-missing-voc-enriched-schema.json"), "-o", join(outDir, "data2-custom-and-missing-voc.mapping.yml"), "-s", join(assetsDir, "data1-no-custom-voc-sheet.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "data2-custom-and-missing-voc.mapping.yml"), join(outDir, "data2-custom-and-missing-voc.mapping.yml"));
    });
  })

  describe("merge-enriched-schemas", () => {
    it("should generate merged YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/merge-enriched-schemas.js", "-i", join(assetsDir), "-o", join(outDir, "mergedschema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "mergedschema.json"), join(outDir, "mergedschema.json"));
    });
  })

  describe("schema-to-sparql starting from template schema JSON", () => {
    it("should generate queries", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "template.schema.json"), "-o", join(outDir, "generated-queries.rq"), "-s", join(outDir, "generated-queries")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "generated-queries.rq"), join(outDir, "generated-queries.rq"));
      await compareDirectories(join(assetsDir, "generated-queries"), join(outDir, "generated-queries"));
    });
  })

  describe("schema-to-sparql from merged schema JSON", () => {
    it("should generate queries", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "mergedschema.json"), "-o", join(outDir, "generated-queries-merged.rq"), "-s", join(outDir, "generated-queries-merged")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "generated-queries-merged.rq"), join(outDir, "generated-queries-merged.rq"));
      await compareDirectories(join(assetsDir, "generated-queries-merged"), join(outDir, "generated-queries-merged"));
    });
  })

  describe("prepare-miravi-config from config without custom tooling groups", () => {
    it.skip("should generate miravi config", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/prepare-miravi-config.js",
          "-i", join(assetsDir, "miravi-initial-config"),
          "-s", join(assetsDir, "generated-queries-merged"),
          "-o", join(outDir, "miravi-config"),
          "-u", "http://localhost:5500/",
          "-d", join(assetsDir, "serve-me")
        ], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "generated-miravi-config.json"), join(outDir, "miravi-config", "src", "config.json"));
    });
  })

  describe("prepare-miravi-config from config with custom tooling groups", () => {
    it.skip("should generate miravi config", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/prepare-miravi-config.js",
          "-i", join(assetsDir, "miravi-initial-config-with-custom-tooling-groups"),
          "-s", join(assetsDir, "generated-queries-merged"),
          "-o", join(outDir, "miravi-config-with-custom-tooling-groups"),
          "-u", "http://localhost:5500/",
          "-d", join(assetsDir, "serve-me")
        ], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "generated-miravi-config-with-custom-tooling-groups.json"), join(outDir, "miravi-config-with-custom-tooling-groups", "src", "config.json"));
    });
  })

});
