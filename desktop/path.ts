/** Minimal path helpers to avoid remote JSR deps in offline/CI environments. */

export function isAbsolutePath(path: string): boolean {
  const n = path.replace(/\\/g, "/");
  if (n.startsWith("//")) return true;
  if (/^[A-Za-z]:(\/|$)/.test(n)) return true;
  return n.startsWith("/");
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (/^[A-Za-z]:\/?$/.test(normalized)) {
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return normalized.startsWith("/") ? "/" : ".";
  const parent = normalized.slice(0, idx);
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}/`;
  if (parent === "") return "//";
  return parent;
}

export function join(...parts: string[]): string {
  if (parts.length === 0) return ".";
  const first = (parts[0] ?? "").replace(/\\/g, "/");
  const unc = first.startsWith("//");
  const drive = first.match(/^([A-Za-z]:)/);
  const posixAbs = first.startsWith("/") && !unc && !drive;

  const segments: string[] = [];
  for (const part of parts) {
    for (const seg of part.replace(/\\/g, "/").split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") {
        if (segments.length && segments[segments.length - 1] !== "..") {
          segments.pop();
        } else if (!posixAbs && !unc && !drive) {
          segments.push("..");
        }
        continue;
      }
      segments.push(seg);
    }
  }
  const joined = segments.join("/");
  if (unc) return `//${joined}`;
  if (drive) {
    // "C:/Users" splits to ["C:", "Users"]; keep the drive prefix once.
    const afterDrive = segments[0] === drive[1] ? segments.slice(1) : segments;
    const tail = afterDrive.join("/");
    return tail.length > 0 ? `${drive[1]}/${tail}` : `${drive[1]}/`;
  }
  if (posixAbs) return `/${joined}`;
  return joined || ".";
}

export function fromFileUrl(url: string): string {
  const u = new URL(url);
  if (u.protocol !== "file:") throw new Error(`Not a file URL: ${url}`);
  let path = decodeURIComponent(u.pathname);
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
  return path;
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}
