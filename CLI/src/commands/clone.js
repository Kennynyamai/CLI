import fs from "fs";
import path from "path";
import { repoFind } from "../core/repository.js";
import { objectRead, objectFind } from "../core/objects.js";
import { treeToDict } from "./status.js"; // Reuse tree-to-dict function for checkout
import chalk from "chalk";

// Recursively copy a directory from source to destination
function copyDirectorySync(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true }); // Create the destination directory if it doesn't exist
  }
  // Get all entries in the source directory
  const entries = fs.readdirSync(source, { withFileTypes: true }); 
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name); // Full path of the source entry
    const destPath = path.join(destination, entry.name); // Corresponding destination path

    if (entry.isDirectory()) {
       // Recursively copy subdirectories
      copyDirectorySync(srcPath, destPath);
    } else if (entry.isFile()) {
      // Copy individual files
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clone command implementation
function cmdClone(sourcePath, destinationPath) {
  try {
    console.log(chalk.cyanBright(`\n🔄 Cloning repository...`));
    console.log(chalk.cyanBright(`Source: ${chalk.bold(sourcePath)}`));
    console.log(chalk.cyanBright(`Destination: ${chalk.bold(destinationPath)}\n`));
   
    // Ensure the source is a valid repository
    const sourceRepo = repoFind(sourcePath);
    
    if (!sourceRepo) {
      throw new Error(`Source path '${sourcePath}' is not a valid repository.`);
    }

    // Create the destination directory
    if (fs.existsSync(destinationPath)) {
      throw new Error(`Destination path '${destinationPath}' already exists.`);
    }
    
    fs.mkdirSync(destinationPath, { recursive: true });

    console.log(chalk.cyanBright(`[INFO] Copying repository metadata...`));
    const sourcePalDir = sourceRepo.gitdir; // Path to the source `.pal` directory
    const destinationPalDir = path.join(destinationPath, ".pal"); // Path to the destination `.pal` directory
    copyDirectorySync(sourcePalDir, destinationPalDir); // Copy the repository's metadata
    console.log(chalk.greenBright(`[SUCCESS] Repository metadata copied successfully.`));

    console.log(chalk.cyanBright(`\n🔄 Checking out files into the working directory...\n`));
    const repo = { worktree: destinationPath, gitdir: destinationPalDir }; // Define the cloned repository structure
    const headSha = objectFind(repo, "HEAD"); // Find the commit pointed to by HEAD
    const treeDict = treeToDict(repo, headSha); // Parse the commit tree into a dictionary of file paths and their SHAs

    for (const [filePath, fileSha] of Object.entries(treeDict)) {
      const fullPath = path.join(repo.worktree, filePath); // Full path to the file in the working directory
      const fileData = objectRead(repo, fileSha).blobdata; // Read the file content from the repository

      // Ensure parent directories exist
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Write the file to the destination
      fs.writeFileSync(fullPath, fileData);
      console.log(chalk.green(`✔️ Checked out: ${filePath}`));
    }

    console.log(chalk.greenBright(`\n🎉 Clone completed successfully!\n`));
    console.log(chalk.cyanBright(`Next steps:`));
    console.log(chalk.cyanBright(`  1. Change to the cloned directory: ${chalk.bold(`cd ${destinationPath}`)}`));
  } catch (error) {
    console.error(chalk.redBright(`[ERROR] Clone failed: ${error.message}`));
  }
}

export {cmdClone };