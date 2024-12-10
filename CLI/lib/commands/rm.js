import fs from "fs";
import path from "path";
import { indexRead, indexWrite } from "../index.js";
import { repoFind } from "../repository.js";
import chalk from 'chalk';

// Command bridge for the `rm` command
export function cmdRm(args) {
  const repo = repoFind();
  rm(repo, args.path);
}


// The main `rm` function
export function rm(repo, paths, deleteFiles = false, skipMissing = false) {
  const index = indexRead(repo);
  const worktree = repo.worktree + path.sep;
  const abspaths = paths.map((p) => {
    const abspath = path.resolve(p);
    if (!abspath.startsWith(worktree)) {
      throw new Error(`🚫 Cannot remove paths outside the repository: ${paths}`);
    }
    return abspath;
  });

  const keptEntries = [];
  const removedPaths = [];

  for (const entry of index.entries) {
    const fullPath = path.join(repo.worktree, entry.name);
    if (abspaths.includes(fullPath)) {
      removedPaths.push(entry.name);
    } else {
      keptEntries.push(entry);
    }
  }

  if (removedPaths.length > 0) {
    console.log(chalk.yellow("\n⚠️ Removing paths from the index:"));
    removedPaths.forEach((file) => console.log(`  - ${file}`));
  }

  index.entries = keptEntries;
  indexWrite(repo, index);

  console.log(chalk.green("\n✅ Index updated successfully.\n"));
}
 