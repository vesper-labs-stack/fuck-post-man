/**
 * Replace every `{{var_name}}` placeholder in `text` with the matching value
 * from `envMap`. Unknown placeholders are left untouched so the user can see
 * what failed to resolve. Whitespace inside the braces is tolerated.
 * `{{vault.*}}` names are reserved for the Rust-side secure vault and are
 * always passed through untouched.
 */
export function parseEnvironmentVariables(
  text: string,
  envMap: Record<string, string>,
): string {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name: string) =>
    !name.startsWith("vault.") &&
    Object.prototype.hasOwnProperty.call(envMap, name)
      ? envMap[name]
      : match,
  );
}

/** Recursively resolve placeholders across a flat key/value record. */
export function resolveRecord(
  record: Record<string, string>,
  envMap: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    out[parseEnvironmentVariables(key, envMap)] = parseEnvironmentVariables(
      value,
      envMap,
    );
  }
  return out;
}