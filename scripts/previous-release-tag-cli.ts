/** Print the semver tag before `current` (one tag per line on stdin). */
import { previousVersionTag } from "./release-names.ts";

const current = Deno.args[0]?.trim();
if (!current) {
  console.error("usage: previous-release-tag-cli.ts <current-tag>");
  Deno.exit(2);
}

const text = new TextDecoder().decode(await Deno.readAll(Deno.stdin));
const list = text.trim().split(/\n+/).filter(Boolean);
const prev = previousVersionTag(list, current);
if (prev) console.log(prev);
