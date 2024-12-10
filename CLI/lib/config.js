import fs from "fs";
import path from "path";

// Read Git configuration files, focusing only on local `.pal/config`
export function gitConfigRead(repo) {
  console.log("Reading configuration for repository...");

  // Ensure repo is provided
  if (!repo) {
    throw new Error("Repository context is required to read configuration.");
  }

  const localConfigPath = path.join(repo.gitdir, "config");
  console.log(`Checking local repository config: ${localConfigPath}`);

  const config = {};
  if (fs.existsSync(localConfigPath)) {
    const content = fs.readFileSync(localConfigPath, "utf8");
    console.log(`Content of ${localConfigPath}:\n${content}`);
    parseConfig(content, config);
  } else {
    console.error("Local repository config not found.");
    throw new Error("Missing local repository configuration file.");
  }

  return config;
}

// Parse configuration file contents
function parseConfig(content, config) {
  console.log("Parsing configuration file content...");
  let currentSection = null;

  content.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) {
      console.log(`Skipping comment or empty line: ${line}`);
      return;
    }

    if (line.startsWith("[")) {
      currentSection = line.slice(1, -1);
      console.log(`Parsing new section: [${currentSection}]`);
      config[currentSection] = {};
    } else if (currentSection) {
      const [key, value] = line.split("=").map((s) => s.trim());
      console.log(`Parsing key-value pair: ${key} = ${value} under section [${currentSection}]`);
      config[currentSection][key] = value;
    } else {
      console.warn(`Unexpected line outside of any section: ${line}`);
    }
  });

  console.log("Completed parsing configuration file content.");
}

// Get user information
export function gitConfigUserGet(config) {
  console.log("Extracting user information from configuration:", JSON.stringify(config, null, 2));

  if (config.user && config.user.name && config.user.email) {
    const userInfo = `${config.user.name} <${config.user.email}>`;
    console.log("User information found:", userInfo);
    return userInfo;
  }
  throw new Error("User information not configured in local repository config.");
}
