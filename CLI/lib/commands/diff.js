import { repoFind } from "../repository.js";
import { refResolve } from "../references.js";
import chalk from 'chalk';


export function myersDiff(base, target) {
  const baseLines = base.split("\n");
  const targetLines = target.split("\n");

  const m = baseLines.length;
  const n = targetLines.length;
  const editScript = [];

  const max = m + n;
  const v = Array(2 * max + 1).fill(0);

  const offset = max;

  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
      const kPrev = down ? k + 1 : k - 1;

      const xStart = v[offset + kPrev];
      let xEnd = down ? xStart : xStart + 1;
      let yEnd = xEnd - k;

      while (xEnd < m && yEnd < n && baseLines[xEnd] === targetLines[yEnd]) {
        xEnd++;
        yEnd++;
      }

      v[offset + k] = xEnd;

      if (xEnd >= m && yEnd >= n) {
        return editScript;
      }
    }
  }

  throw new Error("Diff computation failed.");
}

function compareTrees(tree1, tree2) {
  const diff = {
    added: [],
    deleted: [],
    modified: [],
    conflicts: [],
    conflictDetails: {},
  };

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


export async function cmdDiff(branch1, branch2) {
  try {
    const repo = repoFind();

    const sha1 = refResolve(repo, `refs/heads/${branch1}`);
    const sha2 = refResolve(repo, `refs/heads/${branch2}`);

    if (!sha1 || !sha2) {
      console.error("Error: One or both branches do not exist.");
      return;
    }

    const tree1 = await repo.treeFromCommit(sha1);
    const tree2 = await repo.treeFromCommit(sha2);

    const diff = compareTrees(tree1, tree2);

    displayDiff(diff);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}