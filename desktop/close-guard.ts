/** Re-entrancy helper for Deno BrowserWindow "close" + safe quit. */
export function createCloseGuard() {
  let allowClose = false;
  return {
    shouldDeferClose(): boolean {
      return !allowClose;
    },
    grantClose(): void {
      allowClose = true;
    },
  };
}
