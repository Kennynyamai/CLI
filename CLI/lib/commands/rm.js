import fs from "fs";
import path from "path";
import { indexRead, indexWrite } from "../index.js";
import { repoFind } from "../repository.js";

// Command bridge for the `rm` command
export function cmdRm(args) {
  const repo = repoFind();
  rm(repo, args.path);
}

// The main `rm` function
export function rm(repo, paths, deleteFiles = false, skipMissing = false) {
  console.log("Starting rm process...");
  console.log("Paths to remove:", paths);
  console.log("Delete Files:", deleteFiles);
  console.log("Skip Missing:", skipMissing);

  const index = indexRead(repo);
  console.log("Initial index entries:", index.entries.map((e) => e?.name || "undefined"));

  const worktree = repo.worktree + path.sep;

  const abspaths = paths.map((p) => {
    const abspath = path.resolve(p);
    if (!abspath.startsWith(worktree)) {
      throw new Error(`Cannot remove paths outside of worktree: ${paths}`);
    }
    return abspath;
  });
  console.log("Absolute Paths:", abspaths);

  const keptEntries = [];
  const removePaths = [];

  for (const entry of index.entries) {
    if (!entry) {
      console.error("Found undefined entry in index:", entry);
      continue;
    }

    const fullPath = path.join(repo.worktree, entry.name);
    if (abspaths.includes(fullPath)) {
      console.log(`Removing: ${fullPath}`);
      removePaths.push(fullPath);
      abspaths.splice(abspaths.indexOf(fullPath), 1);
    } else {
      keptEntries.push(entry);
    }
  }

  if (abspaths.length > 0 && !skipMissing) {
    throw new Error(`Cannot remove paths not in the index: ${abspaths}`);
  }

  if (deleteFiles) {
    for (const pathToDelete of removePaths) {
      console.log(`Deleting file: ${pathToDelete}`);
      fs.unlinkSync(pathToDelete);
    }
  }

  index.entries = keptEntries;
  console.log("Kept entries:", index.entries.map((e) => e?.name || "undefined"));
  console.log("Writing updated index...");
  indexWrite(repo, index);
  console.log("Index update complete.");
}
 