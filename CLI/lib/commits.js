export function kvlmParse(raw, start = 0, dct = new Map()) {
  if (!dct.has(null)) dct.set(null, Buffer.alloc(0));

 // console.log("Parsing KVLM raw data:", raw.toString("utf8"));

  const spc = raw.indexOf(0x20, start);
  const nl = raw.indexOf(0x0a, start);

  if (spc === -1 || nl < spc) {
    if (nl === start) {
      dct.set(null, raw.slice(start + 1)); // Remaining message
   //   console.log("Message parsed:", dct.get(null).toString("utf8"));
      return dct;
    }
    throw new Error("Malformed commit object");
  }

  const key = raw.slice(start, spc).toString("utf8");
  let end = spc + 1;

  while (true) {
    const nextNl = raw.indexOf(0x0a, end);
    if (nextNl === -1 || raw[nextNl + 1] !== 0x20) {
      end = nextNl;
      break;
    }
    end = nextNl + 1;
  }

  const value = raw.slice(spc + 1, end).toString("utf8").replace(/\n /g, "\n");
//  console.log(`Parsed key: ${key}, value: ${value}`);

  if (dct.has(key)) {
    const existing = dct.get(key);
    dct.set(key, Array.isArray(existing) ? [...existing, value] : [existing, value]);
  } else {
    dct.set(key, value);
  }

  return kvlmParse(raw, end + 1, dct);
}


export function kvlmSerialize(kvlm) {
  let result = "";

  for (const [key, value] of kvlm.entries()) {
    if (key === null) continue; // Skip the commit message
    const values = Array.isArray(value) ? value : [value];
    values.forEach((v) => {
      result += `${key} ${v.replace(/\n/g, "\n ")}\n`;
    });
  }

  result += `\n${kvlm.get(null)}`;
  return Buffer.from(result, "utf8");
}
