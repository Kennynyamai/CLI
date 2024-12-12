import { refResolve, refCreate } from "./references.js";
import { objectRead } from "./objects.js";
import fs from "fs";
import path from "path";

// Get the active branch
function branchGetActive(repo) {
  // Locate the HEAD file
  const headPath = repo.repoFile("HEAD");

  if (!fs.existsSync(headPath)) {
    console.warn(chalk.yellow("[WARNING] HEAD file does not exist."));
    return null;
  }

  // Read the HEAD file
  const headContent = fs.readFileSync(headPath, "utf-8").trim();

  if (headContent.startsWith("ref:")) {
    return headContent.replace("ref: refs/heads/", "").trim(); // Extract the active branch name
  }

  return null; // If HEAD is detached
}



// Create a new branch
function branchCreate(repo, name, startPoint = "HEAD") {
  const sha = refResolve(repo, startPoint); // Resolve the start point to a commit SHA

  if (!sha) {
    throw new Error(`Invalid start point: '${startPoint}' is not a valid commit.`);
  }

   // Create a reference for the new branch
  refCreate(repo, `heads/${name}`, sha);
}


// List all branches
function branchList(repo) {
  const branchesDir = path.join(repo.gitdir, "refs", "heads");  // Path to the branches directory
  const branches = [];

  if (fs.existsSync(branchesDir)) {
    fs.readdirSync(branchesDir).forEach((branch) => {
      branches.push(branch); // Collect all branch names
    });
  }

  return branches;
}


// Find the common ancestor of two commits (during merge command)
function findCommonAncestor(repo, commitA, commitB) {
  const visited = new Set(); // Track visited commits

  const walk = (sha) => {
      while (sha) {
          if (visited.has(sha)) {
           
              return sha; // Return immediately when a common ancestor is found
          }
          visited.add(sha);

          
          const commit = objectRead(repo, sha);

          sha = commit.kvlm.get("parent")?.toString("utf8") || null; // Move to the parent
      }
      return null; // if no common ancestor is found
  };

  // Walk through the ancestors of the first commit
  walk(commitA);

  // Walk through the ancestors of the second commit
  return walk(commitB);
}

export { branchGetActive, branchCreate, branchList, findCommonAncestor };