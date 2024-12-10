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
    console.log("[mergeTrees] Entering mergeTrees...");
    console.log("[mergeTrees] Base Tree SHA:", baseTree || "Empty Tree");
    console.log("[mergeTrees] Current Tree SHA:", currentTree || "Empty Tree");
    console.log("[mergeTrees] Target Tree SHA:", targetTree || "Empty Tree");

    const base = baseTree ? treeParse(objectRead(repo, baseTree).serialize()) : [];
    const current = currentTree ? treeParse(objectRead(repo, currentTree).serialize()) : [];
    const target = targetTree ? treeParse(objectRead(repo, targetTree).serialize()) : [];

    console.log("[mergeTrees] Parsed Base Tree:", base);
    console.log("[mergeTrees] Parsed Current Tree:", current);
    console.log("[mergeTrees] Parsed Target Tree:", target);

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
        console.warn("[mergeTrees] Merge conflicts detected:", conflicts);
        return { mergedTree: null, conflicts };
    }

    const treeObject = new GitTree();
    treeObject.items = mergedTree.filter(Boolean);

    const treeSHA = objectWrite(treeObject, repo);
    console.log("[mergeTrees] Merged Tree SHA:", treeSHA);
    return { mergedTree: treeSHA, conflicts: [] };
}

export function cmdMerge(targetBranch) {
    console.log("[cmdMerge] Entering cmdMerge...");
    const repo = repoFind();
    const currentBranch = branchGetActive(repo);

    console.log("[cmdMerge] Current Branch:", currentBranch);
    console.log("[cmdMerge] Target Branch:", targetBranch);

    if (!currentBranch) {
        console.error("[cmdMerge] Error: No active branch found.");
        return;
    }

    if (currentBranch === targetBranch) {
        console.error("[cmdMerge] Error: Cannot merge a branch into itself.");
        return;
    }

    try {
        console.log(`[cmdMerge] Merging branch '${targetBranch}' into '${currentBranch}'...`);

        const currentCommit = refResolve(repo, `refs/heads/${currentBranch}`);
        const targetCommit = refResolve(repo, `refs/heads/${targetBranch}`);

        console.log("[cmdMerge] Current Commit SHA:", currentCommit);
        console.log("[cmdMerge] Target Commit SHA:", targetCommit);

        if (!currentCommit || !targetCommit) {
            console.error(`[cmdMerge] Error: Unable to resolve branches '${currentBranch}' or '${targetBranch}' to commits.`);
            return;
        }

        const ancestorCommit = findCommonAncestor(repo, currentCommit, targetCommit);
        console.log("[cmdMerge] Common Ancestor Commit SHA:", ancestorCommit);

        // Debug logs for objectFind
        const baseTreeObject = objectFind(repo, ancestorCommit, "tree");
        const currentTreeObject = objectFind(repo, currentCommit, "tree");
        const targetTreeObject = objectFind(repo, targetCommit, "tree");

        console.log("[cmdMerge] Base Tree Object:", baseTreeObject);
        console.log("[cmdMerge] Current Tree Object:", currentTreeObject);
        console.log("[cmdMerge] Target Tree Object:", targetTreeObject);

        // Ensure objectRead works correctly
        const baseTree = baseTreeObject ? objectRead(repo, baseTreeObject).sha : null;
        const currentTree = currentTreeObject ? objectRead(repo, currentTreeObject).sha : null;
        const targetTree = targetTreeObject ? objectRead(repo, targetTreeObject).sha : null;

        console.log("[cmdMerge] Base Tree SHA:", baseTree);
        console.log("[cmdMerge] Current Tree SHA:", currentTree);
        console.log("[cmdMerge] Target Tree SHA:", targetTree);

        if (!baseTree || !currentTree || !targetTree) {
            console.error("[cmdMerge] Error: Unable to resolve tree objects for merge.");
            return;
        }

        const { mergedTree, conflicts } = mergeTrees(repo, baseTree, currentTree, targetTree);

        if (conflicts.length > 0) {
            console.warn("[cmdMerge] Merge resulted in conflicts. Resolve conflicts manually and commit.");
            return;
        }

        const config = repo.readConfig(repo.repoFile("config"));
        const author = `${config.user.name} <${config.user.email}>`;
        const timestamp = new Date().toISOString();

        const mergeCommitMessage = `Merge branch '${targetBranch}' into '${currentBranch}'`;
        console.log("Timestamp for merge commit:", timestamp);
        const mergeCommitSha = mergeCommitCreate(
            repo,
            mergedTree,
            [currentCommit, targetCommit],
            author,
            timestamp,
            mergeCommitMessage
        );

        refCreate(repo, `refs/heads/${currentBranch}`, mergeCommitSha);
        console.log("[cmdMerge] Merge completed successfully. New Commit SHA:", mergeCommitSha);
    } catch (error) {
        console.error("[cmdMerge] Error during merge:", error);
    }
}
