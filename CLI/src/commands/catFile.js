import { repoFind } from "../core/repository.js";
import { objectRead, GitTree } from "../core/objects.js";

// Function to resolve object name (currently a placeholder)
function objectFind(repo, name, fmt = null, follow = true) {
  // Extend this to resolve partial SHAs, branches, tags, etc.
  return name; // Placeholder for name resolution (full SHA only for now)
}

// Function to display the content of an object
function catFile(repo, sha, fmt = null) {
  console.log(`[catFile] Reading object with SHA: ${sha}`);
  const obj = objectRead(repo, sha);

  console.log(`[catFile] Object read with format: ${obj.fmt}`);
  if (fmt && obj.fmt !== fmt) {
    throw new Error(`Expected object type ${fmt}, but got ${obj.fmt}`);
  }

  if (obj instanceof GitTree) {
    console.log("[catFile] Tree Object:");
    console.log(`[catFile] Tree has ${obj.items.length} item(s).`);
    console.log(`[catFile] Debugging state: ${JSON.stringify(obj.items)}`);
    if (obj.items.length === 0) {
      console.log("[catFile] Tree is empty.");
    } else {
      for (const item of obj.items) {
        console.log(`[catFile] - Mode: ${item.mode}, Path: ${item.path}, SHA: ${item.sha}`);
      }
    }
  }
}




// Command bridge
function cmdCatFile(type, object) {
  try {
    const repo = repoFind();
    catFile(repo, object, type);
  } catch (error) {
    console.error(`Error in cmdCatFile: ${error.message}`);
  }
}

export { objectFind, catFile, cmdCatFile};