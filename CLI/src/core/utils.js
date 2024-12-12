import path from "path";
import fs from "fs";

// Compute a path under the repository's .git directory
function repoPath(repo, ...pathParts) {
  return path.join(repo.gitdir, ...pathParts);
}

// Create a file path under the repository's .git directory
function repoFile(repo, ...pathParts) {
  const filePath = repoPath(repo, ...pathParts);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return filePath;
}

// Create a directory path under the repository's .git directory
function repoDir(repo, ...pathParts) {
  const dirPath = repoPath(repo, ...pathParts);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return dirPath;
}

export { repoPath, repoFile, repoDir };