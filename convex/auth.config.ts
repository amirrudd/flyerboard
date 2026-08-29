// Validate required environment variables
if (!process.env.CONVEX_AUTH_ISSUER) {
  throw new Error(
    "Missing CONVEX_AUTH_ISSUER environment variable. " +
    "Add it to Convex Dashboard → Settings → Environment Variables. " +
    "Format: https://api.descope.com/v1/apps/YOUR_DESCOPE_PROJECT_ID — but do not guess: " +
    "it must exactly match the `iss` claim of the session JWT Descope currently mints " +
    "(decode localStorage.DS in the browser). Descope has changed this format before; " +
    "a mismatch makes every authed function silently see no identity."
  );
}

if (!process.env.DESCOPE_PROJECT_ID) {
  throw new Error(
    "Missing DESCOPE_PROJECT_ID environment variable. " +
    "Add it to Convex Dashboard → Settings → Environment Variables. " +
    "This is required for OIDC authentication with Descope."
  );
}

export default {
  providers: [
    {
      domain: process.env.CONVEX_AUTH_ISSUER,
      applicationID: process.env.DESCOPE_PROJECT_ID,
    },
  ],
};
