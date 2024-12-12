import path from "path";
import { indexRead, indexWrite } from "../core/index.js";
import { repoFind } from "../core/repository.js";
import chalk from 'chalk';

// Command bridge for the `rm` command
function cmdRm(args) {
  const repo = repoFind();
  rm(repo, args.path);
}


// Main function to handle file removal from the index and working tree(depending on the value of deleteFiles)
function rm(repo, paths, deleteFiles = false, skipMissing = false) {
  const index = indexRead(repo);
  const worktree = repo.worktree + path.sep;

  // Resolve absolute paths and ensure they are inside the repository
  const abspaths = paths.map((p) => {
    const abspath = path.resolve(p);
    if (!abspath.startsWith(worktree)) {
      throw new Error(`🚫 Cannot remove paths outside the repository: ${paths}`);
    }
    return abspath;
  });

  const keptEntries = []; // List of entries to keep in the index
  const removedPaths = []; // List of successfully removed paths

// Iterate over index entries and check if they match the paths to remove
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

   // Update the index by keeping only non-removed entries
  index.entries = keptEntries;
  indexWrite(repo, index);

  console.log(chalk.green("\n✅ Index updated successfully.\n"));
}

export { cmdRm, rm };