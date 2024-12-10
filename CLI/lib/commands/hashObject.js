import fs from "fs";
import { repoFind } from "../repository.js";
import { objectWrite, GitBlob, GitCommit } from "../objects.js";


// Hash object data
export function objectHash(fileData, fmt, repo = null) {
  let obj;

  switch (fmt) {
    case "blob":
      obj = new GitBlob(fileData);
      break;
    case "commit":
      obj = new GitCommit(fileData);
      break;
    case "tree":
      obj = new GitTree(fileData);
      break;
    case "tag":
      obj = new GitTag(fileData);
      break;
    default:
      throw new Error(`Unknown type ${fmt}`);
  }

  return objectWrite(obj, repo);
}

// Command bridge
export function cmdHashObject(filePath, type = "blob", write = false) {
  const repo = write ? repoFind() : null;

  const fileData = fs.readFileSync(filePath);
  const sha = objectHash(fileData, type, repo);

  console.log(sha);
}