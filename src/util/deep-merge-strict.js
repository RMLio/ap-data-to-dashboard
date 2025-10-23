/*
The deep marge strict function exported here is OK for comparing mappings as javascript objects.
Below the comments from the creator (ChatGPT) are included for reference.
"
Nice — here’s a single-file, plain-JS, correctness-first implementation that follows all the rules you confirmed:
- deep merge objects recursively
- arrays are treated as order-insensitive sets (deduplicated recursively) at every depth
- array elements that are matching objects are deep-merged (see matching rule below)
- if a single element in a matches one in b they are merged; if zero matches, b element is added; if multiple matches → throw conflict (ambiguous)
- identical values by deep structural equality are not conflicts
- conflicts include full dotted path for easier debugging

Matching rule for array objects (to detect which elements should be merged):
1. If deepEqual(aElem, bElem) → they match.
2. Else, if both are plain objects: find the set of keys that are primitive (string/number/boolean/null/undefined) and present in both objects.
   - If there is at least one such shared primitive key and all those shared primitive keys have equal values, we treat that as a candidate match (this allows matching by id-like fields without requiring an explicit id key).
   - If no shared primitive keys exist, they do not match.
3. If multiple candidate matches exist for a b element → ambiguous → throw conflict.

This keeps behavior strict while still allowing practical matching by primitive identity fields like id.
"
*/

// deep structural equality with arrays treated as sets (order-insensitive)
// arrays: duplicates removed recursively; elements compared via deepEqual
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  // Arrays: order-insensitive, dedupe recursively
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      return false;
    }
    // Build unique lists (preserve first occurrence)
    const uniqA = uniqueArray(a);
    const uniqB = uniqueArray(b);
    if (uniqA.length !== uniqB.length) {
      return false;
    }
    // every element of uniqA must match some element in uniqB
    return uniqA.every(ai => uniqB.some(bj => deepEqual(ai, bj)));
  }
  // Objects (plain)
  if (typeof a === 'object') {
    if (Array.isArray(b)) {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    // ensure same keys
    for (const k of keysA) {
      if (!keysB.includes(k)) {
        return false;
      }
    }
    // check values recursively
    for (const k of keysA) {
      if (!deepEqual(a[k], b[k])) {
        return false;
      }
    }
    return true;
  }
  // primitives (we already covered === at top)
  return false;
}

// produce a "unique" array by deep-equality, preserving first occurrence
function uniqueArray(arr) {
  const res = [];
  for (const item of arr) {
    if (!res.some(r => deepEqual(r, item))) {
      res.push(item);
    }
  }
  return res;
}

// shallow check for "plain object" (not null, not array)
function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

// Identity match heuristic for array objects:
// 1) deepEqual -> match
// 2) else if both plain objects: compute shared primitive keys; if >=1 shared primitive key and all equal -> candidate match
// 3) else no match
function identityMatch(aElem, bElem) {
  if (deepEqual(aElem, bElem)) {
    return true;
  }
  if (isPlainObject(aElem) && isPlainObject(bElem)) {
    const sharedPrimitiveKeys = Object.keys(aElem).filter(k => {
      const va = aElem[k];
      const vb = bElem[k];
      const vaIsPrim = va === null || (typeof va !== 'object');
      const vbIsPrim = vb === null || (typeof vb !== 'object');
      return vb !== undefined && vaIsPrim && vbIsPrim;
    });
    if (sharedPrimitiveKeys.length === 0) {
      return false;
    }
    return sharedPrimitiveKeys.every(k => aElem[k] === bElem[k]);
  }
  return false;
}

// merge two arrays under the semantics:
// - treat arrays as sets recursively
// - unique union of elements
// - if an element in b matches exactly one element in a -> merge those elements (recursively) and replace the element in result
// - if zero matches -> append element from b
// - if >1 matches -> throw conflict (ambiguous)
function mergeArraysStrict(aArr, bArr, path) {
  // start with unique copy of a
  const res = uniqueArray(aArr).map(x => cloneDeep(x));

  for (const bElem of uniqueArray(bArr)) {
    // find candidate indices in res that match identityMatch
    const candidateIndices = res.reduce((acc, rElem, idx) => {
      if (identityMatch(rElem, bElem)) acc.push(idx);
      return acc;
    }, []);

    if (candidateIndices.length === 0) {
      // no match: add bElem (clone)
      res.push(cloneDeep(bElem));
      continue;
    }

    if (candidateIndices.length > 1) {
      // ambiguous
      throw new Error(`Conflict on key "${path}" (ambiguous match in array for element ${JSON.stringify(bElem)})`);
    }

    // exactly one candidate: merge them depending on type
    const idx = candidateIndices[0];
    const aElem = res[idx];

    // if structurally equal (deepEqual), keep aElem
    if (deepEqual(aElem, bElem)) {
      continue;
    }

    // If both arrays -> merge recursively
    if (Array.isArray(aElem) && Array.isArray(bElem)) {
      res[idx] = mergeArraysStrict(aElem, bElem, `${path}[${idx}]`);
      continue;
    }

    // If both plain objects -> deep merge
    if (isPlainObject(aElem) && isPlainObject(bElem)) {
      res[idx] = deepMergeStrict(aElem, bElem, `${path}[${idx}]`);
      continue;
    }

    // Otherwise conflict (primitives mismatched or mismatched types)
    throw new Error(`Conflict on key "${path}" (cannot merge array element at index ${idx})`);
  }

  return res;
}

// deep clone helper for simple values (safe for our use since we only handle JSONable structures)
function cloneDeep(x) {
  // For correctness focus: perform structural clone via recursion to preserve functions? we assume pure data.
  if (x === null) return null;
  if (Array.isArray(x)) return x.map(cloneDeep);
  if (isPlainObject(x)) {
    const o = {};
    for (const k of Object.keys(x)) o[k] = cloneDeep(x[k]);
    return o;
  }
  return x;
}

// Main exported function (plain function as requested)
function deepMergeStrict(a, b, path = "") {
  if (!isPlainObject(a)) throw new Error("deepMergeStrict expects object for first parameter");
  if (!isPlainObject(b)) throw new Error("deepMergeStrict expects object for second parameter");

  const result = cloneDeep(a);

  for (const key of Object.keys(b)) {
    const aVal = a[key];
    const bVal = b[key];
    const currentPath = path ? `${path}.${key}` : key;

    // Key not in a -> assign clone of b
    if (aVal === undefined) {
      result[key] = cloneDeep(bVal);
      continue;
    }

    // If structurally identical -> keep aVal
    if (deepEqual(aVal, bVal)) {
      result[key] = cloneDeep(aVal);
      continue;
    }

    // Arrays -> union semantics with deep merging of matched elements
    if (Array.isArray(aVal) && Array.isArray(bVal)) {
      result[key] = mergeArraysStrict(aVal, bVal, currentPath);
      continue;
    }

    // Both plain objects -> recurse
    if (isPlainObject(aVal) && isPlainObject(bVal)) {
      result[key] = deepMergeStrict(aVal, bVal, currentPath);
      continue;
    }

    // Otherwise it's a conflict
    throw new Error(`Conflict on key "${currentPath}"`);
  }

  return result;
}

module.exports = deepMergeStrict;