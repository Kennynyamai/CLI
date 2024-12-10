#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { repoCreate, repoFind, repo_File } from "./repository.js";
import path from "path";
import { cmdCatFile } from "./commands/catFile.js";
import { cmdHashObject } from "./commands/hashObject.js";
import { cmdLog } from "./commands/logs.js";
import { cmdLsTree } from "./commands/lsTree.js";
import { cmdCheckout } from "./commands/checkout.js";
import { cmdLsFiles } from './commands/lsFiles.js';
import { cmdCheckIgnore } from "./commands/checkIgnore.js";
import { cmdStatus } from "./commands/status.js";
import { cmdRm } from "./commands/rm.js";
import { cmdAdd } from "./commands/add.js";
import { cmdCommit } from "./commands/commit.js";
import { branchGetActive, branchCreate, branchList } from "./branch.js";
import fs from "fs";
import { objectFind, objectRead } from "./objects.js";
import { myersDiff } from './commands/diff.js';
import { findCommonAncestor } from './branch.js';
import { mergeTrees } from './commands/merge.js';
import { cmdMerge } from "./commands/merge.js";
import { cmdDiff } from './commands/diff.js';
import { cmdClone } from './commands/clone.js';

//-------------------








// Initialize the CLI program
export function main() {
  const program = new Command();

  program
    .name("pal")
    .description("A powerful CLI application")
    .version("1.0.0");

  // Greet Command
  program
    .command("greet <name>")
    .description("Greet someone")
    .option("-e, --excited", "Add excitement")
    .action((name, options) => {
      const greeting = `Hello, ${name}${options.excited ? "!" : "."}`;
      console.log(chalk.green(greeting));
    });

  // Check-Repo Command
  program
    .command("check-repo") // Registering the command
    .description("Check for a .pal repository in the current or parent directories")
    .action(() => {
      console.log("Running check-repo command...");
      try {
        const repo = repoFind();
        console.log(chalk.green(`Pal repository found at: ${repo.worktree}`));
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    });

  // Init Command
  program
    .command("init [directory]")
    .description("Initialize a new, empty repository")
    .action((directory = ".") => {
      try {
        const repoPath = path.resolve(process.cwd(), directory);
        repoCreate(repoPath);
      } catch (error) {
        console.error(chalk.red(`Error initializing repository: ${error.message}`));
      }
    });


  program
    .command("cat-file <type> <object>")
    .description("Provide content of repository objects")
    .action((type, object) => {
      cmdCatFile(type, object);
    });

  program
    .command("hash-object <path>")
    .description("Compute object ID and optionally create a blob from a file")
    .option("-t, --type <type>", "Specify the type (blob, commit, tag, tree)", "blob")
    .option("-w, --write", "Write the object into the repository", false)
    .action((path, options) => {
      cmdHashObject(path, options.type, options.write);
    });

  program
    .command("log [commit]")
    .description("Display history of a given commit")
    .action((commit = "HEAD") => {
      try {
        cmdLog(commit);
      } catch (error) {
        console.error(`Error displaying log: ${error.message}`);
      }
    });

  // Add `ls-tree` command
  program
    .command("ls-tree <tree>")
    .description("Pretty-print a tree object")
    .option("-r, --recursive", "Recurse into sub-trees")
    .action((tree, options) => {
      try {
        cmdLsTree(tree, options);
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    });



  program
    .command("ls-files")
    .description("List all staged files")
    .option("--verbose", "Show detailed information")
    .action((options) => {
      cmdLsFiles(options.verbose);
    });

  program
    .command("check-ignore")
    .description("Check path(s) against ignore rules")
    .argument("<paths...>", "Paths to check")
    .action((paths) => {
      cmdCheckIgnore(paths);
    });


  program
    .command("status")
    .description("Show the working tree status")
    .action(() => {
      cmdStatus();
    });



  // Add the `rm` command
  program
    .command("rm <path...>")
    .description("Remove files from the working tree and the index.")
    .action((paths) => {
      try {
        cmdRm({ path: paths });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
      }
    });

  // Add the `add` command
  program
    .command("add <path...>")
    .description("Add file contents to the index.")
    .action((paths) => {
      try {
        cmdAdd({ path: paths });
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
      }
    });

  program
    .command("commit")
    .description("Record changes to the repository.")
    .option("-m <message>", "Message to associate with this commit")
    .action((opts) => {
      try {
        cmdCommit({ message: opts.m });
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
    });

  // Branch command
  program
    .command("branch [name]")
    .description("List or create branches")
    .action((name) => {
      const repo = repoFind();

      if (name) {
        try {
          branchCreate(repo, name);
          console.log(`Branch ${name} created.`);
        } catch (err) {
          console.error(`Error creating branch: ${err.message}`);
        }
      } else {
        const branches = branchList(repo);
        const activeBranch = branchGetActive(repo);

        branches.forEach((branch) => {
          const prefix = branch === activeBranch ? "*" : " ";
          console.log(`${prefix} ${branch}`);
        });
      }
    });

  program
    .command("checkout <name> [path]")
    .description("Checkout a branch or commit inside a directory (default: current directory)")
    .action((name, dir = process.cwd()) => {
      const repo = repoFind();

      try {
        const branchPath = repo_File(repo, `refs/heads/${name}`);

        // Check if the name corresponds to a branch
        if (fs.existsSync(branchPath)) {
          fs.writeFileSync(repo_File(repo, "HEAD"), `ref: refs/heads/${name}\n`);
          console.log(`Switched to branch '${name}'`);
        } else {
          // Assume the name is a commit and checkout into the directory
          console.log(`Looking for object: ${name}`);
          const sha = objectFind(repo, name);

          if (!sha) {
            throw new Error(`Branch or commit '${name}' does not exist.`);
          }

          cmdCheckout(sha, dir);
          console.log(`Checked out commit ${sha}`);
        }
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
    });



  // Add the `merge` command
  program
    .command("merge <branch>")
    .description("Merge the specified branch into the current branch")
    .action((branch) => {
      cmdMerge(branch);
    });



  program
    .command("test-merge")
    .description("Test merge functionality")
    .action(() => {
      try {
        console.log("Testing merge functionality...");

        const repo = repoFind();

        // Test 1: findCommonAncestor
        console.log("\nTest: findCommonAncestor");
        const commitA = "ed113cb3c2d88803b8ee12ab6c367ee7801f7a36"; // Initial commit SHA
        const commitB = "f3f65a70f7e016c280e8aa8e7e2fa97b3eb52b7a"; // Commit on feature2 SHA
        const ancestor = findCommonAncestor(repo, commitA, commitB);
        console.log(`Common ancestor: ${ancestor}`);

        // Test 2: mergeTrees
        console.log("\nTest: mergeTrees");
        const baseTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"; // Root tree SHA for both commits
        const currentTree = "c4dc07bf2864b1ba602933c3a8a2bd1546d64284"; // Intermediate tree SHA
        const targetTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"; // Target tree SHA for commit on feature2
        const mergedTree = mergeTrees(repo, baseTree, currentTree, targetTree);
        console.log(`Merged tree SHA: ${mergedTree}`);

        // Test 3: myersDiff
        // Test 3: myersDiff
        // Test 3: myersDiff
        console.log("\nTest: myersDiff");
        let baseContent = "line1\nline2\nline3"; // Allow reassignment with 'let'
        let targetContent = "line1\nlineX\nline3"; // Allow reassignment with 'let'
        try {
          const diff = myersDiff(baseContent, targetContent);
          console.log("Diff result:", diff);
        } catch (error) {
          console.error(`Error in myersDiff test: ${error.message}`);
        }




        console.log("\nAll tests completed successfully.");
      } catch (error) {
        console.error(`Error during testing: ${error.message}`);
      }
    });


  program
    .command("clone <source> <destination>")
    .description("Clone a repository from source to destination")
    .action((source, destination) => {
      try {
        cmdClone(source, destination);
      } catch (error) {
        console.error(chalk.red(`Error cloning repository: ${error.message}`));
      }
    });




  // In libpal.js or commands/diff.js
  program
    .command('diff <branch1> <branch2>')
    .description('Show changes between two branches or commits')
    .action(cmdDiff);



  // Parse arguments
  program.parse(process.argv);
}
