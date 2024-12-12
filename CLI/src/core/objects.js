//object.js
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { kvlmSerialize, kvlmParse } from '../commands/commit_utils.js';
import { treeParse, treeSerialize } from './trees.js';
import { refResolve } from "./references.js";

// Base class for Git objects
class GitObject {
  constructor(data = null) {
    if (data) {
      this.deserialize(data);
    } else {
      this.init();
    }
  }
  // Serialization and deserialization must be implemented by subclasses
  serialize() {
    throw new Error("Unimplemented!");
  }

  deserialize(data) {
    throw new Error("Unimplemented!");
  }

  init() {
    // Default behavior for initializing an empty object
  }
}

// Class for Git blobs (file contents)
class GitBlob extends GitObject {
  constructor(data = null) {
    super(data);
    this.fmt = "blob";
  }

  serialize() {
    return this.blobdata;
  }

  deserialize(data) {
    this.blobdata = data;
  }
}

// Class for Git commits
class GitCommit extends GitObject {
  constructor(data = null) {
    super(data);
    this.fmt = "commit";
  }

  deserialize(data) {
    this.kvlm = kvlmParse(data); // Parse commit data into key-value format

  }

  serialize() {
   // Serialize key-value format back to raw data
    return kvlmSerialize(this.kvlm);
  }

  init() {
    this.kvlm = new Map();  // Initialize an empty key-value map
  }
}

// Class for Git trees (directory structures)
class GitTree extends GitObject {
  constructor(data = null) {
    super(data);
    this.fmt = "tree";
    if (!data) {
      this.items = [];
    }
  }

  deserialize(data) {
    try {
      this.items = treeParse(data); // Parse tree data into items
    } catch (error) {
      throw error; 
    }
  }

  serialize() {
    try {
      return treeSerialize(this);
    } catch (error) {
      throw error; 
    }
  }
}



// Class for Git tags
class GitTag extends GitObject {
  constructor(data = null) {
    super(data);
    this.fmt = "tag";
  }

  deserialize(data) {
    this.kvlm = kvlmParse(data);
  }

  serialize() {
    return kvlmSerialize(this.kvlm);
  }

  init() {
    this.kvlm = new Map();
  }
}

// Read a Git object by SHA
function objectRead(repo, sha) {
  const objectPath = path.join(repo.gitdir, "objects", sha.substring(0, 2), sha.substring(2));

  if (!fs.existsSync(objectPath)) {
    throw new Error(`Object not found: ${sha}`);
  }

  const raw = zlib.inflateSync(fs.readFileSync(objectPath)); // Decompress object data
  const spaceIndex = raw.indexOf(0x20); // Format and size separator
  const nullIndex = raw.indexOf(0x00, spaceIndex); // Header and content separator

  const fmt = raw.slice(0, spaceIndex).toString("utf8");
  const size = parseInt(raw.slice(spaceIndex + 1, nullIndex).toString("utf8"));
  const content = raw.slice(nullIndex + 1);

  if (content.length !== size) {
    throw new Error(`Malformed object ${sha}: Expected length ${size}, but got ${content.length}`);
  }

  let obj;
  switch (fmt) {
    case "blob":
      obj = new GitBlob(content);
      break;
    case "commit":
      obj = new GitCommit(content);
      break;
    case "tree":
      obj = new GitTree(content);
      break;
    default:
      throw new Error(`Unknown object type: ${fmt}`);
  }

  obj.sha = sha; // Attach the SHA to the object
  return obj;
}



// Write a Git object to the repository
function objectWrite(obj, repo) {
  const data = obj.serialize();
  const header = `${obj.fmt} ${data.length}\x00`;
  const store = Buffer.concat([Buffer.from(header), data]);

  const sha = crypto.createHash("sha1").update(store).digest("hex");

  const objectPath = path.join(repo.gitdir, "objects", sha.substring(0, 2), sha.substring(2));
  

  if (!fs.existsSync(objectPath)) {
    fs.mkdirSync(path.dirname(objectPath), { recursive: true }); // Ensure directory exists
    fs.writeFileSync(objectPath, zlib.deflateSync(store)); // Write compressed object
  }

  return sha;
}


// Resolve references to objects
function objectResolve(repo, name) {
  // Resolve a name to potential SHA candidates
  const candidates = [];
  const hashRegex = /^[0-9A-Fa-f]{4,40}$/;

  if (!name.trim()) {
    return null;
  }

  if (name === "HEAD") {
    const resolved = refResolve(repo, "HEAD"); // Resolve HEAD reference
    return resolved ? [resolved] : [];
  }

  if (hashRegex.test(name)) {
     // Check if name matches an object hash prefix
    name = name.toLowerCase();
    const prefix = name.substring(0, 2);
    const dir = path.join(repo.gitdir, "objects", prefix);

    if (fs.existsSync(dir)) {
      const rem = name.substring(2);
      fs.readdirSync(dir).forEach((file) => {
        if (file.startsWith(rem)) {
          candidates.push(prefix + file);
        }
      });
    }
  }

  const asTag = refResolve(repo, `refs/tags/${name}`);
  if (asTag) candidates.push(asTag);

  const asBranch = refResolve(repo, `refs/heads/${name}`);
  if (asBranch) candidates.push(asBranch);

  return candidates;
}

// Find an object by name, format, and optionally follow references
function objectFind(repo, name, fmt = null, follow = true) {
  try {
    let sha = null;

    if (name === "HEAD") {
      sha = refResolve(repo, "HEAD");
      if (!sha) {
        throw new Error("Cannot resolve HEAD to a valid commit.");
      }
    } else {
      sha = name; 
    }

    let objSha = sha;

    while (true) {
      const obj = objectRead(repo, objSha);

      if (fmt === null || obj.fmt === fmt) {
        return objSha;
      }

      if (!follow) {
        return null; // Stop following references
      }

      if (obj.fmt === "tag") {
        objSha = obj.kvlm.get("object").toString("utf8");
      } else if (obj.fmt === "commit" && fmt === "tree") {
        objSha = obj.kvlm.get("tree").toString("utf8");
      } else {
        throw new Error(`Unexpected object format encountered: ${obj.fmt}`);
      }
    }
  } catch (error) {
    throw new Error(`Failed to find object '${name}': ${error.message}`);
  }
}


export { GitObject, GitBlob, GitCommit, GitTree, GitTag, objectRead, objectWrite, objectFind, objectResolve };
