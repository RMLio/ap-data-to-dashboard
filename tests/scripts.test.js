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

  describe("1. shacl-to-template template JSON", () => {
    it("should generate template schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/shacl-to-template.js", "-i", join(assetsDir, "scripts1", "shacl.ttl"), "-o", outDir, "-d", 2], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts1", "template.schema.json"), join(outDir, "template.schema.json"));
    });
  });

  describe("2. shacl-to-template template XSLX", () => {
    it("should generate template XLSX", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/shacl-to-template.js", "-i", join(assetsDir, "scripts2", "shacl.ttl"), "-o", outDir, "-d", 2], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts2", "template.xlsx"), join(outDir, "template.xlsx"));
    });
  });
  
  describe("3. dataxlsx-to-datajson", () => {
    it("should generate data JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-datajson.js", "-i", join(assetsDir, "scripts6", "data1-no-custom-voc-sheet.xlsx"), "-o", outDir, "-d", "|"], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts6", "data1-no-custom-voc-sheet.json"), join(outDir, "data1-no-custom-voc-sheet.json"));
    });
  });

  //data2-custom-and-missing-voc.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("4. dataxlsx-to-enriched-schema", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enriched-schema.js", "-i", join(assetsDir, "scripts4", "data2-custom-and-missing-voc.xlsx"), "-o", outDir, "-s", join(assetsDir, "scripts4", "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts4", "data2-custom-and-missing-voc-enriched-schema.json"), join(outDir, "data2-custom-and-missing-voc-enriched-schema.json"));
    });
  });

  //data3-custom-voc-with-prefixes.xlsx in tests/assets is extended with custom vocabulary and prefixes
  describe("5. dataxlsx-to-enriched-schema-with-prefixes", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enriched-schema.js", "-i", join(assetsDir, "scripts5", "data3-custom-voc-with-prefixes.xlsx"), "-o", outDir, "-s", join(assetsDir, "scripts5", "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts5", "data3-custom-voc-with-prefixes-enriched-schema.json"), join(outDir, "data3-custom-voc-with-prefixes-enriched-schema.json"));
    });
  });

  //data1-no-custom-voc-sheet.xlsx in tests/assets has no _customVoc sheet
  describe("6. dataxlsx-to-enriched-schema from  XLSX without _customVoc sheet", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enriched-schema.js", "-i", join(assetsDir, "scripts6", "data1-no-custom-voc-sheet.xlsx"), "-o", outDir, "-s", join(assetsDir, "scripts6", "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts6", "data1-no-custom-voc-sheet-enriched-schema.json"), join(outDir, "data1-no-custom-voc-sheet-enriched-schema.json"));
    });
  });

  describe("7. schema-to-yarrrml starting from template schema JSON", () => {
    it("should generate YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "scripts7", "template.schema.json"), "-o", join(outDir, "data1-no-custom-voc-sheet.mapping.yml"), "-s", join(assetsDir, "scripts7", "data1-no-custom-voc-sheet.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts7", "data1-no-custom-voc-sheet.mapping.yml"), join(outDir, "data1-no-custom-voc-sheet.mapping.yml"));
    });
  });

  //data2-custom-and-missing-voc.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("8. schema-to-yarrrml starting from enriched schema JSON", () => {
    it("should generate YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "scripts8", "data2-custom-and-missing-voc-enriched-schema.json"), "-o", join(outDir, "data2-custom-and-missing-voc.mapping.yml"), "-s", join(assetsDir, "scripts8", "data2-custom-and-missing-voc-sheet.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts8", "data2-custom-and-missing-voc.mapping.yml"), join(outDir, "data2-custom-and-missing-voc.mapping.yml"));
    });
  })

  describe("9. merge-enriched-schemas", () => {
    it("should generate merged YARRRML", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/merge-enriched-schemas.js", "-i", join(assetsDir, "scripts9"), "-o", join(outDir, "mergedschema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts9", "mergedschema.json"), join(outDir, "mergedschema.json"));
    });
  })

  describe("10. schema-to-sparql starting from template schema JSON", () => {
    it("should generate queries", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "scripts10", "template.schema.json"), "-o", join(outDir, "generated-queries.rq"), "-s", join(outDir, "generated-queries")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts10", "generated-queries.rq"), join(outDir, "generated-queries.rq"));
      await compareDirectories(join(assetsDir, "scripts10", "generated-queries"), join(outDir, "generated-queries"));
    });
  })

  describe("11. schema-to-sparql from merged schema JSON", () => {
    it("should generate queries", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "scripts11", "mergedschema.json"), "-o", join(outDir, "generated-queries-merged.rq"), "-s", join(outDir, "generated-queries-merged")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts11", "generated-queries-merged.rq"), join(outDir, "generated-queries-merged.rq"));
      await compareDirectories(join(assetsDir, "scripts11", "generated-queries-merged"), join(outDir, "generated-queries-merged"));
    });
  })

  describe("12. prepare-miravi-config from config without custom tooling groups", () => {
    it("should generate miravi config JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/prepare-miravi-config.js",
          "-i", join(assetsDir, "scripts12", "miravi-initial-config"),
          "-s", join(assetsDir, "scripts12", "generated-queries-merged"),
          "-o", join(outDir, "miravi-config"),
          "-u", "http://localhost:5500/",
          "-d", join(assetsDir, "scripts12", "serve-me")
        ], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts12", "generated-miravi-config.json"), join(outDir, "miravi-config", "src", "config.json"));
    });
  })

  describe("13. prepare-miravi-config from config with custom tooling groups", () => {
    it("should generate miravi config JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/prepare-miravi-config.js",
          "-i", join(assetsDir, "scripts13", "miravi-initial-config-with-custom-tooling-groups"),
          "-s", join(assetsDir, "scripts13", "generated-queries-merged"),
          "-o", join(outDir, "miravi-config-with-custom-tooling-groups"),
          "-u", "http://localhost:5500/",
          "-d", join(assetsDir, "scripts13", "serve-me")
        ], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts13", "generated-miravi-config-with-custom-tooling-groups.json"), join(outDir, "miravi-config-with-custom-tooling-groups", "src", "config.json"));
    });
  });

  describe("14. dataxlsx-to-enriched-schema including default properties", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enriched-schema.js", "-i", join(assetsDir, "scripts14", "data.xlsx"), "-o", outDir, "-s", join(assetsDir, "scripts14", "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await compareFiles(join(assetsDir, "scripts14", "data-enriched-schema.json"), join(outDir, "data-enriched-schema.json"));
    });
  });

});
