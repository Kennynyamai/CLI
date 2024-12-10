import { repoFind } from "../repository.js";
import { indexRead } from "../index.js";
import { objectRead } from "../objects.js";
import path from "path";
import fs from "fs";
import os from "os";
import { minimatch } from "minimatch"; // Use `minimatch` for pattern matching

class PalIgnore {
  constructor(absolute = [], scoped = {}) {
    this.absolute = absolute; // List of absolute ignore rules
    this.scoped = scoped; // Map of directory-specific ignore rules
  }
}

// Parse a single .palignore pattern
function palignoreParseLine(raw) {
  raw = raw.trim();

  if (!raw || raw.startsWith("#")) {
    return null; // Skip comments or empty lines
  } else if (raw.startsWith("!")) {
    return [raw.slice(1), false]; // Negate pattern
  } else if (raw.startsWith("\\")) {
    return [raw.slice(1), true]; // Literal pattern
  } else {
    return [raw, true]; // Standard pattern
  }
}

// Parse a list of lines into ignore rules
function palignoreParse(lines) {
  return lines.map(palignoreParseLine).filter((rule) => rule !== null); // Filter out null rules
}

// Read all .palignore rules for the repository
function palignoreRead(repo) {
  const result = new PalIgnore();

  // Read .palignore files from the index
  const index = indexRead(repo);
  for (const entry of index.entries) {
    if (entry.name === ".palignore" || entry.name.endsWith("/.palignore")) {
      const dirName = path.dirname(entry.name);
      const contents = objectRead(repo, entry.sha).blobdata.toString("utf8");
      result.scoped[dirName] = palignoreParse(contents.split("\n"));
    }
  }

  console.log("Loaded scoped rules:", result.scoped);

  return result;
}

// Match a path against a set of rules
function checkIgnore1(rules, filePath) {
  let result = null;
  for (const [pattern, value] of rules) {
    console.log(`Testing pattern: ${pattern} against path: ${filePath}`);
    if (minimatch(filePath, pattern)) {
      console.log(`Pattern matched: ${pattern}, value: ${value}`);
      result = value; // Last matching rule determines the result
    }
  }
  return result;
}

// Match against scoped rules
function checkIgnoreScoped(rules, filePath) {
  let currentDir = path.dirname(filePath);
  console.log(`Starting scoped check for: ${filePath}`);
  while (currentDir !== path.resolve(currentDir, "..")) {
    console.log(`Checking directory: ${currentDir}`);
    if (rules[currentDir]) {
      const result = checkIgnore1(rules[currentDir], filePath);
      if (result !== null) {
        console.log(`Scoped match found in: ${currentDir}`);
        return result;
      }
    }
    currentDir = path.resolve(currentDir, "..");
  }
  console.log("No scoped match found.");
  return null;
}

// Match against absolute rules
function checkIgnoreAbsolute(rules, filePath) {
  for (const ruleSet of rules) {
    const result = checkIgnore1(ruleSet, filePath);
    if (result !== null) {
      return result; // Stop if a rule matches
    }
  }
  return false; // Default: not ignored
}

// Check if a path is ignored
function checkIgnore(rules, filePath) {
  if (path.isAbsolute(filePath)) {
    throw new Error("Path must be relative to the repository's root.");
  }

  const scopedResult = checkIgnoreScoped(rules.scoped, filePath);
  if (scopedResult !== null) {
    return scopedResult; // Scoped rules take precedence
  }

  return checkIgnoreAbsolute(rules.absolute, filePath); // Fallback to absolute rules
}

// Command: check-ignore
export function cmdCheckIgnore(paths) {
  const repo = repoFind();
  const rules = palignoreRead(repo);

  for (const relativePath of paths) {
    const isIgnored = checkIgnore(rules, relativePath);
    console.log(
      `${relativePath}: ${isIgnored ? "Ignored" : "Not Ignored"}`
    );
  }
}


export {
  palignoreRead,
  checkIgnore1,
  checkIgnoreScoped,
  checkIgnoreAbsolute,
  checkIgnore,
};