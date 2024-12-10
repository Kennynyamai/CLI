import { repoFind } from "../repository.js";
import { indexRead, indexWrite } from "../index.js";
import { objectRead, objectFind } from "../objects.js";
import { palignoreRead, checkIgnore } from "../commands/checkIgnore.js";
import { objectHash } from "./hashObject.js";
import path from "path";
import fs from "fs";

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
  console.log("Changes to be committed:");
  const head = treeToDict(repo, "HEAD");

  for (const entry of index.entries) {
    if (entry.name in head) {
      if (head[entry.name] !== entry.sha) {
        console.log(`  modified:   ${entry.name}`);
      }
      delete head[entry.name];
    } else {
      console.log(`  added:      ${entry.name}`);
    }
  }

  for (const name in head) {
    console.log(`  deleted:    ${name}`);
  }
}

// Compare index and worktree
function cmdStatusIndexWorktree(repo, index) {
  console.log("\nChanges not staged for commit:");
  const ignoreRules = palignoreRead(repo);
  const worktreeFiles = fs.readdirSync(repo.worktree).filter((f) => !f.startsWith(repo.gitdir));

  for (const entry of index.entries) {
    const fullPath = path.join(repo.worktree, entry.name);

    if (!fs.existsSync(fullPath)) {
      console.log(`  deleted:    ${entry.name}`);
    } else {
      const stat = fs.statSync(fullPath);
      const ctimeNs = entry.ctime[0] * 1e9 + entry.ctime[1];
      const mtimeNs = entry.mtime[0] * 1e9 + entry.mtime[1];

      if (stat.ctimeNs !== ctimeNs || stat.mtimeNs !== mtimeNs) {
        const fileData = fs.readFileSync(fullPath);
        const newSha = objectHash(fileData, "blob", repo);

        if (entry.sha !== newSha) {
          console.log(`  modified:   ${entry.name}`);
        }
      }
    }

    if (worktreeFiles.includes(entry.name)) {
      worktreeFiles.splice(worktreeFiles.indexOf(entry.name), 1);
    }
  }

  console.log("\nUntracked files:");
  for (const file of worktreeFiles) {
    if (!checkIgnore(ignoreRules, file)) {
      console.log(`  ${file}`);
    }
  }
}
// Status: Display active branch or detached HEAD
function cmdStatusBranch(repo) {
  const headPath = path.join(repo.gitdir, "HEAD");
  if (!fs.existsSync(headPath)) {
    console.log("Error: HEAD reference does not exist.");
    return;
  }

  const headContent = fs.readFileSync(headPath, "utf8").trim();

  if (headContent.startsWith("ref: refs/heads/")) {
    const branch = headContent.slice(16);
    console.log(`On branch ${branch}.`);
  } else {
    const headSha = objectFind(repo, "HEAD");
    console.log(`HEAD detached at ${headSha}.`);
  }
}


// Main status command
export function cmdStatus() {
  const repo = repoFind();
  if (!repo) {
    throw new Error("Not a valid repository.");
  }

  const index = indexRead(repo);

  // Call cmdStatusBranch
  cmdStatusBranch(repo);

  // Call other status functions
  cmdStatusHeadIndex(repo, index);
  console.log();
  cmdStatusIndexWorktree(repo, index);
}
