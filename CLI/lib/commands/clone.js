import fs from "fs";
import path from "path";
import { repoFind } from "../repository.js";
import { objectRead, objectFind } from "../objects.js";
import { treeToDict } from "./status.js"; // Reuse tree-to-dict for checkout
import chalk from "chalk";

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
    const sourcePalDir = sourceRepo.gitdir;
    const destinationPalDir = path.join(destinationPath, ".pal");
    copyDirectorySync(sourcePalDir, destinationPalDir);
    console.log(chalk.greenBright(`[SUCCESS] Repository metadata copied successfully.`));

    console.log(chalk.cyanBright(`\n🔄 Checking out files into the working directory...\n`));
    const repo = { worktree: destinationPath, gitdir: destinationPalDir };
    const headSha = objectFind(repo, "HEAD");
    const treeDict = treeToDict(repo, headSha);

    for (const [filePath, fileSha] of Object.entries(treeDict)) {
      const fullPath = path.join(repo.worktree, filePath);
      const fileData = objectRead(repo, fileSha).blobdata;

      // Ensure parent directories exist
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Write the file to the destination
      fs.writeFileSync(fullPath, fileData);
      console.log(chalk.green(`✔️ Checked out: ${filePath}`));
    }

    console.log(chalk.greenBright(`\n🎉 Clone completed successfully!\n`));
    console.log(chalk.cyanBright(`Next steps:`));
    console.log(chalk.cyanBright(`  1. Change to the cloned directory: ${chalk.bold(`cd ${destinationPath}`)}`));
    console.log(chalk.cyanBright(`  2. View the repository status: ${chalk.bold(`pal status`)}\n`));
  } catch (error) {
    console.error(chalk.redBright(`[ERROR] Clone failed: ${error.message}`));
  }
}
