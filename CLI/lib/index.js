import fs from "fs";
import path from "path";
import { ceil } from "mathjs";

export class GitIndexEntry {
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

  static fromRawData(rawData) {
      console.log(`Creating GitIndexEntry from raw data:`, rawData);
      return new GitIndexEntry(rawData);
  }
}




export class GitIndex {
  constructor({ version = 2, entries = [] } = {}) {
    this.version = version; // Index version
    this.entries = entries; // List of entries
  }
}


export function indexRead(repo) {
  const indexPath = path.join(repo.gitdir, "index");
  if (!fs.existsSync(indexPath)) {
    console.log("Index file does not exist, returning empty index.");
    return { entries: [] };
  }

  const buffer = fs.readFileSync(indexPath);
  console.log("Index file size:", buffer.length);

  const signature = buffer.slice(0, 4).toString();
  const version = buffer.readUInt32BE(4);
  const numEntries = buffer.readUInt32BE(8);
  console.log("Index file header:", { signature, version, numEntries });

  if (signature !== "DIRC" || version !== 2) {
    throw new Error("Invalid index file");
  }

  let offset = 12;
  const entries = [];

  for (let i = 0; i < numEntries; i++) {
    try {
      const entry = parseIndexEntry(buffer, offset);
      entries.push(entry.entry);
      offset = entry.offset;
    } catch (err) {
      console.error(`Error parsing entry at offset ${offset}:`, err.message);
      break;
    }
  }

  console.log("Parsed entries:", entries.map((e) => e?.name || "undefined"));
  return { entries };
}

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

  const nameLength = flags & 0xfff;
  const nameStart = offset + 62;
  const nameEnd = nameStart + nameLength;
  const name = buffer.slice(nameStart, nameEnd).toString();

  const entrySize = 62 + nameLength + 1;
  const padding = (8 - (entrySize % 8)) % 8;
  offset = nameStart + nameLength + 1 + padding;

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





export function indexWrite(repo, index) {
  const indexPath = path.join(repo.gitdir, "index");
  console.log(`Writing index to: ${indexPath}`);

  const file = fs.openSync(indexPath, "w");

  fs.writeSync(file, Buffer.from("DIRC"));
  const versionBuffer = Buffer.alloc(4);
  versionBuffer.writeUInt32BE(2);
  fs.writeSync(file, versionBuffer);

  const entryCountBuffer = Buffer.alloc(4);
  entryCountBuffer.writeUInt32BE(index.entries.length);
  fs.writeSync(file, entryCountBuffer);

  for (const entry of index.entries) {
    if (!entry) {
      console.error("Skipping undefined entry:", entry);
      continue;
    }

    console.log("Writing entry:", entry.name);

    const toUInt32 = (value, fieldName) => {
      if (value < 0 || value > 4294967295) {
        console.warn(`Truncating ${fieldName}: ${value}`);
        value = value & 0xffffffff;
      }
      return value >>> 0;
    };

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
  console.log("Index written successfully.");
}
