import { repoFind } from "../repository.js";
import { refList, showRef } from "../references.js";

// Command bridge for `show-ref`
export function cmdShowRef() {
  const repo = repoFind();
  const refs = refList(repo);
  showRef(repo, refs, "refs");
}
