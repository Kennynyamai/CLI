import fs from "fs";
import path from "path";
import chalk from 'chalk';
import { indexRead, indexWrite, GitIndexEntry } from "../core/index.js";
import { objectHash } from "./hashObject.js";
import { repoFind } from "../core/repository.js";
import { rm } from "./rm.js";
import { palignoreRead, checkIgnore } from "./checkIgnore.js"; // Import `checkIgnore`

// Command handler for the `add` command
function cmdAdd(args) {
  const repo = repoFind();
  console.log("\n📂 Repository located successfully.");
  console.log("Adding files to the index...");
  add(repo, args.path);
}

function add(repo, paths) {
  // Read `.palignore` rules
  const ignoreRules = palignoreRead(repo);

  // Clean index for these files
  console.log("📄 Preparing files for staging...");
  rm(repo, paths, false, true);

  // Get working directory
  const worktree = repo.worktree + path.sep;

  // Resolve paths
  const cleanPaths = paths.map((p) => {
    const abspath = path.resolve(p);

    if (!(abspath.startsWith(worktree) && fs.existsSync(abspath))) {
      throw new Error(`🚫 Skipped: ${p} (File does not exist or is outside the repository)`);
    }
    return { abspath, relpath: path.relative(repo.worktree, abspath) };
  });


  // Read index
  const index = indexRead(repo);
  
  // Staging files
  const stagedFiles = [];
  for (const { abspath, relpath } of cleanPaths) {
   
    if (checkIgnore(ignoreRules, relpath)) {
      console.log(`⚠️ Skipped ignored file: ${relpath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(abspath); // Ensure no issues with `abspath`
    const sha = objectHash(fileBuffer, "blob", repo); // Ensure `objectHash` is properly defined
    const stat = fs.statSync(abspath); // Check if `abspath` is valid and `stat` is correct
    

    
    const entry = new GitIndexEntry({
      ctime: [Math.floor(stat.ctimeMs / 1000), stat.ctimeMs % 1000], // Creation time
      mtime: [Math.floor(stat.mtimeMs / 1000), stat.mtimeMs % 1000], // Modification time
      dev: stat.dev, // Device number
      ino: stat.ino, // Inode number
      modeType: 0b1000, // File type (regular file)
      modePerms: 0o644, // Permissions
      uid: stat.uid, // User ID
      gid: stat.gid, // Group ID
      fsize: stat.size,  // File size
      sha, // File's hashed content
      flagAssumeValid: false, // Validation flag
      flagStage: false, // Staging flag
      name: relpath,  // File's relative path
    });


    index.entries.push(entry);
    stagedFiles.push(relpath);
  }


 
  indexWrite(repo, index);


  console.log(chalk.green("\n✅ Files staged successfully:"));
  stagedFiles.forEach((file) => console.log(`  - ${chalk.blue(file)}`));
  console.log("\n🎉 Use `pal commit` to save your changes.\n");
}

export { cmdAdd, add };
