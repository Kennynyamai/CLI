// Parse a Key-Value List with Message (KVLM) from raw commit data
function kvlmParse(raw, start = 0, dct = new Map()) {
  // Initialize the commit message if not already set
  if (!dct.has(null)) dct.set(null, Buffer.alloc(0));

  // Find the next space and newline in the raw data
  const spc = raw.indexOf(0x20, start);
  const nl = raw.indexOf(0x0a, start);

  // Check if we are processing the commit message or malformed data
  if (spc === -1 || nl < spc) {
    // Commit message starts after an empty line
    if (nl === start) {
      dct.set(null, raw.slice(start + 1)); // Remaining raw data is the commit message

      return dct;
    }
    throw new Error("Malformed commit object");
  }

  // Extract the key from the raw data
  const key = raw.slice(start, spc).toString("utf8");
  let end = spc + 1;

  while (true) {
    const nextNl = raw.indexOf(0x0a, end); // Find next newline
    if (nextNl === -1 || raw[nextNl + 1] !== 0x20) {
      // Stop if there is no continuation line
      end = nextNl;
      break;
    }
    end = nextNl + 1; // Continue parsing the next part of the value
  }

  // Extract the value and handle line continuations
  const value = raw.slice(spc + 1, end).toString("utf8").replace(/\n /g, "\n");
  // Add the key-value pair to the map, handling duplicate keys
  if (dct.has(key)) {
    const existing = dct.get(key);
    dct.set(key, Array.isArray(existing) ? [...existing, value] : [existing, value]);
  } else {
    dct.set(key, value);
  }
  // Recursively parse the remaining raw data
  return kvlmParse(raw, end + 1, dct);
}

// Serialize a Key-Value List with Message (KVLM) into raw commit data
function kvlmSerialize(kvlm) {
  let result = "";
  // Serialize all key-value pairs except the commit message
  for (const [key, value] of kvlm.entries()) {
    if (key === null) continue; // Skip the commit message
    const values = Array.isArray(value) ? value : [value];
    values.forEach((v) => {
      result += `${key} ${v.replace(/\n/g, "\n ")}\n`;
    });
  }
  // Append the commit message at the end
  result += `\n${kvlm.get(null)}`;
  return Buffer.from(result, "utf8");  // Convert the serialized data to a buffer
}

export { kvlmParse, kvlmSerialize };