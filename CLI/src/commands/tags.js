import { repoFind } from "../repository.js";
import { refList, refCreate } from "../references.js";
import { objectWrite,  GitTag } from "../objects.js";

// Main function for handling tags: creates or lists tags based on arguments
export function cmdTag(args) {
    const repo = repoFind();

    if (args.name) {
        tagCreate( // If a tag name is provided, create a tag
            repo,
            args.name,
            args.object || "HEAD",  // Default to HEAD if no object is specified
            args.createTagObject // Determine if it's a lightweight or annotated tag
        );
    } else {
        // If no name is provided, list all tags
        const refs = refList(repo);
        if (refs.tags) {
            showTags(refs.tags);  // Recursively display tags
        } else {
            console.log("No tags found.");
        }
    }
}

// Function to create a new tag
function tagCreate(repo, name, ref, createTagObject = false) {
    const sha = objectFind(repo, ref);

    if (createTagObject) {
         // If an annotated tag is requested
        const tag = new GitTag(); 
        tag.kvlm.set("object", sha);
        tag.kvlm.set("type", "commit"); 
        tag.kvlm.set("tag", name);
        tag.kvlm.set(
            "tagger",
            "YourName <you@example.com> " + Math.floor(Date.now() / 1000) // Simulate tagger info
        );
        tag.kvlm.set(
            null,
            "A tag generated by your CLI. Customize this message!"
        );

        const tagSha = objectWrite(tag, repo);
        refCreate(repo, `tags/${name}`, tagSha);
    } else {
        // Create a lightweight tag (reference)
        refCreate(repo, `tags/${name}`, sha);
    }
}

// Show tags recursively
function showTags(tags) {
    for (const [key, value] of Object.entries(tags)) {
        if (typeof value === "string") {
            console.log(key);
        } else {
            showTags(value);
        }
    }
}

