import { repoFind } from "./repository.js";
import { refResolve, refCreate } from "./references.js";
import { objectRead } from "./objects.js";
import fs from "fs";
import path from "path";

// Get the active branch
export function branchGetActive(repo) {
  const headPath = repo.repoFile("HEAD");
  console.log(`HEAD file path: ${headPath}`);

  if (!fs.existsSync(headPath)) {
    console.warn("HEAD file does not exist.");
    return null;
  }

  const headContent = fs.readFileSync(headPath, "utf-8").trim();
  console.log("HEAD file content:", headContent);

  if (headContent.startsWith("ref:")) {
    const branch = headContent.replace("ref: refs/heads/", "").trim();
    console.log("Active branch resolved:", branch);
    return branch;
  }

  console.warn("HEAD does not reference a branch. Returning null.");
  return null;
}


// Create a new branch
export function branchCreate(repo, name, startPoint = "HEAD") {
  const sha = refResolve(repo, startPoint);

  if (!sha) {
    throw new Error(`Invalid start point: ${startPoint}`);
  }

  refCreate(repo, `heads/${name}`, sha);
}

// List all branches
export function branchList(repo) {
  const branchesDir = path.join(repo.gitdir, "refs", "heads");
  const branches = [];

  if (fs.existsSync(branchesDir)) {
    fs.readdirSync(branchesDir).forEach((branch) => {
      branches.push(branch);
    });
  }

  return branches;
}





export function findCommonAncestor(repo, commitA, commitB) {
  const visited = new Set();

  const walk = (sha) => {
      while (sha) {
          if (visited.has(sha)) {
              console.log(`Common ancestor found: ${sha}`);
              return sha; // Return immediately when a common ancestor is found
          }
          visited.add(sha);

          console.log(`Visiting commit: ${sha}`);
          const commit = objectRead(repo, sha);

          sha = commit.kvlm.get("parent")?.toString("utf8") || null; // Move to the parent
      }
      return null; // Return null if the traversal reaches the root
  };

  // Walk the first commit and record its ancestors
  walk(commitA);

  // Walk the second commit and find the common ancestor
  return walk(commitB);
}
