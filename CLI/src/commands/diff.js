import { repoFind } from "../core/repository.js";
import { refResolve } from "../core/references.js";
import chalk from 'chalk';

// Myers diff algorithm for line-by-line comparison
function myersDiff(base, target) {
  const baseLines = base.split("\n"); // Split the base string into lines
  const targetLines = target.split("\n");// Split the target string into lines

  const m = baseLines.length;  // Number of lines in the base
  const n = targetLines.length; // Number of lines in the target
  const editScript = []; // Placeholder for the resulting edit script

  const max = m + n; // Maximum path length in the edit graph
  const v = Array(2 * max + 1).fill(0); // Initialize the vector for path lengths

  const offset = max; // Center the offset to handle negative indexes


  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]); // Determine move direction
      const kPrev = down ? k + 1 : k - 1; // Previous diagonal index

      const xStart = v[offset + kPrev]; // Start of the current path
      let xEnd = down ? xStart : xStart + 1; // Determine the endpoint for x
      let yEnd = xEnd - k; // Calculate corresponding y position

      // Extend the path along the diagonal while lines match
      while (xEnd < m && yEnd < n && baseLines[xEnd] === targetLines[yEnd]) {
        xEnd++;
        yEnd++;
      }

      v[offset + k] = xEnd;  // Update the vector with the current endpoint

       // If we reach the end of both sequences, stop
      if (xEnd >= m && yEnd >= n) {
        return editScript;
      }
    }
  }

  throw new Error("Diff computation failed.");
}


// Compare two trees and generate a diff object
function compareTrees(tree1, tree2) {
  const diff = {
    added: [], // Files present in tree2 but not in tree1
    deleted: [],  // Files present in tree1 but not in tree2
    modified: [], // Files modified between the trees
    conflicts: [], // Files with merge conflicts
    conflictDetails: {}, // Details of conflicts with SHAs
  };

  // Map tree1 and tree2 items by file path
  const map1 = new Map(tree1.map((item) => [item.path, item]));
  const map2 = new Map(tree2.map((item) => [item.path, item]));

  for (const [path, item2] of map2.entries()) {
    if (!map1.has(path)) {
      diff.added.push(path);
    } else if (map1.get(path).sha !== item2.sha) {
      diff.modified.push(path);
      const sha1 = map1.get(path).sha;
      const sha2 = item2.sha;
      if (sha1 && sha2 && sha1 !== sha2) {
        diff.conflicts.push(path);
        diff.conflictDetails[path] = { sha1, sha2 };
      }
    }
  }

  for (const path of map1.keys()) {
    if (!map2.has(path)) {
      diff.deleted.push(path);
    }
  }

  return diff;
}

// Display the diff in a user-friendly format
function displayDiff(diff) {
  if (diff.added.length) {
    console.log(chalk.green.bold("\n📂 Added files:"));
    diff.added.forEach((file) => console.log(`  ${chalk.green("+")} ${file}`));
  }

  if (diff.deleted.length) {
    console.log(chalk.red.bold("\n🗑️ Deleted files:"));
    diff.deleted.forEach((file) => console.log(`  ${chalk.red("-")} ${file}`));
  }

  if (diff.modified.length) {
    console.log(chalk.yellow.bold("\n✏️ Modified files:"));
    diff.modified.forEach((file) => console.log(`  ${chalk.yellow("*")} ${file}`));
  }

  if (diff.conflicts.length) {
    console.log(chalk.magenta.bold("\n⚠️ Conflicting files:"));
    diff.conflicts.forEach((file) => {
      console.log(`  ${chalk.magenta("!")} ${file}`);
      const { sha1, sha2 } = diff.conflictDetails[file];
      console.log(`    ${chalk.gray("Conflict between SHA-1s:")} ${chalk.red(sha1)} ${chalk.gray("and")} ${chalk.red(sha2)}`);
    });
  }

  if (
    !diff.added.length &&
    !diff.deleted.length &&
    !diff.modified.length &&
    !diff.conflicts.length
  ) {
    console.log(chalk.blue.bold("\n✅ No differences found."));
  }

  console.log(""); // Add a blank line for clean output
}


async function cmdDiff(branch1, branch2) {
  try {
    const repo = repoFind();

    const sha1 = refResolve(repo, `refs/heads/${branch1}`);
    const sha2 = refResolve(repo, `refs/heads/${branch2}`);

    if (!sha1 || !sha2) {
      console.error("Error: One or both branches do not exist.");
      return;
    }

    const tree1 = await repo.treeFromCommit(sha1);  // Get the tree for branch1
    const tree2 = await repo.treeFromCommit(sha2); // Get the tree for branch2

    const diff = compareTrees(tree1, tree2); // Compare the trees and generate the diff


    displayDiff(diff);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

export { myersDiff, cmdDiff};