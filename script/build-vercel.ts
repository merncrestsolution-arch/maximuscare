import { build as esbuild } from "esbuild";
import { readFile } from "fs/promises";

// Bundle the Express backend into a single self-contained CommonJS file that the
// Vercel serverless function (api/index.js) loads. Bundling avoids ESM extension
// resolution errors (ERR_MODULE_NOT_FOUND) that occur when Vercel ships the raw
// TypeScript-compiled files for a "type": "module" project.
//
// Deps in `allowlist` are inlined into the bundle; everything else stays external
// and is included via Vercel's node_modules file-tracing of the bundle's require()s.
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "helmet",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "zod",
  "zod-validation-error",
  "jspdf",
];

async function run() {
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/vercelHandler.ts"],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    outfile: "dist/vercel-server.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("built dist/vercel-server.cjs");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
