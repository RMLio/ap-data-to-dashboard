import { describe, it, expect, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { readFileSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { readFile, utils } from "xlsx";
import yaml from 'js-yaml';

const assetsDir = join(process.cwd(), "tests/assets/");
const outDir = join(process.cwd(), "./tests/out/");

function getJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getYaml(filePath) {
  const yamlContent = readFileSync(filePath, "utf8");
  return yaml.load(yamlContent);
}

function getExcelAsJson(filePath) {
  const workBook = readFile(filePath);
  const result = {};
  workBook.SheetNames.forEach(sheetName => {
    const sheet = workBook.Sheets[sheetName];
    result[sheetName] = utils.sheet_to_json(sheet, { defval: null }); // defval ensures empty cells are preserved
  });
  return result;
}

function emptyOutDir() {

  try {
    // ensure outDir exists
    mkdirSync(outDir, { recursive: true });

    // remove everything except .gitkeep
    const entries = readdirSync(outDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".gitkeep") continue;
      const p = join(outDir, entry.name);
      if (entry.isDirectory()) {
        rmSync(p, { recursive: true, force: true });
      } else {
        rmSync(p, { force: true });
      }
    }
  } catch (err) {
    // ignore errors

  }
}

describe("Test scripts included in run.sh", () => {

  afterEach(() => {
    emptyOutDir();
  });

  describe("shacl-to-template template JSON", () => {
    it("should generate template schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/shacl-to-template.js", "-i", join(assetsDir, "shacl.ttl"), "-o", outDir, "-d", 2], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const output = getJson(join(outDir, "template.schema.json"));
      const expectedOutput = getJson(join(assetsDir, "template.schema.json"));
      expect(output).toEqual(expectedOutput);
    });
  });

  describe("template-to-template template XSLX", () => {
    it("should generate template XLSX", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/shacl-to-template.js", "-i", join(assetsDir, "shacl.ttl"), "-o", outDir, "-d", 2], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const outputFile = getExcelAsJson(join(outDir, "template.xlsx"));
      const expectedFile = getExcelAsJson(join(assetsDir, "template.xlsx"));
      expect(outputFile).toEqual(expectedFile);
    });

  });

  describe("dataxlsx-to-datajson", () => {
    it("should generate data JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-datajson.js", "-i", join(assetsDir, "dummydata-a1.xlsx"), "-o", outDir, "-d", "|"], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const output = getJson(join(outDir, "dummydata-a1.json"));
      const expectedOutput = getJson(join(assetsDir, "dummydata-a1.json"));

      expect(output).toEqual(expectedOutput);
    });
  });

  //dummydata-a2.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("dataxlsx-to-enrichedschema", () => {
    it("should generate enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/dataxlsx-to-enrichedschema.js", "-i", join(assetsDir, "dummydata-a2.xlsx"), "-o", outDir, "-s", join(assetsDir, "template.schema.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const output = getJson(join(outDir, "dummydata-a2-enrichedschema.json"));
      const expectedOutput = getJson(join(assetsDir, "dummydata-a2-enrichedschema.json"));
      expect(output).toEqual(expectedOutput);
    });
  });

  describe("schema-to-yarrrml", () => {
    it("should generate YARRRML starting from template schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "template.schema.json"), "-o", join(outDir, "dummydata-a1.mapping.yml"), "-s", join(assetsDir, "dummydata-a1.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const output = getYaml(join(outDir, "dummydata-a1.mapping.yml"));
      const expectedOutput = getYaml(join(assetsDir, "dummydata-a1.mapping.yml"));
      expect(output).toEqual(expectedOutput);
    });
  });

  //dummydata-a2.xlsx in tests/assets is extended with custom and missing vocabulary
  describe("schema-to-yarrrml enriched", () => {
    it("should generate YARRRML starting from enriched schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-yarrrml.js", "-i", join(assetsDir, "dummydata-a2-enrichedschema.json"), "-o", join(outDir, "dummydata-a2.mapping.yml"), "-s", join(assetsDir, "dummydata-a1.json")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      const output = getYaml(join(outDir, "dummydata-a2.mapping.yml"));
      const expectedOutput = getYaml(join(assetsDir, "dummydata-a2.mapping.yml"));
      expect(output).toEqual(expectedOutput);
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
      const output = getJson(join(outDir, "mergedschema.json"));
      const expectedOutput = getJson(join(assetsDir, "mergedschema.json"));
      expect(output).toEqual(expectedOutput);
    });
  })

  describe("schema-to-sparql", () => {
    it("should generate queries from template schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "template.schema.json"), 
          "-o", join(outDir, "generated-queries.rq"), "-s", join(outDir, "generated-queries")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      // comparing only the merged queries file
      const output = readFileSync(join(outDir, "generated-queries.rq"));
      const expectedOutput = readFileSync(join(assetsDir, "generated-queries.rq"));
      expect(output).toEqual(expectedOutput);
    });
  })

  describe("schema-to-sparql merged", () => {
    it("should generate queries from merged schema JSON", async () => {
      await new Promise((resolve, reject) => {
        execFile("node", ["./src/schema-to-sparql.js", "-i", join(assetsDir, "mergedschema.json"), 
          "-o", join(outDir, "generated-queries-merged.rq"), "-s", join(outDir, "generated-queries")], (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      // comparing only the merged queries file
      const output = readFileSync(join(outDir, "generated-queries-merged.rq"));
      const expectedOutput = readFileSync(join(assetsDir, "generated-queries-merged.rq"));
      expect(output).toEqual(expectedOutput);
    });
  })
});
