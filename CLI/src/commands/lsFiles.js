import { indexRead } from "../core/index.js";
import { repoFind } from "../core/repository.js";
import chalk from "chalk";

function cmdLsFiles(verbose = false) {
    try {
        const repo = repoFind();
        
        const index = indexRead(repo);

         // Handle case where no files are staged
        if (!index.entries || index.entries.length === 0) {
            console.log(chalk.yellow("[INFO] No files staged in the index."));
            return;
        }

        console.log(chalk.green(`[INFO] Found ${index.entries.length} staged file(s):`));

        // Iterate through index entries and display each staged file
        for (const entry of index.entries) {
            if (!entry || typeof entry.name !== "string") {
                console.error(chalk.red(`[ERROR] Invalid entry detected:`), entry);
                continue;
            }
              // Show detailed information if verbose option is enabled
            if (verbose) {
                console.log(
                    `${chalk.cyan(entry.name)} ${chalk.magenta(entry.sha)} Size: ${chalk.yellow(
                        entry.fsize
                    )} bytes`
                );
            } else {
                console.log(chalk.cyan(entry.name)); // Show only file names in non-verbose mode
            }
        }
    } catch (error) {
        console.error(chalk.redBright("[ERROR] Failed to list staged files:"));
        console.error(chalk.yellow(error.message));
    }
}

export { cmdLsFiles };