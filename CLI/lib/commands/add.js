import fs from "fs";
import path from "path";
import chalk from 'chalk';
import { indexRead, indexWrite, GitIndexEntry } from "../index.js";
import { objectHash } from "./hashObject.js";
import { repoFind } from "../repository.js";
import { rm } from "./rm.js";
import { palignoreRead, checkIgnore } from "./checkIgnore.js"; // Import `checkIgnore`


// Command bridge for the `add` command
export function cmdAdd(args) {
  const repo = repoFind();
  console.log("\n📂 Repository located successfully.");
  console.log("Adding files to the index...\n");
  add(repo, args.path);
}

// The main `add` function
// The main `add` function
export function add(repo, paths) {
  const ignoreRules = palignoreRead(repo);

  console.log("📄 Preparing files for staging...");
  rm(repo, paths, false, true); // Clean the index for these files

  const worktree = repo.worktree + path.sep;
  const cleanPaths = paths.map((p) => {
    const abspath = path.resolve(p);
    if (!(abspath.startsWith(worktree) && fs.existsSync(abspath))) {
      throw new Error(`🚫 Skipped: ${p} (File does not exist or is outside the repository)`);
    }
    return { abspath, relpath: path.relative(repo.worktree, abspath) };
  });

  const index = indexRead(repo);
  const stagedFiles = [];

  for (const { abspath, relpath } of cleanPaths) {
    if (checkIgnore(ignoreRules, relpath)) {
      console.log(`⚠️ Skipped ignored file: ${relpath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(abspath);
    const sha = objectHash(fileBuffer, "blob", repo);
    const stat = fs.statSync(abspath);

    const entry = new GitIndexEntry({
      ctime: [Math.floor(stat.ctimeMs / 1000), stat.ctimeMs % 1000],
      mtime: [Math.floor(stat.mtimeMs / 1000), stat.mtimeMs % 1000],
      dev: stat.dev,
      ino: stat.ino,
      modeType: 0b1000,
      modePerms: 0o644,
      uid: stat.uid,
      gid: stat.gid,
      fsize: stat.size,
      sha,
      flagAssumeValid: false,
      flagStage: false,
      name: relpath,
    });

    index.entries.push(entry);
    stagedFiles.push(relpath);
  }

  indexWrite(repo, index);

  console.log(chalk.green("\n✅ Files staged successfully:"));
  stagedFiles.forEach((file) => console.log(`  - ${chalk.blue(file)}`));
  console.log("\n🎉 Use `pal commit` to save your changes.\n");
}