/** One CSV cell. A text cell that a spreadsheet would read as a formula
 *  (starting with = + - @, a tab or a carriage return) is prefixed with an
 *  apostrophe so it stays text (N27 in docs/FINDINGS.md). Plain numbers,
 *  negatives included, are left as numbers. Today every exported value is
 *  system-generated; this keeps the export safe if a name or reason is added. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
