import fs from "fs";
import path from "path";
import { indexRead, indexWrite, GitIndexEntry } from "../index.js";
import { objectHash } from "./hashObject.js";
import { repoFind } from "../repository.js";
import { rm } from "./rm.js";
import { palignoreRead, checkIgnore } from "./checkIgnore.js"; // Import `checkIgnore`

// Command bridge for the `add` command
export function cmdAdd(args) {
  const repo = repoFind();
  console.log("Repository found:", repo.gitdir);
  add(repo, args.path);
}

// The main `add` function
export function add(repo, paths) {
  console.log("Starting add process...");
  console.log("Paths provided:", paths);

  // Load ignore rules
  const ignoreRules = palignoreRead(repo);
  console.log("Loaded ignore rules:", ignoreRules);

  // Remove existing paths from the index
  console.log("Removing existing paths from the index...");
  rm(repo, paths, false, true);

  const worktree = repo.worktree + path.sep;
  console.log("Worktree:", worktree);

  const cleanPaths = paths.map((p) => {
    const abspath = path.resolve(p);
    console.log(`Resolving path: ${p} -> Absolute: ${abspath}`);

    if (!(abspath.startsWith(worktree) && fs.existsSync(abspath))) {
      throw new Error(`Not a file, or outside the worktree: ${p}`);
    }

    const relpath = path.relative(repo.worktree, abspath);
    console.log(`Relative path: ${relpath}`);
    return { abspath, relpath };
  });

  console.log("Clean paths to process:", cleanPaths);

  const index = indexRead(repo);
  console.log("Current index entries:", index.entries.map((e) => e.name));

  for (const { abspath, relpath } of cleanPaths) {
    console.log(`Processing file: ${relpath}`);

    // Check if the file is ignored
    const isIgnored = checkIgnore(ignoreRules, relpath);
    if (isIgnored) {
      console.log(`Skipping ignored file: ${relpath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(abspath);
    console.log(`Read file content (length: ${fileBuffer.length})`);

    const sha = objectHash(fileBuffer, "blob", repo);
    console.log(`Computed SHA-1 hash: ${sha}`);

    const stat = fs.statSync(abspath);
    console.log("File stats:", stat);

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

    console.log("Index entry to add:", entry);

    index.entries.push(entry);
  }

  console.log("Updated index entries:", index.entries.map((e) => e.name));
  console.log("Writing updated index to disk...");
  indexWrite(repo, index);
  console.log("Index write complete.");
}