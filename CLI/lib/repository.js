import fs from "fs";
import path from "path";
import readline from "readline";
import { objectRead } from "./objects.js";
import chalk from 'chalk';

export class GitRepository {
  constructor(worktree, force = false) {
    this.worktree = worktree;
    this.gitdir = path.join(worktree, ".pal");

    if (!force && (!fs.existsSync(this.gitdir) || !fs.statSync(this.gitdir).isDirectory())) {
      throw new Error(`Not a Pal repository: ${worktree}`);
    }

    const configPath = this.repoFile("config");
    if (!force && (!fs.existsSync(configPath) || !this.readConfig(configPath).core)) {
      throw new Error("Missing or invalid configuration file.");
    }
  }

  repoPath(...parts) {
    return path.join(this.gitdir, ...parts);
  }

  repoFile(...parts) {
    const filePath = path.join(this.gitdir, ...parts);
    const dirPath = path.dirname(filePath);

    //console.log(`Generated repository file path: ${filePath}`);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
     // console.log(`Created directory for path: ${dirPath}`);
    }

    return filePath;
  }

  readConfig(configPath) {
    const content = fs.readFileSync(configPath, "utf-8");
    const lines = content.split("\n");
    const config = {};
    let section = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        section = trimmed.slice(1, -1);
        config[section] = {};
      } else if (section && trimmed.includes("=")) {
        const [key, value] = trimmed.split("=").map((s) => s.trim());
        config[section][key] = value;
      }
    });

    return config;
  }

  async treeFromCommit(commitSha) {
    const commit = objectRead(this, commitSha);
    const treeSha = commit.kvlm.get("tree").toString("utf8");
    const tree = objectRead(this, treeSha);
    return tree.items; // List of { path, sha, mode }
  }
}

// Helper function for prompting user input
export function promptUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Create a new repository
export async function repoCreate(repoPath) {
  console.log(chalk.bold.green("\nWelcome to Pal! Let's set up your repository. 🚀\n"));

  // Prompt user for configuration
  const userName = await promptUserInput("Enter your name: ");
  const userEmail = await promptUserInput("Enter your email: ");

  console.log(chalk.bold("\n[INFO] Preparing your repository...\n"));

  try {
    // Prepare the repository
    const repo = new GitRepository(repoPath, true);

    // Validate and prepare the repository directory
    if (fs.existsSync(repo.worktree)) {
      if (!fs.statSync(repo.worktree).isDirectory()) {
        throw new Error(`[ERROR] ${repoPath} is not a directory.`);
      }
      if (fs.existsSync(repo.gitdir) && fs.readdirSync(repo.gitdir).length > 0) {
        throw new Error(`[ERROR] Repository already exists at ${repo.gitdir}`);
      }
    } else {
      fs.mkdirSync(repo.worktree, { recursive: true });
    }

    // Create required subdirectories
    ["branches", "objects", "refs/tags", "refs/heads"].forEach((dir) =>
      fs.mkdirSync(repo.repoPath(dir), { recursive: true })
    );

    // Default configuration
    let configContent = repoDefaultConfig();

    // Add user information
    configContent += `[user]\nname = ${userName}\nemail = ${userEmail}\n`;

    // Write repository files
    fs.writeFileSync(repo.repoFile("description"), "Unnamed repository; edit this file to name the repository.\n");
    fs.writeFileSync(repo.repoFile("HEAD"), "ref: refs/heads/master\n");
    fs.writeFileSync(repo.repoFile("config"), configContent);

    // Success message
    console.log(chalk.green("\n[SUCCESS] Repository initialized successfully! 🎉"));
    console.log(chalk.green(`Location: ${repo.gitdir}`));
    console.log("\nUser information:");
    console.log(`  Name:  ${chalk.blue(userName)}`);
    console.log(`  Email: ${chalk.blue(userEmail)}\n`);

    // Suggestions for next steps
    console.log(chalk.cyan("Next steps:"));
    console.log(chalk.cyan("  1. Add files to your repository using `pal add <file>`"));
    console.log(chalk.cyan("  2. Commit your changes with `pal commit -m \"your message\"`"));
    console.log(chalk.cyan("  3. Check the status of your repository using `pal status`\n"));

    console.log("For a complete list of commands, use `pal help`.");
  } catch (error) {
    console.error(chalk.red("\n[ERROR] Failed to initialize repository:"));
    console.error(`  ${error.message}\n`);
    console.log(chalk.yellow("Tips:"));
    console.log("  - Ensure that the specified path is a valid directory.");
    console.log("  - Check permissions for the specified path.");
    console.log("\nFor more help, use 'pal help'.\n");
  }
}


export function repoDefaultConfig() {
  return `[core]
repositoryformatversion = 0
filemode = false
bare = false
`;
}

export function repoFind(dir = ".", required = true) {
  const absolutePath = path.resolve(dir);
  const potentialGitDir = path.join(absolutePath, ".pal");

  if (fs.existsSync(potentialGitDir) && fs.statSync(potentialGitDir).isDirectory()) {
    return new GitRepository(absolutePath);
  }

  const parentDir = path.resolve(absolutePath, "..");

  if (parentDir === absolutePath) {
    if (required) {
      throw new Error("No Pal repository found. Please initialize a repository using `pal init`.");
    } else {
      return null;
    }
  }

  return repoFind(parentDir, required);
}



export function repo_File(repo, ...parts) {
  const filePath = path.join(repo.gitdir, ...parts);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return filePath;
}
