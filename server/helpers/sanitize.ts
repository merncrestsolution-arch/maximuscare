/** Basic XSS-oriented input sanitization for plain text fields. */
export function sanitizePlainText(input: unknown, maxLen = 2000): string {
  if (input == null) return "";
  return String(input)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeEmail(email: unknown): string {
  return sanitizePlainText(email, 320).toLowerCase();
}
