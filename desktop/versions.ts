export async function readJsonVersion(filePath: string): Promise<string> {
  try {
    const raw = await Deno.readTextFile(filePath);
    const data = JSON.parse(raw) as { version?: unknown };
    if (typeof data.version === "string" && data.version.length > 0) {
      return data.version;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function readAppVersion(denoJsonPath: string): Promise<string> {
  return readJsonVersion(denoJsonPath);
}

export function readExcalidrawVersion(packageJsonPath: string): Promise<string> {
  return readJsonVersion(packageJsonPath);
}
