import fs from "fs";
import path from "path";
import { repoFind } from "../core/repository.js";
import { objectWrite, GitTree } from "../core/objects.js";
import chalk from 'chalk';
import { indexRead } from "../core/index.js";
import { GitTreeLeaf } from "../core/trees.js";
import { GitCommit } from "../core/objects.js";
import { branchGetActive } from "../core/branch.js";
import { DateTime } from "luxon";

// Generate a tree object from the current index
function treeFromIndex(repo, index) {

  // Validate the index structure
  if (!index || !Array.isArray(index.entries)) {
    console.error("Invalid index structure: Missing or invalid 'entries'.");
    throw new Error("Invalid index structure: 'entries' must be an array.");
  }


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


  // Step 2: Sort directories from deepest to shallowest
  const sortedPaths = Object.keys(contents).sort((a, b) => b.length - a.length);

  let rootSha = null;

  // Step 3: Process each directory to create tree objects
  const directoryShas = {}; // Store SHA for each directory
  for (const dir of sortedPaths) {
    const tree = new GitTree();

    for (const item of contents[dir]) {
      if (Array.isArray(item)) {
        // Add a subtree entry
        const leaf = new GitTreeLeaf("040000", item[0], item[1]);
        tree.items.push(leaf);
      } else {
        // Add a file entry
        const mode = `${item.modeType.toString(8).padStart(2, "0")}${item.modePerms.toString(8).padStart(4, "0")}`;
        const leaf = new GitTreeLeaf(mode, path.basename(item.name), item.sha);

        tree.items.push(leaf);
      }
    }

    // Write the tree object and get its SHA
    const sha = objectWrite(tree, repo);
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

  //this is the SHA of the root tree
  return rootSha; 
}




function commitCreate(repo, tree, parent, author, timestamp, message) {
  console.log("Creating a new commit...");

  const commit = new GitCommit();
  commit.kvlm = new Map();

 // Link the tree to the commit
  commit.kvlm.set("tree", tree); 

  // Add the parent commit
  if (parent) {
    commit.kvlm.set("parent", parent);
  }

 // Set author and committer details with a timestamp
  const formattedAuthor = `${author} ${timestamp.toSeconds()} ${timestamp.offset}`;
  commit.kvlm.set("author", formattedAuthor);
  commit.kvlm.set("committer", formattedAuthor);

 // Set the commit message
  commit.kvlm.set(null, message);
  // Write the commit object and return its SHA
  const sha = objectWrite(commit, repo);

  console.log(`Commit created successfully with SHA: ${sha}`);
  return sha;
}




// Command handler for the `commit` command
function cmdCommit(args) {
  try {
    const repo = repoFind();
    const index = indexRead(repo);

    console.log("\n[INFO] Generating tree object from the index...");
    const tree = treeFromIndex(repo, index);

    console.log("[INFO] Fetching user details...");
    const config = repo.readConfig(repo.repoFile("config")); // Read user config to get auther details
    const author = `${config.user.name} <${config.user.email}>`;

    console.log("[INFO] Resolving parent commit...");
    const branch = branchGetActive(repo); // Get the current branch
    const branchPath = repo.repoFile("refs", "heads", branch); // Path to branch reference
    let parent = null;

    if (fs.existsSync(branchPath)) {
      parent = fs.readFileSync(branchPath, "utf-8").trim(); // Read parent commit
    } else {
      console.log("[INFO] This is the first commit in the branch.");
    }

    const timestamp = DateTime.now();
    const message = args.message || "No commit message provided.";

    console.log("[INFO] Creating commit object...");
    const commitSha = commitCreate(repo, tree, parent, author, timestamp, message);

    console.log("[INFO] Updating branch reference...");
    fs.writeFileSync(branchPath, `${commitSha}\n`);  // Update branch to point to the new commit

    console.log(chalk.green("\n[SUCCESS] Commit created successfully!"));
    console.log(`Commit SHA: ${chalk.blue(commitSha)}`);
    console.log("\n🎉 Use `pal log` to view your commit history.\n");
  } catch (error) {
    console.error(chalk.red(`\n[ERROR] Commit failed: ${error.message}`));
  }
}


function mergeCommitCreate(repo, treeSHA, parentSHAs, author, timestamp, message) {
 
  // Validate and convert timestamp
  if (typeof timestamp === "string") {
    
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

  
  // Serialize the commit
  const kvlm = new Map(Object.entries(commitData));
  const commitObj = new GitCommit();
  commitObj.kvlm = kvlm;

  const sha = objectWrite(commitObj, repo);
  

  return sha;
}


export { treeFromIndex, commitCreate, cmdCommit, mergeCommitCreate };