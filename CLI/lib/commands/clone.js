import fs from "fs";
import path from "path";
import { repoFind } from "../repository.js";
import { objectRead, objectFind } from "../objects.js";
import { treeToDict } from "./status.js"; // Reuse tree-to-dict for checkout

// Utility to recursively copy a directory
function copyDirectorySync(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clone command implementation
export function cmdClone(sourcePath, destinationPath) {
  // Ensure the source is a valid repository
  const sourceRepo = repoFind(sourcePath);
  if (!sourceRepo) {
    throw new Error(`Source path '${sourcePath}' is not a valid repository.`);
  }

  console.log(`Cloning from '${sourcePath}' to '${destinationPath}'...`);

  // Create the destination directory
  if (fs.existsSync(destinationPath)) {
    throw new Error(`Destination path '${destinationPath}' already exists.`);
  }
  fs.mkdirSync(destinationPath, { recursive: true });

  // Copy the .pal directory
  const sourcePalDir = sourceRepo.gitdir;
  const destinationPalDir = path.join(destinationPath, ".pal");
  console.log(`Copying repository data from '${sourcePalDir}' to '${destinationPalDir}'...`);
  copyDirectorySync(sourcePalDir, destinationPalDir);

  // Check out the working tree files
  const repo = { worktree: destinationPath, gitdir: destinationPalDir };
  const headSha = objectFind(repo, "HEAD");
  const treeDict = treeToDict(repo, headSha);

  console.log("Checking out files to the working tree...");
  for (const [filePath, fileSha] of Object.entries(treeDict)) {
    const fullPath = path.join(repo.worktree, filePath);
    const fileData = objectRead(repo, fileSha).blobdata;

    // Ensure parent directories exist
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    // Write the file to the destination
    fs.writeFileSync(fullPath, fileData);
    console.log(`Checked out: ${filePath}`);
  }

  console.log(`Clone completed successfully.`);
}
