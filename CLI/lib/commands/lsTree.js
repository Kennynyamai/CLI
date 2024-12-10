import path from "path";
import { repoFind } from "../repository.js";
import { objectRead, objectFind } from "../objects.js";

// Helper function to list tree contents
export function lsTree(repo, ref, recursive = false, prefix = "") {
  const sha = objectFind(repo, ref, "tree");
  const obj = objectRead(repo, sha);

  for (const item of obj.items) {
    let type;

    // Determine type based on mode
    if (item.mode.startsWith("04")) {
      type = "tree";
    } else if (item.mode.startsWith("10") || item.mode.startsWith("12")) {
      type = "blob";
    } else if (item.mode.startsWith("16")) {
      type = "commit";
    } else {
      throw new Error(`Weird tree leaf mode: ${item.mode}`);
    }

    // Print the tree item
    if (!(recursive && type === "tree")) {
      console.log(
        `${item.mode.padStart(6, "0")} ${type} ${item.sha}\t${path.join(
          prefix,
          item.path
        )}`
      );
    } else {
      // Recurse into subtree
      lsTree(repo, item.sha, recursive, path.join(prefix, item.path));
    }
  }
}

// Command bridge
export function cmdLsTree(tree, options) {
  const repo = repoFind();
  lsTree(repo, tree, options.recursive);
}
