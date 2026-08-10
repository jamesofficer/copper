// Matches common test-file conventions across languages: `.test.`/`.spec.`
// filename markers, and `__tests__`/`test(s)`/`e2e`/`cypress` directories.
const TEST_FILE_PATTERN =
  /(\.(test|spec)\.[^./]+$)|(^|\/)(__tests__|tests?|e2e|cypress)\//i;

export function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERN.test(path);
}
