import fs from "fs";
import path from "path";

// Resolve a reference to its SHA-1 value
export function refResolve(repo, ref) {
  const refPath = path.join(repo.gitdir, ref);
  console.log(`Resolving reference: ${ref}, Path: ${refPath}`);

  try {
    if (!fs.existsSync(refPath)) {
      console.error(`Reference path does not exist: ${refPath}`);
      return null;
    }

    const stat = fs.statSync(refPath);
    if (!stat.isFile()) {
      console.error(`Reference path is not a file: ${refPath}`);
      return null;
    }

    const data = fs.readFileSync(refPath, "utf8").trim();
    console.log(`Reference content: ${data}`);

    if (data.startsWith("ref: ")) {
      // Indirect reference
      const targetRef = data.slice(5);
      console.log(`Reference ${ref} points to another ref: ${targetRef}`);
      return refResolve(repo, targetRef);
    } else {
      // Direct reference
      console.log(`Reference ${ref} resolved to SHA: ${data}`);
      return data;
    }
  } catch (error) {
    console.error(`Error resolving reference ${ref}: ${error.message}`);
    return null;
  }
}

// List all references recursively and return as an object
export function refList(repo, dir = "refs") {
  const refDir = path.join(repo.gitdir, dir);
  const result = {};

  if (!fs.existsSync(refDir)) {
    return result;
  }

  const entries = fs.readdirSync(refDir).sort();

  for (const entry of entries) {
    const entryPath = path.join(refDir, entry);
    const entryName = path.join(dir, entry);

    if (fs.statSync(entryPath).isDirectory()) {
      result[entry] = refList(repo, entryName);
    } else {
      result[entry] = refResolve(repo, entryName);
    }
  }

  return result;
}

// Display the references recursively
export function showRef(repo, refs, prefix = "", withHash = true) {
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

// Create a reference
export function refCreate(repo, refName, sha) {
  const refPath = path.join(repo.gitdir, "refs", refName);

  fs.mkdirSync(path.dirname(refPath), { recursive: true });
  fs.writeFileSync(refPath, sha + "\n", "utf8");
}
