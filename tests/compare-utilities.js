// Code generated (partly) by chatGPT based on my cautious instructions...
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { Parser } from "n3";
import * as rdfIsomorphic from "rdf-isomorphic";
import { minimatch } from "minimatch";
import { expect } from "vitest";
import yaml from 'js-yaml';
import { readFile, utils } from "xlsx";

/* ------------------------------------------------------------------
 * Exclude matching (gitignore-style)
 * ------------------------------------------------------------------*/
function isExcluded(relPath, patterns = []) {
  if (!patterns || patterns.length === 0) return false;
  const p = relPath.split("\\").join("/");
  let excluded = false;
  for (const pattern of patterns) {
    if (!pattern) continue;
    if (pattern.startsWith("!")) {
      const positive = pattern.slice(1);
      if (minimatch(p, positive, { dot: true })) {
        excluded = false;
      }
    } else {
      if (minimatch(p, pattern, { dot: true })) {
        excluded = true;
      }
    }
  }
  return excluded;
}

/* ------------------------------------------------------------------
 * Recursive walk with exclusion rules
 * ------------------------------------------------------------------*/
function walk(dir, root = dir, out = [], opts = {}) {
  const { exclude = [] } = opts;
  const rel = (p) => relative(root, p).split("\\").join("/");

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const relPath = rel(full);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (isExcluded(relPath + "/", exclude) || isExcluded(relPath, exclude)) {
        continue;
      }
      walk(full, root, out, opts);
      continue;
    }

    if (!isExcluded(relPath, exclude)) {
      out.push(relPath);
    }
  }

  return out;
}

/* ------------------------------------------------------------------
 * Turtle parsing + normalization helpers
 * ------------------------------------------------------------------*/
export function parseTurtleToQuads(turtleText) {
  const parser = new Parser();
  const quads = [];
  parser.parse(turtleText, (error, quad) => {
    if (error) throw error;
    if (quad) quads.push(quad);
  });
  return quads;
}

function quadToNTripleString(q) {
  const termToString = (t) => {
    if (!t) return "";
    if (t.termType === "NamedNode") return `<${t.value}>`;
    if (t.termType === "BlankNode") return `_:${t.value}`;
    if (t.termType === "Literal") {
      const escaped = t.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const lang = t.language ? `@${t.language}` : "";
      const dt =
        t.datatype &&
          t.datatype.value &&
          t.datatype.value !== "http://www.w3.org/2001/XMLSchema#string"
          ? `^^<${t.datatype.value}>`
          : "";
      return `"${escaped}"${lang}${dt}`;
    }
    return String(t.value);
  };
  return `${termToString(q.subject)} ${termToString(q.predicate)} ${termToString(q.object)} .`;
}

function normalizeBlankNodesInStrings(strings) {
  const map = new Map();
  let id = 1;
  return strings.map((line) =>
    line.replace(/_:([A-Za-z0-9]+)/g, (m, bn) => {
      if (!map.has(bn)) map.set(bn, `g${id++}`);
      return `_:${map.get(bn)}`;
    })
  );
}

export function normalizedNTriplesLinesFromTurtleText(turtleText) {
  const quads = parseTurtleToQuads(turtleText);
  const lines = quads.map(quadToNTripleString);
  return normalizeBlankNodesInStrings(lines).sort();
}

/* ------------------------------------------------------------------
 * Fallback diff helper
 * ------------------------------------------------------------------*/
export function diffTurtleFallback(quadsA, quadsB) {
  const ntA = normalizeBlankNodesInStrings(quadsA.map(quadToNTripleString)).sort();
  const ntB = normalizeBlankNodesInStrings(quadsB.map(quadToNTripleString)).sort();
  return { joinedA: ntA.join("\n"), joinedB: ntB.join("\n"), listA: ntA, listB: ntB };
}

/* ------------------------------------------------------------------
 * Unified diff generator (LCS-backed)
 * ------------------------------------------------------------------*/
function buildLcsTable(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; --i) {
    for (let j = m - 1; j >= 0; --j) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

function generateEditsFromLcs(a, b, dp) {
  const edits = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      edits.push({ type: "context", line: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      edits.push({ type: "remove", line: a[i] });
      i++;
    } else {
      edits.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < a.length) edits.push({ type: "remove", line: a[i++] });
  while (j < b.length) edits.push({ type: "add", line: b[j++] });
  return edits;
}

export function generateUnifiedDiffFromLineLists(listA, listB, fileA = "ref", fileB = "actual", context = 3) {
  const dp = buildLcsTable(listA, listB);
  const edits = generateEditsFromLcs(listA, listB, dp);

  // find hunks (indices into edits)
  const hunks = [];
  let idx = 0;
  while (idx < edits.length) {
    while (idx < edits.length && edits[idx].type === "context") idx++;
    if (idx >= edits.length) break;

    let changeStart = idx;
    let changeEnd = idx;
    while (changeEnd < edits.length) {
      let look = changeEnd;
      let contextRun = 0;
      while (look < edits.length && edits[look].type === "context" && contextRun <= context) {
        contextRun++;
        look++;
      }
      if (contextRun > context) break;
      changeEnd++;
    }

    const preContextStart = Math.max(0, changeStart - context);
    const postContextEnd = Math.min(edits.length - 1, changeEnd + context - 1);

    hunks.push({ start: preContextStart, end: postContextEnd });
    idx = changeEnd;
  }

  if (hunks.length === 0) return "";

  const header = `--- ${fileA}\n+++ ${fileB}\n`;
  const hunkTexts = hunks.map((h) => {
    let aStart = 1, bStart = 1;
    for (let k = 0; k < h.start; ++k) {
      if (edits[k].type === "context") { aStart++; bStart++; }
      else if (edits[k].type === "remove") { aStart++; }
      else { bStart++; }
    }
    let aCount = 0, bCount = 0;
    const lines = [];
    for (let k = h.start; k <= h.end && k < edits.length; ++k) {
      const e = edits[k];
      if (e.type === "context") { lines.push(" " + e.line); aCount++; bCount++; }
      else if (e.type === "remove") { lines.push("-" + e.line); aCount++; }
      else { lines.push("+" + e.line); bCount++; }
    }
    const aRange = `${aStart},${aCount}`;
    const bRange = `${bStart},${bCount}`;
    const hunkHeader = `@@ -${aRange} +${bRange} @@\n`;
    return hunkHeader + lines.join("\n");
  }).join("\n\n");

  return header + hunkTexts + "\n";
}

/** Compare JSON files by deep-equality (throws on mismatch) */
function compareJsonFiles(refFilePath, actualFilePath, relPath) {
  let a, b;
  try {
    const refText = readFileSync(refFilePath, "utf8");
    a = JSON.parse(refText);
  } catch (e) {
    throw new Error(`Invalid JSON in refDir for ${relPath}: ${e.message}`);
  }
  try {
    const actualText = readFileSync(actualFilePath, "utf8");
    b = JSON.parse(actualText);
  } catch (e) {
    throw new Error(`Invalid JSON in actualDir for ${relPath}: ${e.message}`);
  }
  expect(b).toEqual(a);
}

/** Compare TTL files using rdf-isomorphic (primary) with fallback unified diff */
async function compareTtlFiles(refFilePath, actualFilePath, relPath) {
  const refText = readFileSync(refFilePath, "utf8");
  const actualText = readFileSync(actualFilePath, "utf8");

  const quadsA = parseTurtleToQuads(refText);
  const quadsB = parseTurtleToQuads(actualText);

  const iso =
    rdfIsomorphic.isomorphic ||
    rdfIsomorphic.default ||
    rdfIsomorphic;

  let isIso;
  try {
    const maybe = iso(quadsA, quadsB);
    isIso = typeof maybe.then === "function" ? await maybe : maybe;
  } catch {
    isIso = null;
  }

  if (isIso === true) return;
  if (isIso === false) {
    throw new Error(`Turtle graphs differ (not isomorphic): ${relPath}`);
  }

  const listA = normalizeBlankNodesInStrings(quadsA.map(quadToNTripleString)).sort();
  const listB = normalizeBlankNodesInStrings(quadsB.map(quadToNTripleString)).sort();

  if (listA.join("\n") === listB.join("\n")) return;

  const diffText = generateUnifiedDiffFromLineLists(listA, listB, `a/${relPath}`, `b/${relPath}`, 3);
  const message = [
    `Turtle files differ for ${relPath} (fallback N-Triples compare).`,
    `Install/upgrade 'rdf-isomorphic' for robust blank-node-tolerant comparison.`,
    "",
    diffText,
  ].join("\n");
  throw new Error(message);
}

/** Compare TXT files by trimmed textual equality */
function compareTxtFiles(refFilePath, actualFilePath, relPath) {
  const refText = readFileSync(refFilePath, "utf8");
  const actualText = readFileSync(actualFilePath, "utf8");
  if (refText.trim() !== actualText.trim()) {
    throw new Error(`SPARQL (.rq) mismatch for ${relPath}`);
  }
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

/** Compare XLSX files by deep-equality of their JSON transformations */
function compareXlsxFiles(refFilePath, actualFilePath, relPath) {
  let a, b;
  try {
    a = getExcelAsJson(refFilePath);
  } catch (e) {
    throw new Error(`Invalid XLSX in refDir for ${relPath}: ${e.message}`);
  }
  try {
    b = getExcelAsJson(actualFilePath);
  } catch (e) {
    throw new Error(`Invalid XLSX in actualDir for ${relPath}: ${e.message}`);
  }
  expect(b).toEqual(a);
}

/** Compare YAML files by deep-equality (throws on mismatch) */
function compareYamlFiles(refFilePath, actualFilePath, relPath) {
  let a, b;
  try {
    const refText = readFileSync(refFilePath, "utf8");
    a = yaml.load(refText);
  } catch (e) {
    throw new Error(`Invalid YAML in refDir for ${relPath}: ${e.message}`);
  }
  try {
    const actualText = readFileSync(actualFilePath, "utf8");
    b = yaml.load(actualText);
  } catch (e) {
    throw new Error(`Invalid YML in actualDir for ${relPath}: ${e.message}`);
  }
  expect(b).toEqual(a);
}

/** Binary comparison: compare raw buffers exactly */
function compareBinaryFiles(refFilePath, actualFilePath, relPath) {
  const refBuf = readFileSync(refFilePath);
  const actualBuf = readFileSync(actualFilePath);
  if (!Buffer.isBuffer(refBuf) || !Buffer.isBuffer(actualBuf)) {
    // readFileSync without encoding returns Buffer; this is just a sanity check
  }
  if (!refBuf.equals(actualBuf)) {
    throw new Error(`Binary mismatch for ${relPath}`);
  }
}

// commonTrailingPath("/a/b/x/y.z", "/c/d/x/y.z")) "x/y.z"
function commonTrailingPath(path1, path2) {
  const parts1 = path1.split('/').filter(Boolean);
  const parts2 = path2.split('/').filter(Boolean);

  const result = [];
  let i1 = parts1.length - 1;
  let i2 = parts2.length - 1;

  while (i1 >= 0 && i2 >= 0 && parts1[i1] === parts2[i2]) {
    result.unshift(parts1[i1]);
    i1--;
    i2--;
  }

  return result.join('/');
}

/* ------------------------------------------------------------------
 * Compare files
 * ------------------------------------------------------------------*/
export async function compareFiles(refFilePath, actualFilePath, relPath, ext) {
  if (!relPath) {
    relPath = commonTrailingPath(refFilePath, actualFilePath);
  }
  if (!ext) {
    ext = extname(refFilePath).slice(1);
  }
  if (ext.toLowerCase() === ".json") {
    return compareJsonFiles(refFilePath, actualFilePath, relPath);
  }
  if (ext.toLowerCase() === ".ttl") {
    return await compareTtlFiles(refFilePath, actualFilePath, relPath);
  }
  if (ext.toLowerCase() in [".txt", ".rq"]) {
    return compareTxtFiles(refFilePath, actualFilePath, relPath);
  }
  if (ext.toLowerCase() === "xlsx") {
    return compareXlsxFiles(refFilePath, actualFilePath, relPath);
  }
  if (ext.toLowerCase() in ["yml", "yaml"]) {
    return compareYamlFiles(refFilePath, actualFilePath, relPath);
  }
  return compareBinaryFiles(refFilePath, actualFilePath, relPath);
}

/* ------------------------------------------------------------------
 * Compare directories
 * ------------------------------------------------------------------*/
export async function compareDirectories(refDir, actualDir, opts = {}) {
  const refList = walk(refDir, refDir, [], opts);

  const missing = [];
  for (const relPath of refList) {
    try {
      statSync(join(actualDir, relPath));
    } catch {
      missing.push(relPath);
    }
  }
  if (missing.length) {
    throw new Error(
      `Missing in actualDir (${actualDir}) but present in refDir (${refDir}):\n` +
      missing.join("\n")
    );
  }

  for (const relPath of refList) {
    const pathRef = join(refDir, relPath);
    const pathAct = join(actualDir, relPath);
    const ext = extname(relPath) || "";
    await compareFiles(pathRef, pathAct, relPath, ext);
  }
}

/* ------------------------------------------------------------------
 * Convenience wrapper: unified diff from two raw Turtle texts
 * ------------------------------------------------------------------*/
export function turtleUnifiedDiffFromTexts(refText, actualText, relPath = "file.ttl", context = 3) {
  const listA = normalizedNTriplesLinesFromTurtleText(refText);
  const listB = normalizedNTriplesLinesFromTurtleText(actualText);
  return generateUnifiedDiffFromLineLists(listA, listB, `a/${relPath}`, `b/${relPath}`, context);
}
