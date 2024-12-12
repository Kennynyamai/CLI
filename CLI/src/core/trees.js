
// Represents a single entry in a Git tree object
export class GitTreeLeaf {
  constructor(mode, path, sha) {
    this.mode = mode; // File mode
    this.path = path; // File path
    this.sha = sha; // Object SHA
  }
}

// Parse a single tree entry from raw data
function treeParseOne(raw, start = 0) {


  const spaceIndex = raw.indexOf(0x20, start); // Find the first space (separates mode and path)
  if (spaceIndex - start !== 5 && spaceIndex - start !== 6) {
    throw new Error("Invalid tree entry format.");
  }

  let mode = raw.slice(start, spaceIndex);  // Extract the mode
  if (mode.length === 5) {
    mode = Buffer.concat([Buffer.from(" "), mode]);
  }


  const nullIndex = raw.indexOf(0x00, spaceIndex);  // Find null byte (separates path and SHA)
  const path = raw.slice(spaceIndex + 1, nullIndex).toString("utf8"); // Extract the file path

  const rawSha = raw.slice(nullIndex + 1, nullIndex + 21); // Extract raw SHA (20 bytes)
  const sha = Buffer.from(rawSha).toString("hex"); // Convert SHA to hexadecimal string


  return [nullIndex + 21, new GitTreeLeaf(mode.toString(), path, sha)]; // Return the parsed entry and updated position
}


// Parse an entire tree object from raw data
function treeParse(raw) {

  let pos = 0; // Start parsing from the beginning
  const items = []; // Collect tree entries

  while (pos < raw.length) {
    const [newPos, data] = treeParseOne(raw, pos); //parse each entry
    pos = newPos;
    items.push(data);
  }


  return items; // Return the complete list of parsed entries
}


// Directories are sorted before files (indicated by a trailing '/')
function treeLeafSortKey(leaf) {
  return leaf.mode.toString().startsWith("10") ? leaf.path : `${leaf.path}/`;
}

// Serialize a tree object into raw data
function treeSerialize(tree) {
  // Directories are sorted before files (indicated by a trailing '/')
  tree.items.sort((a, b) => treeLeafSortKey(a).localeCompare(treeLeafSortKey(b)));

  let result = Buffer.alloc(0);
  for (const item of tree.items) {
    // Construct a single tree entry: [mode] [path]\0[SHA]
    const entry = Buffer.concat([
      Buffer.from(item.mode + " "),
      Buffer.from(item.path, "utf8"),
      Buffer.from([0x00]),
      Buffer.from(item.sha, "hex"),
    ]);
    result = Buffer.concat([result, entry]); // Append entry to the result, which is the tree data
  }

  return result;
}



export { treeParse, treeSerialize };
