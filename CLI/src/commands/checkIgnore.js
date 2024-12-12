import { repoFind } from "../core/repository.js";
import { indexRead } from "../core/index.js";
import { objectRead } from "../core/objects.js";
import { minimatch } from "minimatch"; // Use `minimatch` for pattern matching
import path from "path";



// Class to store ignore rules
class PalIgnore {
  constructor(absolute = [], scoped = {}) {
    this.absolute = absolute; // List of absolute ignore rules
    this.scoped = scoped; // Map of directory-specific ignore rules
  }
}

// Parse a single line from a `.palignore` file
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

// Parse multiple lines into a list of rules
function palignoreParse(lines) {
  return lines.map(palignoreParseLine).filter((rule) => rule !== null); // Filter out null rules
}

// Read all .palignore rules for the repository
function palignoreRead(repo) {
  const result = new PalIgnore();

  // Read the repository index to find `.palignore` file
  const index = indexRead(repo);
  for (const entry of index.entries) {
    if (entry.name === ".palignore" || entry.name.endsWith("/.palignore")) {
      const dirName = path.dirname(entry.name);
      const contents = objectRead(repo, entry.sha).blobdata.toString("utf8"); // Read `.palignore` contents
      result.scoped[dirName] = palignoreParse(contents.split("\n"));
    }
  }

 

  return result; //all parsed rules
}

// Match a file path against a list of rules
function checkIgnore1(rules, filePath) {
  let result = null;
  for (const [pattern, value] of rules) {
   // Use `minimatch` to check if the pattern matches the file path
    if (minimatch(filePath, pattern)) {
      console.log(`Pattern matched: ${pattern}, value: ${value}`);
      result = value; // Last matching rule determines the result
    }
  }
  return result;
}

// Match a file path against directory-specific (scoped) rules
function checkIgnoreScoped(rules, filePath) {
  let currentDir = path.dirname(filePath);
   // Traverse up the directory hierarchy
  while (currentDir !== path.resolve(currentDir, "..")) {
   
    if (rules[currentDir]) {
      const result = checkIgnore1(rules[currentDir], filePath);
      if (result !== null) {
        
        return result; // Return if a match is found
      }
    }
    currentDir = path.resolve(currentDir, "..");
  }
  
  return null; // Return null if no match is found
}

// Match a file path against global (absolute) rules
function checkIgnoreAbsolute(rules, filePath) {
  for (const ruleSet of rules) {
    const result = checkIgnore1(ruleSet, filePath);
    if (result !== null) {
      return result; // Stop if a rule matches
    }
  }
  return false; // Default: not ignored
}

// Determine if a file path is ignored
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
function cmdCheckIgnore(paths) {
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
  cmdCheckIgnore,
};