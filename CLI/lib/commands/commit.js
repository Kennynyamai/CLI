import fs from "fs";
import path from "path";
import { repoFind } from "../repository.js";
import { objectWrite, objectFind, objectRead, GitTree } from "../objects.js";
import chalk from 'chalk';
import { indexRead, indexWrite } from "../index.js";
import { GitTreeLeaf } from "../trees.js";
import { GitCommit } from "../objects.js";
import { branchGetActive } from "../branch.js";
import { gitConfigRead, gitConfigUserGet } from "../config.js";
import { GitIndexEntry } from "../index.js";

import { DateTime } from "luxon";

// Create trees from the index
export function treeFromIndex(repo, index) {
 // console.log("Starting treeFromIndex...");

  if (!index || !Array.isArray(index.entries)) {
      console.error("Invalid index structure: Missing or invalid 'entries'.");
      throw new Error("Invalid index structure: 'entries' must be an array.");
  }

  //console.log("Index received for treeFromIndex:", JSON.stringify(index, null, 2));

  // Step 1: Organize entries by directory
  const contents = { ".": [] }; // Root directory starts as "." instead of empty
  for (const entry of index.entries) {
      const dirname = path.dirname(entry.name);

      // Create all parent directories up to the root
      let currentDir = dirname;
      while (currentDir && currentDir !== "." && currentDir !== "/") {
          if (!contents[currentDir]) {
              contents[currentDir] = [];
          }
          const nextDir = path.dirname(currentDir);
          if (nextDir === currentDir) break; // Prevent infinite loop
          currentDir = nextDir;
      }

      // Add entry to the appropriate directory
      if (!contents[dirname]) {
          contents[dirname] = [];
      }
      contents[dirname].push(entry);
  }

 // console.log("Contents organized by directory:", JSON.stringify(contents, null, 2));

  // Step 2: Sort directories by descending length (process deeper directories first)
  const sortedPaths = Object.keys(contents).sort((a, b) => b.length - a.length);
 // console.log("Sorted directories for processing:", sortedPaths);

  let rootSha = null;

  // Step 3: Process each directory to create tree objects
  const directoryShas = {}; // Store SHA for each directory
  for (const dir of sortedPaths) {
     // console.log(`Processing directory: ${dir}`);
      const tree = new GitTree();

      for (const item of contents[dir]) {
          if (Array.isArray(item)) {
              // This is a previously created tree entry
              const leaf = new GitTreeLeaf("040000", item[0], item[1]);
              tree.items.push(leaf);
          } else {
              // This is a file entry from the index
              const mode = `${item.modeType.toString(8).padStart(2, "0")}${item.modePerms.toString(8).padStart(4, "0")}`;
              const leaf = new GitTreeLeaf(mode, path.basename(item.name), item.sha);
             // console.log(`Adding file to tree: ${JSON.stringify(leaf)}`);
              tree.items.push(leaf);
          }
      }

      // Write the tree object and get its SHA
      const sha = objectWrite(tree, repo);
    //  console.log(`Tree written for directory ${dir}: SHA ${sha}`);
      directoryShas[dir] = sha;

      if (dir === ".") {
          rootSha = sha; // Set root tree SHA for the top-level directory
      } else {
          // Add this tree's SHA to its parent directory
          const parentDir = path.dirname(dir);
          const baseName = path.basename(dir);
          contents[parentDir].push([baseName, sha]);
      }
  }

 // console.log("Directory SHAs:", directoryShas);
 // console.log("TreeFromIndex completed. Root tree SHA:", rootSha);
  return rootSha;
}




export function commitCreate(repo, tree, parent, author, timestamp, message) {
  console.log("Creating a new commit...");

  const commit = new GitCommit();
  commit.kvlm = new Map();

  // Set tree
  commit.kvlm.set("tree", tree);

  // Set parent
  if (parent) {
    commit.kvlm.set("parent", parent);
  }

  // Set author and committer
  const formattedAuthor = `${author} ${timestamp.toSeconds()} ${timestamp.offset}`;
  commit.kvlm.set("author", formattedAuthor);
  commit.kvlm.set("committer", formattedAuthor);

  // Set message
  commit.kvlm.set(null, message);

  const sha = objectWrite(commit, repo);

  console.log(`Commit created successfully with SHA: ${sha}`);
  return sha;
}





export function cmdCommit(args) {
  try {
    const repo = repoFind();
    const index = indexRead(repo);

    console.log("\n[INFO] Generating tree object from the index...");
    const tree = treeFromIndex(repo, index);

    console.log("[INFO] Fetching user details...");
    const config = repo.readConfig(repo.repoFile("config"));
    const author = `${config.user.name} <${config.user.email}>`;

    console.log("[INFO] Resolving parent commit...");
    const branch = branchGetActive(repo);
    const branchPath = repo.repoFile("refs", "heads", branch);
    let parent = null;

    if (fs.existsSync(branchPath)) {
      parent = fs.readFileSync(branchPath, "utf-8").trim();
    } else {
      console.log("[INFO] This is the first commit in the branch.");
    }

    const timestamp = DateTime.now();
    const message = args.message || "No commit message provided.";

    console.log("[INFO] Creating commit object...");
    const commitSha = commitCreate(repo, tree, parent, author, timestamp, message);

    console.log("[INFO] Updating branch reference...");
    fs.writeFileSync(branchPath, `${commitSha}\n`);

    console.log(chalk.green("\n[SUCCESS] Commit created successfully!"));
    console.log(`Commit SHA: ${chalk.blue(commitSha)}`);
    console.log("\n🎉 Use `pal log` to view your commit history.\n");
  } catch (error) {
    console.error(chalk.red(`\n[ERROR] Commit failed: ${error.message}`));
  }
}


     





export function mergeCommitCreate(repo, treeSHA, parentSHAs, author, timestamp, message) {
   // console.log("Starting merge commit creation...");
   // console.log("Tree SHA:", treeSHA);
    // parentSHAs.forEach((parentSHA, index) => {
    //     console.log(`Added parent SHA: ${parentSHA}`);
    // });

    // Validate and convert timestamp
    if (typeof timestamp === "string") {
       // console.log("Converting timestamp string to Date...");
        timestamp = new Date(timestamp);
    }
    if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
        throw new Error("Timestamp must be a valid Date object");
    }

    // Convert timestamp to seconds since epoch and timezone offset
    const seconds = Math.floor(timestamp.getTime() / 1000);
    const timezoneOffset = (timestamp.getTimezoneOffset() / 60) * -1; // in hours
    const timezone = `${timezoneOffset >= 0 ? "+" : "-"}${String(Math.abs(timezoneOffset)).padStart(2, "0")}00`;

    const commitData = {
        tree: treeSHA,
        parent: parentSHAs,
        author: `${author} ${seconds} ${timezone}`,
        committer: `${author} ${seconds} ${timezone}`,
        message: message,
    };

   // console.log("Commit data to serialize:", commitData);

    // Serialize the commit
    const kvlm = new Map(Object.entries(commitData));
    const commitObj = new GitCommit();
    commitObj.kvlm = kvlm;

    const sha = objectWrite(commitObj, repo);
    //console.log("Created merge commit with SHA:", sha);

    return sha;
}


