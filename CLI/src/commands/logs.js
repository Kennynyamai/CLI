import { repoFind } from "../core/repository.js";
import { objectFind, objectRead } from "../core/objects.js";
import chalk from 'chalk';

function cmdLog(commit = "HEAD") {
  const repo = repoFind();

  try {
    // Resolve the commit to its SHA
    const sha = objectFind(repo, commit);
    console.log(chalk.cyan(`\n📜 Commit history for branch starting at ${chalk.bold(commit)}:\n`));

    // Start traversal with the resolved SHA
    let currentSha = sha;

    while (currentSha) {
      const commitObj = objectRead(repo, currentSha);
      const kvlm = commitObj.kvlm; // Key-Value List Model (commit metadata)

      // Extract commit details
      const shortSha = currentSha.slice(0, 8); // Shorten SHA for display
      const authorRaw = kvlm.get("author")?.toString("utf8");
      const message = kvlm.get(null)?.toString("utf8") || "(No message)";
      const parentSha = kvlm.get("parent")?.toString("utf8");

      // Display commit details
      console.log(chalk.yellow.bold(`Commit: ${shortSha}`));
      console.log(`Author: ${chalk.green(authorRaw)}`);
      console.log(`Message: ${chalk.white(message)}`);
      if (parentSha) {
        console.log(`Parent: ${chalk.blue(parentSha.slice(0, 8))}`);
      }
      console.log(chalk.gray("------------------------------------------------"));

      // Move to parent commit
      currentSha = parentSha || null;
    }

    console.log(chalk.green("\n✔️ Log display completed successfully.\n"));
  } catch (error) {
    console.error(chalk.red(`\n[ERROR] Unable to display log: ${error.message}\n`));
  }
}

export { cmdLog };