// Whether the Changes tab's file list starts with test files hidden. Off by
// default; the Review settings tab can turn it on.
const STORAGE_KEY = "hideTestFilesByDefault";

export function getHideTestFilesByDefault(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setHideTestFilesByDefault(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
