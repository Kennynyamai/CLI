import { indexRead } from "../index.js";
import { repoFind } from "../repository.js";
import chalk from "chalk";

export function cmdLsFiles(verbose = false) {
    try {
        const repo = repoFind();
       // console.log(chalk.bold.blue("[INFO] Found repository:"), repo.gitdir);

        // Read the index
        const index = indexRead(repo);

        if (!index.entries || index.entries.length === 0) {
            console.log(chalk.yellow("[INFO] No files staged in the index."));
            return;
        }

        console.log(chalk.green(`[INFO] Found ${index.entries.length} staged file(s):`));

        // Display staged files
        for (const entry of index.entries) {
            if (!entry || typeof entry.name !== "string") {
                console.error(chalk.red(`[ERROR] Invalid entry detected:`), entry);
                continue;
            }

            if (verbose) {
                console.log(
                    `${chalk.cyan(entry.name)} ${chalk.magenta(entry.sha)} Size: ${chalk.yellow(
                        entry.fsize
                    )} bytes`
                );
            } else {
                console.log(chalk.cyan(entry.name));
            }
        }
    } catch (error) {
        console.error(chalk.redBright("[ERROR] Failed to list staged files:"));
        console.error(chalk.yellow(error.message));
    }
}
