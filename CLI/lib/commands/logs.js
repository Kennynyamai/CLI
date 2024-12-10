import { repoFind } from "../repository.js";
import { objectFind, objectRead } from "../objects.js";

export function cmdLog(commit = "HEAD") {
  console.log("Starting log command...");

  const repo = repoFind();
  const sha = objectFind(repo, commit);
  console.log(`Resolved commit ${commit} to SHA: ${sha}`);

  console.log("Commit History:");
  console.log("================");

  let currentSha = sha;

  while (currentSha) {
    const commitObj = objectRead(repo, currentSha);
    console.log(`Processing commit: ${currentSha}`);

    const kvlm = commitObj.kvlm;
    console.debug("Deserialized KVLM:", kvlm);

    const shortSha = currentSha.slice(0, 8);
    const authorRaw = kvlm.get("author")?.toString("utf8");
    const message = kvlm.get(null)?.toString("utf8") || "(No message)";

    console.log(`Commit: ${shortSha}`);
    console.log(`Author: ${authorRaw}`);
    console.log(`Message: ${message}`);
    console.log("--------------------");

    currentSha = kvlm.get("parent")?.toString("utf8") || null;
  }

  console.log("Log command completed.");
}
