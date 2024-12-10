import { repoFind } from "../repository.js";
import { branchGetActive } from "../branch.js";
import { refResolve, refCreate } from "../references.js";
import { findCommonAncestor } from "../branch.js";
import { mergeCommitCreate } from "./commit.js";
import { objectRead, objectWrite, objectFind } from "../objects.js";
import { treeParse } from "../trees.js";
import { GitTree } from "../objects.js";
import chalk from "chalk";

export function mergeTrees(repo, baseTree, currentTree, targetTree) {
    console.log(chalk.cyanBright("\n[INFO] Starting tree merge..."));
    console.log(chalk.cyanBright(`[INFO] Base Tree: ${baseTree || "Empty Tree"}`));
    console.log(chalk.cyanBright(`[INFO] Current Tree: ${currentTree || "Empty Tree"}`));
    console.log(chalk.cyanBright(`[INFO] Target Tree: ${targetTree || "Empty Tree"}`));

    const base = baseTree ? treeParse(objectRead(repo, baseTree).serialize()) : [];
    const current = currentTree ? treeParse(objectRead(repo, currentTree).serialize()) : [];
    const target = targetTree ? treeParse(objectRead(repo, targetTree).serialize()) : [];

    const mergedTree = [];
    const conflicts = [];

    const entries = [...new Set([
        ...base.map(e => e.path),
        ...current.map(e => e.path),
        ...target.map(e => e.path),
    ])];

    for (const path of entries) {
        const baseEntry = base.find(e => e.path === path) || null;
        const currentEntry = current.find(e => e.path === path) || null;
        const targetEntry = target.find(e => e.path === path) || null;

        if (currentEntry?.sha === targetEntry?.sha) {
            mergedTree.push(currentEntry || targetEntry);
        } else if (baseEntry?.sha === currentEntry?.sha) {
            mergedTree.push(targetEntry);
        } else if (baseEntry?.sha === targetEntry?.sha) {
            mergedTree.push(currentEntry);
        } else {
            conflicts.push({ path, currentEntry, targetEntry });
        }
    }

    if (conflicts.length > 0) {
        console.warn(chalk.yellow("\n⚠️ Merge conflicts detected:"));
        conflicts.forEach(conflict => {
            console.warn(`  - ${chalk.magentaBright(conflict.path)}`);
        });
        return { mergedTree: null, conflicts };
    }

    const treeObject = new GitTree();
    treeObject.items = mergedTree.filter(Boolean);

    const treeSHA = objectWrite(treeObject, repo);
    console.log(chalk.greenBright(`\n[INFO] Merged tree created successfully with SHA: ${treeSHA}`));

    return { mergedTree: treeSHA, conflicts: [] };
}


export function cmdMerge(targetBranch) {
    console.log(chalk.cyanBright(`\n🔄 Starting merge operation...`));

    const repo = repoFind();
    const currentBranch = branchGetActive(repo);

    if (!currentBranch) {
        console.error(chalk.red("[ERROR] No active branch found. Cannot perform the merge."));
        return;
    }

    if (currentBranch === targetBranch) {
        console.error(chalk.red("[ERROR] Cannot merge a branch into itself."));
        return;
    }

    try {
        console.log(chalk.cyanBright(`[INFO] Merging branch '${chalk.bold(targetBranch)}' into '${chalk.bold(currentBranch)}'...`));

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

        const config = repo.readConfig(repo.repoFile("config"));
        const author = `${config.user.name} <${config.user.email}>`;
        const timestamp = new Date().toISOString();

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

        refCreate(repo, `refs/heads/${currentBranch}`, mergeCommitSha);
        console.log(chalk.greenBright(`\n🎉 Merge completed successfully!`));
        console.log(`New Commit SHA: ${chalk.blueBright(mergeCommitSha)}`);
        console.log(chalk.cyanBright("\nYou can view the updated history using `pal log`.\n"));
    } catch (error) {
        console.error(chalk.red(`[ERROR] Merge operation failed: ${error.message}`));
    }
}

  
