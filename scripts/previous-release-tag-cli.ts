/** Print the semver tag before `current` (remaining args are all tags). */
import { previousVersionTag } from "./release-names.ts";

const [current, ...allTags] = Deno.args;
if (!current?.trim()) {
  console.error("usage: previous-release-tag-cli.ts <current-tag> [other-tags...]");
  Deno.exit(2);
}

const prev = previousVersionTag(allTags, current.trim());
if (prev) console.log(prev);
