/**
 * About / version constants for the Info menu.
 * Update these at each release (keep excalidrawVersion in sync with
 * frontend/package.json @excalidraw/excalidraw).
 */

export const APP_VERSION = "0.1.0";
export const EXCALIDRAW_VERSION = "0.18.1";

export const APP_REPO_URL =
  "https://github.com/gfaurobert/excalidraw-offline-bin";
export const EXCALIDRAW_REPO_URL = "https://github.com/excalidraw/excalidraw";

export function getAppVersion(): string {
  return APP_VERSION;
}

export function getExcalidrawVersion(): string {
  return EXCALIDRAW_VERSION;
}

export function getAppRepoUrl(): string {
  return APP_REPO_URL;
}

export function getExcalidrawRepoUrl(): string {
  return EXCALIDRAW_REPO_URL;
}
