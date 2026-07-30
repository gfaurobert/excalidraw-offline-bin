/** Minimal path helpers to avoid remote JSR deps in offline/CI environments. */

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized.startsWith("/") ? "/" : ".";
  return normalized.slice(0, idx);
}

export function join(...parts: string[]): string {
  if (parts.length === 0) return ".";
  const isAbs = parts[0]?.startsWith("/") ?? false;
  const segments: string[] = [];
  for (const part of parts) {
    for (const seg of part.replace(/\\/g, "/").split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        if (segments.length && segments[segments.length - 1] !== "..") {
          segments.pop();
        } else if (!isAbs) {
          segments.push("..");
        }
        continue;
      }
      segments.push(seg);
    }
  }
  const joined = segments.join("/");
  if (isAbs) return `/${joined}`;
  return joined || ".";
}

export function fromFileUrl(url: string): string {
  const u = new URL(url);
  if (u.protocol !== "file:") throw new Error(`Not a file URL: ${url}`);
  return decodeURIComponent(u.pathname);
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}
