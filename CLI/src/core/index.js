import fs from "fs";
import path from "path";

// Represents a single entry in the Git index
class GitIndexEntry {
  constructor({ ctime, mtime, dev, ino, modeType, modePerms, uid, gid, fsize, sha, name }) {
      this.ctime = ctime; // Creation time
      this.mtime = mtime; // Modification time
      this.dev = dev; // Device
      this.ino = ino; // Inode
      this.modeType = modeType; // File type
      this.modePerms = modePerms; // Permissions
      this.uid = uid; // User ID
      this.gid = gid; // Group ID
      this.fsize = fsize; // File size
      this.sha = sha; // SHA-1 hash
      this.name = name; // File name
  }

  // Create an entry from raw data
  static fromRawData(rawData) {
      console.log(`Creating GitIndexEntry from raw data:`, rawData);
      return new GitIndexEntry(rawData);
  }
}



// Represents the Git index file
class GitIndex {
  constructor({ version = 2, entries = [] } = {}) {
    this.version = version; // Index version (default is 2)
    this.entries = entries; 
  }
}

// Read the index file and parse its entries
function indexRead(repo) {
  const indexPath = path.join(repo.gitdir, "index");
  if (!fs.existsSync(indexPath)) {
    console.log("Index file does not exist, returning empty index.");
    return { entries: [] }; // Return an empty index if the file is missing
  }

  const buffer = fs.readFileSync(indexPath); 
 
 // Parse the index header
  const signature = buffer.slice(0, 4).toString();
  const version = buffer.readUInt32BE(4);
  const numEntries = buffer.readUInt32BE(8);
 

  if (signature !== "DIRC" || version !== 2) {
    throw new Error("Invalid index file");
  }

  let offset = 12; // Start reading entries after the header
  const entries = [];

  for (let i = 0; i < numEntries; i++) {
    try {
      const entry = parseIndexEntry(buffer, offset);
      entries.push(entry.entry); // Parse and add each entry to the list
      offset = entry.offset; // Update offset to the next entry
    } catch (err) {
      console.error(`Error parsing entry at offset ${offset}:`, err.message);
      break; 
    }
  }


  return { entries };
}

// Parse a single index entry
function parseIndexEntry(buffer, offset) {
  const ctimeSec = buffer.readUInt32BE(offset);
  const ctimeNano = buffer.readUInt32BE(offset + 4);
  const mtimeSec = buffer.readUInt32BE(offset + 8);
  const mtimeNano = buffer.readUInt32BE(offset + 12);
  const dev = buffer.readUInt32BE(offset + 16);
  const ino = buffer.readUInt32BE(offset + 20);
  const mode = buffer.readUInt32BE(offset + 24);
  const uid = buffer.readUInt32BE(offset + 28);
  const gid = buffer.readUInt32BE(offset + 32);
  const fsize = buffer.readUInt32BE(offset + 36);
  const sha = buffer.slice(offset + 40, offset + 60).toString("hex");
  const flags = buffer.readUInt16BE(offset + 60);

  const nameLength = flags & 0xfff; // Extract file name length
  const nameStart = offset + 62;
  const nameEnd = nameStart + nameLength;
  const name = buffer.slice(nameStart, nameEnd).toString();

  const entrySize = 62 + nameLength + 1; // Calculate size of this entry
  const padding = (8 - (entrySize % 8)) % 8; // Align entry size to 8-byte boundary
  offset = nameStart + nameLength + 1 + padding; // Update offset for the next entry

  return {
    entry: {
      ctime: [ctimeSec, ctimeNano],
      mtime: [mtimeSec, mtimeNano],
      dev,
      ino,
      modeType: mode >>> 12,
      modePerms: mode & 0xfff,
      uid,
      gid,
      fsize,
      sha,
      name,
    },
    offset,
  };
}




// Write the index to the repository
function indexWrite(repo, index) {
  const indexPath = path.join(repo.gitdir, "index");
  

  const file = fs.openSync(indexPath, "w");
  // Write the index header
  fs.writeSync(file, Buffer.from("DIRC")); // Signature
  const versionBuffer = Buffer.alloc(4);
  versionBuffer.writeUInt32BE(2);
  fs.writeSync(file, versionBuffer);

  const entryCountBuffer = Buffer.alloc(4);
  entryCountBuffer.writeUInt32BE(index.entries.length);
  fs.writeSync(file, entryCountBuffer);

  for (const entry of index.entries) {
    if (!entry) {
      continue; // Skip null entries
    }

   
     // Serialize and write entry fields
    const toUInt32 = (value) => {
      if (value < 0 || value > 4294967295) {
       
        value = value & 0xffffffff; // Ensure value fits in 32 bits
      }
      return value >>> 0;
    };

    // Write timestamps, device, inode, mode, owner info, size, SHA, and flags
    const ctimeSecBuffer = Buffer.alloc(4);
    const ctimeNanoBuffer = Buffer.alloc(4);
    ctimeSecBuffer.writeUInt32BE(toUInt32(entry.ctime[0], "ctime[0]"));
    ctimeNanoBuffer.writeUInt32BE(toUInt32(entry.ctime[1], "ctime[1]"));
    fs.writeSync(file, ctimeSecBuffer);
    fs.writeSync(file, ctimeNanoBuffer);

    const mtimeSecBuffer = Buffer.alloc(4);
    const mtimeNanoBuffer = Buffer.alloc(4);
    mtimeSecBuffer.writeUInt32BE(toUInt32(entry.mtime[0], "mtime[0]"));
    mtimeNanoBuffer.writeUInt32BE(toUInt32(entry.mtime[1], "mtime[1]"));
    fs.writeSync(file, mtimeSecBuffer);
    fs.writeSync(file, mtimeNanoBuffer);

    const devBuffer = Buffer.alloc(4);
    const inoBuffer = Buffer.alloc(4);
    devBuffer.writeUInt32BE(toUInt32(entry.dev, "dev"));
    inoBuffer.writeUInt32BE(toUInt32(entry.ino, "ino"));
    fs.writeSync(file, devBuffer);
    fs.writeSync(file, inoBuffer);

    const modeBuffer = Buffer.alloc(4);
    const mode = (entry.modeType << 12) | entry.modePerms;
    modeBuffer.writeUInt32BE(mode);
    fs.writeSync(file, modeBuffer);

    const uidBuffer = Buffer.alloc(4);
    const gidBuffer = Buffer.alloc(4);
    uidBuffer.writeUInt32BE(toUInt32(entry.uid, "uid"));
    gidBuffer.writeUInt32BE(toUInt32(entry.gid, "gid"));
    fs.writeSync(file, uidBuffer);
    fs.writeSync(file, gidBuffer);

    const fsizeBuffer = Buffer.alloc(4);
    fsizeBuffer.writeUInt32BE(toUInt32(entry.fsize, "fsize"));
    fs.writeSync(file, fsizeBuffer);

    const shaBuffer = Buffer.from(entry.sha, "hex");
    fs.writeSync(file, shaBuffer);

    const flagBuffer = Buffer.alloc(2);
    const flagAssumeValid = entry.flagAssumeValid ? (1 << 15) : 0;
     // Write file name and alignment padding
    const nameBytes = Buffer.from(entry.name, "utf8");
    const nameLength = Math.min(nameBytes.length, 0xfff);
    const flags = flagAssumeValid | (entry.flagStage << 12) | nameLength;
    flagBuffer.writeUInt16BE(flags);
    fs.writeSync(file, flagBuffer);
    fs.writeSync(file, nameBytes);
    fs.writeSync(file, Buffer.alloc(1, 0));

    const padding = (8 - ((62 + nameBytes.length + 1) % 8)) % 8;
    if (padding > 0) fs.writeSync(file, Buffer.alloc(padding));
  }

  fs.closeSync(file);
 
}

export { GitIndexEntry, GitIndex, indexRead, indexWrite };