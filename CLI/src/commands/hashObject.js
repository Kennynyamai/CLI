import fs from "fs";
import { repoFind } from "../core/repository.js";
import { objectWrite, GitBlob, GitCommit } from "../core/objects.js";


// Hash object data based on type and optionally store it in the repository
function objectHash(fileData, fmt, repo = null) {
  let obj; // Placeholder for the Git object to be created

  switch (fmt) {
    case "blob":
      obj = new GitBlob(fileData); //for file data
      break;
    case "commit":
      obj = new GitCommit(fileData);
      break;
    case "tree":
      obj = new GitTree(fileData);
      break;
    case "tag":
      obj = new GitTag(fileData); //for tag data
      break;
    default:
      throw new Error(`Unknown type ${fmt}`);
  }

  return objectWrite(obj, repo); // Write the object to the repository (if repo is provided) and return its SHA
}

// Command bridge
function cmdHashObject(filePath, type = "blob", write = false) {
  const repo = write ? repoFind() : null; // Find the repository if `--write` is enabled

  const fileData = fs.readFileSync(filePath); // Read the file data from the specified path
  const sha = objectHash(fileData, type, repo); // Generate the SHA for the object and optionally write it

  console.log(sha);
}

export {objectHash, cmdHashObject };