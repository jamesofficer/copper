// Whether "Analyse PR" also runs the findings pass automatically once the
// analysis lands. On by default; the Review settings tab can turn it off for
// cost-sensitive use.
const STORAGE_KEY = "findIssuesOnAnalyse";

export function getFindIssuesOnAnalyse(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setFindIssuesOnAnalyse(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
