// Vercel serverless function entry. The Express backend is pre-bundled by
// `npm run build:vercel` into dist/vercel-server.cjs (a self-contained CommonJS
// file) so Vercel doesn't have to resolve raw TypeScript/ESM source at runtime.
// This thin loader stays stable in git while the heavy bundle is generated at build.
const mod = require("../dist/vercel-server.cjs");
module.exports = mod.default || mod;
