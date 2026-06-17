export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/** Part 8 password policy: min 8 chars, upper, lower, number, special. */
export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include a special character");
  }
  return { valid: errors.length === 0, errors };
}

/** Admin-created staff may use relaxed policy in dev; production enforces full policy. */
export function validatePasswordForContext(
  password: string,
  opts?: { relaxed?: boolean },
): PasswordValidationResult {
  if (opts?.relaxed && process.env.NODE_ENV !== "production") {
    if (password.length < 4) {
      return { valid: false, errors: ["Password must be at least 4 characters"] };
    }
    return { valid: true, errors: [] };
  }
  return validatePasswordPolicy(password);
}
