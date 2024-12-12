import { repoFind } from "../core/repository.js";
import { branchGetActive } from "../core/branch.js";
import { refResolve, refCreate } from "../core/references.js";
import { findCommonAncestor } from "../core/branch.js";
import { mergeCommitCreate } from "./commit.js";
import { objectRead, objectWrite, objectFind } from "../core/objects.js";
import { treeParse } from "../core/trees.js";
import { GitTree } from "../core/objects.js";
import chalk from "chalk";

function mergeTrees(repo, baseTree, currentTree, targetTree) {
    console.log(chalk.cyanBright("\n[INFO] Starting tree merge..."));
    console.log(chalk.cyanBright(`[INFO] Base Tree: ${baseTree || "Empty Tree"}`));
    console.log(chalk.cyanBright(`[INFO] Current Tree: ${currentTree || "Empty Tree"}`));
    console.log(chalk.cyanBright(`[INFO] Target Tree: ${targetTree || "Empty Tree"}`));

    // Parse base, current, and target trees into lists of entries
    const base = baseTree ? treeParse(objectRead(repo, baseTree).serialize()) : [];
    const current = currentTree ? treeParse(objectRead(repo, currentTree).serialize()) : [];
    const target = targetTree ? treeParse(objectRead(repo, targetTree).serialize()) : [];

    const mergedTree = []; // Resulting merged tree
    const conflicts = []; // List of conflicts

    // Collect unique file paths from all trees
    const entries = [...new Set([
        ...base.map(e => e.path),
        ...current.map(e => e.path),
        ...target.map(e => e.path),
    ])];

    // Process each file path and handle merging logic
    for (const path of entries) {
        const baseEntry = base.find(e => e.path === path) || null;
        const currentEntry = current.find(e => e.path === path) || null;
        const targetEntry = target.find(e => e.path === path) || null;

        // Decide merge action based on tree entries
        if (currentEntry?.sha === targetEntry?.sha) {
            mergedTree.push(currentEntry || targetEntry); // No changes between current and target
        } else if (baseEntry?.sha === currentEntry?.sha) {
            mergedTree.push(targetEntry);  // Change only in target
        } else if (baseEntry?.sha === targetEntry?.sha) {
            mergedTree.push(currentEntry); // Change only in current
        } else {
            conflicts.push({ path, currentEntry, targetEntry }); // Conflict detected
        }
    }

    // Handle merge conflicts
    if (conflicts.length > 0) {
        console.warn(chalk.yellow("\n⚠️ Merge conflicts detected:"));
        conflicts.forEach(conflict => {
            console.warn(`  - ${chalk.magentaBright(conflict.path)}`);
        });
        return { mergedTree: null, conflicts };
    }

    // Serialize and save the merged tree
    const treeObject = new GitTree();
    treeObject.items = mergedTree.filter(Boolean);

    const treeSHA = objectWrite(treeObject, repo);
    console.log(chalk.greenBright(`\n[INFO] Merged tree created successfully with SHA: ${treeSHA}`));

    return { mergedTree: treeSHA, conflicts: [] };
}


function cmdMerge(targetBranch) {
    console.log(chalk.cyanBright(`\n🔄 Starting merge operation...`));

    const repo = repoFind();
    const currentBranch = branchGetActive(repo);

    // Ensure an active branch is checked out
    if (!currentBranch) {
        console.error(chalk.red("[ERROR] No active branch found. Cannot perform the merge."));
        return;
    }

    // Prevent merging a branch into itself
    if (currentBranch === targetBranch) {
        console.error(chalk.red("[ERROR] Cannot merge a branch into itself."));
        return;
    }

    try {
        console.log(chalk.cyanBright(`[INFO] Merging branch '${chalk.bold(targetBranch)}' into '${chalk.bold(currentBranch)}'...`));
        
        // Resolve the commits for the current and target branches
        const currentCommit = refResolve(repo, `refs/heads/${currentBranch}`);
        const targetCommit = refResolve(repo, `refs/heads/${targetBranch}`);

        if (!currentCommit || !targetCommit) {
            console.error(chalk.red(`[ERROR] Unable to resolve branches '${currentBranch}' or '${targetBranch}' to commits.`));
            return;
        }

        const ancestorCommit = findCommonAncestor(repo, currentCommit, targetCommit);

        console.log(chalk.cyanBright("\n[INFO] Resolving merge trees..."));
        const baseTree = ancestorCommit ? objectFind(repo, ancestorCommit, "tree") : null;
        const currentTree = objectFind(repo, currentCommit, "tree");
        const targetTree = objectFind(repo, targetCommit, "tree");

        const { mergedTree, conflicts } = mergeTrees(repo, baseTree, currentTree, targetTree);

        if (conflicts.length > 0) {
            console.warn(chalk.yellowBright("\n⚠️ Merge resulted in conflicts. Resolve the conflicts manually."));
            return;
        }

        const config = repo.readConfig(repo.repoFile("config")); // Read user details from config
        const author = `${config.user.name} <${config.user.email}>`;
        const timestamp = new Date().toISOString();

        // Create a new merge commit
        const mergeCommitMessage = `Merge branch '${targetBranch}' into '${currentBranch}'`;
        console.log(chalk.cyanBright("\n[INFO] Creating merge commit..."));
        const mergeCommitSha = mergeCommitCreate(
            repo,
            mergedTree,
            [currentCommit, targetCommit],
            author,
            timestamp,
            mergeCommitMessage
        );

        // Update the current branch reference to point to the merge commit
        refCreate(repo, `refs/heads/${currentBranch}`, mergeCommitSha);
        console.log(chalk.greenBright(`\n🎉 Merge completed successfully!`));
        console.log(`New Commit SHA: ${chalk.blueBright(mergeCommitSha)}`);
        console.log(chalk.cyanBright("\nYou can view the updated history using `pal log`.\n"));
    } catch (error) {
        console.error(chalk.red(`[ERROR] Merge operation failed: ${error.message}`));
    }
}

export { mergeTrees, cmdMerge };
