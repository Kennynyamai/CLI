import { repoFind } from "../repository.js";
import { indexRead, indexWrite } from "../index.js";
import { objectRead, objectFind } from "../objects.js";
import { palignoreRead, checkIgnore } from "../commands/checkIgnore.js";
import { objectHash } from "./hashObject.js";
import path from "path";
import fs from "fs";
import chalk from 'chalk';

// Get active branch or detached HEAD
function branchGetActive(repo) {
  const headPath = path.join(repo.gitdir, "HEAD");
  if (!fs.existsSync(headPath)) {
    throw new Error("HEAD reference does not exist.");
  }
  const headContent = fs.readFileSync(headPath, "utf8").trim();
  if (headContent.startsWith("ref: refs/heads/")) {
    return headContent.slice(16);
  }
  return false; // Detached HEAD
}

// Convert a tree to a flat dictionary
export function treeToDict(repo, ref, prefix = "") {
  const result = {};
  const treeSha = objectFind(repo, ref, "tree");
  const tree = objectRead(repo, treeSha);

  for (const leaf of tree.items) {
    const fullPath = path.join(prefix, leaf.path);
    if (leaf.mode.startsWith("04")) {
      // Subtree
      Object.assign(result, treeToDict(repo, leaf.sha, fullPath));
    } else {
      result[fullPath] = leaf.sha; // Blob
    }
  }

  return result;
}

// Compare HEAD and index
function cmdStatusHeadIndex(repo, index) {
  const head = treeToDict(repo, "HEAD");
  let hasChanges = false;

  console.log(chalk.cyan("\nChanges to be committed:"));

  for (const entry of index.entries) {
    if (entry.name in head) {
      if (head[entry.name] !== entry.sha) {
        console.log(`  ${chalk.yellow("modified:")}   ${entry.name}`);
        hasChanges = true;
      }
      delete head[entry.name];
    } else {
      console.log(`  ${chalk.green("added:")}      ${entry.name}`);
      hasChanges = true;
    }
  }

  for (const name in head) {
    console.log(`  ${chalk.red("deleted:")}    ${name}`);
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log(`  ${chalk.gray("No changes staged for commit.")}`);
  }
}


// Compare index and worktree
function cmdStatusIndexWorktree(repo, index) {
  const ignoreRules = palignoreRead(repo);
  const worktreeFiles = fs.readdirSync(repo.worktree).filter((f) => !f.startsWith(repo.gitdir));
  let hasChanges = false;

  console.log(chalk.cyan("\nChanges not staged for commit:"));

  for (const entry of index.entries) {
    const fullPath = path.join(repo.worktree, entry.name);

    if (!fs.existsSync(fullPath)) {
      console.log(`  ${chalk.red("deleted:")}    ${entry.name}`);
      hasChanges = true;
    } else {
      const stat = fs.statSync(fullPath);
      const ctimeNs = entry.ctime[0] * 1e9 + entry.ctime[1];
      const mtimeNs = entry.mtime[0] * 1e9 + entry.mtime[1];

      if (stat.ctimeNs !== ctimeNs || stat.mtimeNs !== mtimeNs) {
        const fileData = fs.readFileSync(fullPath);
        const newSha = objectHash(fileData, "blob", repo);

        if (entry.sha !== newSha) {
          console.log(`  ${chalk.yellow("modified:")}   ${entry.name}`);
          hasChanges = true;
        }
      }
    }

    if (worktreeFiles.includes(entry.name)) {
      worktreeFiles.splice(worktreeFiles.indexOf(entry.name), 1);
    }
  }

  if (!hasChanges) {
    console.log(`  ${chalk.gray("No changes not staged for commit.")}`);
  }

  console.log(chalk.cyan("\nUntracked files:"));

  for (const file of worktreeFiles) {
    if (!checkIgnore(ignoreRules, file)) {
      console.log(`  ${chalk.green(file)}`);
    }
  }
}

// Status: Display active branch or detached HEAD
function cmdStatusBranch(repo) {
  const headPath = path.join(repo.gitdir, "HEAD");
  if (!fs.existsSync(headPath)) {
    console.log(chalk.red("[ERROR] HEAD reference does not exist."));
    return;
  }

  const headContent = fs.readFileSync(headPath, "utf8").trim();

  if (headContent.startsWith("ref: refs/heads/")) {
    const branch = headContent.slice(16);
    console.log(chalk.green(`\nOn branch ${chalk.bold(branch)}.`));
  } else {
    const headSha = objectFind(repo, "HEAD");
    console.log(chalk.yellow(`\nHEAD detached at ${headSha.slice(0, 8)}.`));
  }
}



// Main status command
export function cmdStatus() {
  const repo = repoFind();
  if (!repo) {
    throw new Error("Not a valid repository.");
  }

  const index = indexRead(repo);

  // Display branch or detached HEAD
  cmdStatusBranch(repo);

  // Compare HEAD and index
  cmdStatusHeadIndex(repo, index);

  // Compare index and worktree
  cmdStatusIndexWorktree(repo, index);
}
