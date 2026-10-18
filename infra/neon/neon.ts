import { defineConfig } from "@neon/config/v1";

// Declares what the Neon project should look like. `npm run plan` previews the
// difference with what exists; `npm run deploy` applies it.
export default defineConfig({
  // Neon Auth: hosted sign-in (Google/GitHub). Users live in the `neon_auth` schema.
  auth: true,
  branch: (branch) => {
    // production (default) and dev (your laptop) keep project defaults and never expire.
    if (branch.isDefault || branch.name === "dev") {
      return {};
    }
    if (!branch.exists) {
      // Any other new branch (e.g. a preview copy for a PR) deletes itself after 7 days.
      return { ttl: "7d" };
    }
    return {};
  },
});
