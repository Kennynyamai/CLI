import { GitObject } from "./objects.js";

// Tree Leaf Class
export class GitTreeLeaf {
  constructor(mode, path, sha) {
    this.mode = mode; // File mode
    this.path = path; // File path
    this.sha = sha; // Object SHA
  }
}

// Helper: Parse a single tree entry
function treeParseOne(raw, start = 0) {
 // console.log(`[treeParseOne] Parsing entry at position ${start}...`);

  const spaceIndex = raw.indexOf(0x20, start);
  if (spaceIndex - start !== 5 && spaceIndex - start !== 6) {
    throw new Error("Invalid tree entry format.");
  }

  let mode = raw.slice(start, spaceIndex);
  if (mode.length === 5) {
    mode = Buffer.concat([Buffer.from(" "), mode]);
  }
 // console.log(`[treeParseOne] Parsed mode: ${mode.toString()}`);

  const nullIndex = raw.indexOf(0x00, spaceIndex);
  const path = raw.slice(spaceIndex + 1, nullIndex).toString("utf8");
 // console.log(`[treeParseOne] Parsed path: ${path}`);

  const rawSha = raw.slice(nullIndex + 1, nullIndex + 21);
  const sha = Buffer.from(rawSha).toString("hex");
  //console.log(`[treeParseOne] Parsed SHA: ${sha}`);

  return [nullIndex + 21, new GitTreeLeaf(mode.toString(), path, sha)];
}


// Helper: Parse a full tree
function treeParse(raw) {
//  console.log("[treeParse] Starting to parse raw tree data...");
  let pos = 0;
  const items = [];

  while (pos < raw.length) {
   // console.log(`[treeParse] Parsing at position ${pos}...`);
    const [newPos, data] = treeParseOne(raw, pos);
   // console.log(`[treeParse] Parsed entry: Mode=${data.mode}, Path=${data.path}, SHA=${data.sha}`);
    pos = newPos;
    items.push(data);
  }

 // console.log(`[treeParse] Completed parsing. Total items: ${items.length}`);
  return items;
}


// Helper: Sort key for tree leaves
function treeLeafSortKey(leaf) {
  return leaf.mode.toString().startsWith("10") ? leaf.path : `${leaf.path}/`;
}

// Serialize a tree object
function treeSerialize(tree) {
  tree.items.sort((a, b) => treeLeafSortKey(a).localeCompare(treeLeafSortKey(b)));

  let result = Buffer.alloc(0);
  for (const item of tree.items) {
    const entry = Buffer.concat([
      Buffer.from(item.mode + " "),
      Buffer.from(item.path, "utf8"),
      Buffer.from([0x00]),
      Buffer.from(item.sha, "hex"),
    ]);
    result = Buffer.concat([result, entry]);
  }

  return result;
}

// GitTree Class


export { treeParse, treeSerialize };
