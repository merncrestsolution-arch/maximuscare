/** Minimum duration for login-style splash screens (initial load & successful sign-in). */
export const LOGIN_SPLASH_MIN_MS = 2000;

export async function waitMinElapsed(startMs: number, minMs = LOGIN_SPLASH_MIN_MS) {
  const remaining = minMs - (Date.now() - startMs);
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}
