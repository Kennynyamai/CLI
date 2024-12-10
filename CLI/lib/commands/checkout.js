import fs from "fs";
import path from "path";
import { repoFind } from "../repository.js";
import { objectRead, objectFind } from "../objects.js";
import chalk from 'chalk';

// Recursive function to checkout a tree into a directory
function treeCheckout(repo, tree, destPath) {
  for (const item of tree.items) {
    const obj = objectRead(repo, item.sha);
    const destination = path.join(destPath, item.path);

    if (obj.fmt === "tree") {
      fs.mkdirSync(destination);
      treeCheckout(repo, obj, destination);
    } else if (obj.fmt === "blob") {
      fs.writeFileSync(destination, obj.blobdata);
    }
    // @TODO: Add support for symlinks (mode 12****)
  }
}

// Command bridge for checkout
export function cmdCheckout(commit, dir) {
  const repo = repoFind();

  try {
    console.log(chalk.cyan(`🔍 Resolving commit: ${commit}`));
    let obj = objectRead(repo, objectFind(repo, commit));

    // If the object is a commit, use its tree
    if (obj.fmt === "commit") {
      console.log(chalk.cyan(`✔️ Commit resolved. Using tree object for checkout.`));
      obj = objectRead(repo, obj.kvlm.get("tree"));
    }

    // Verify that the directory is empty
    const fullPath = path.resolve(dir);

    if (fs.existsSync(fullPath)) {
      if (!fs.statSync(fullPath).isDirectory()) {
        throw new Error(`Not a directory: ${dir}`);
      }
      if (fs.readdirSync(fullPath).length > 0) {
        throw new Error(`Directory is not empty: '${dir}'.`);
      }
    } else {
      console.log(chalk.cyan(`📂 Directory '${dir}' does not exist. Creating it...`));
      fs.mkdirSync(fullPath, { recursive: true });
    }

    console.log(chalk.cyan(`📂 Checking out tree into '${dir}'...`));
    treeCheckout(repo, obj, fullPath);
    console.log(chalk.green(`✔️  Checkout completed successfully.`));
  } catch (err) {
    console.error(chalk.red(`[ERROR] ${err.message}`));
    throw err;
  }
}
