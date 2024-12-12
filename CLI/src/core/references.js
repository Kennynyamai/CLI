import fs from "fs";
import path from "path";

// Resolve a reference to its SHA-1 value
function refResolve(repo, ref) {
  const refPath = path.join(repo.gitdir, ref);  // Construct the full path to the reference
 
  try {
    // Reference does not exist
    if (!fs.existsSync(refPath)) {
      console.error(`Reference path does not exist: ${refPath}`);
      return null;
    }

    const stat = fs.statSync(refPath);
    // Path exists but is not a valid reference
    if (!stat.isFile()) {
      console.error(`Reference path is not a file: ${refPath}`);
      return null;
    }

    const data = fs.readFileSync(refPath, "utf8").trim();
   

    if (data.startsWith("ref: ")) {
     // Indirect reference points to another reference
      const targetRef = data.slice(5);
     
      return refResolve(repo, targetRef); // Recursively resolve the target reference
    } else {   
      return data; // Direct reference resolves to a SHA-1
    }
  } catch (error) {
    console.error(`Error resolving reference ${ref}: ${error.message}`);
    return null;
  }
}

// List all references recursively and return as an object
function refList(repo, dir = "refs") {
  const refDir = path.join(repo.gitdir, dir);
  const result = {};

  if (!fs.existsSync(refDir)) {
    return result; // Return an empty object if the directory does not exist
  }

  const entries = fs.readdirSync(refDir).sort();

  for (const entry of entries) {
    const entryPath = path.join(refDir, entry);
    const entryName = path.join(dir, entry);

    if (fs.statSync(entryPath).isDirectory()) {
      // If it's a directory, recurse into it
      result[entry] = refList(repo, entryName);
    } else {
       // If it's a file, resolve its SHA-1
      result[entry] = refResolve(repo, entryName);
    }
  }

  return result;
}

// Display the references recursively
function showRef(repo, refs, prefix = "", withHash = true) {
  for (const [key, value] of Object.entries(refs)) {
    if (typeof value === "string") {
      // Direct reference
      console.log(
        `${withHash ? value + " " : ""}${prefix ? prefix + "/" : ""}${key}`
      );
    } else {
      // Nested references (directories)
      showRef(
        repo,
        value,
        `${prefix ? prefix + "/" : ""}${key}`,
        withHash
      );
    }
  }
}

// Create a new reference pointing to a given SHA-1
function refCreate(repo, refName, sha) {
  const refPath = path.join(repo.gitdir, "refs", refName);

  fs.mkdirSync(path.dirname(refPath), { recursive: true });
  fs.writeFileSync(refPath, sha + "\n", "utf8");
}

export {refResolve, refList, showRef, refCreate };