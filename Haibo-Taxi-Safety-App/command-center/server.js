// Azure App Service static-file server for the command-center SPA.
//
// The Vite build produces plain static files in dist/. Azure's node runtime
// expects a process it can start and keep alive, so we ship this thin
// Express wrapper that serves the static files and falls through to
// index.html for any unknown path (SPA deep-link routing).
//
// Copied into dist/index.js at build time by the postbuild script so the
// existing Azure startup command (`node dist/index.js`) keeps working.
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const root = __dirname; // when this runs from dist/, __dirname IS dist/

// Static assets — images, CSS, JS chunks. One year immutable cache for
// fingerprinted files (Vite's default, `index-<hash>.js`); short cache
// for everything else so a new deploy takes effect on next page load.
app.use(
  express.static(root, {
    maxAge: "1y",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        // Never cache the HTML shell so new bundle hashes are picked up
        // on the next refresh. Asset URLs are fingerprinted anyway so
        // the browser never serves stale JS.
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate",
        );
      }
    },
  }),
);

// SPA fallback — any GET that didn't match a real file returns index.html
// so client-side routing (React Router) handles the URL.
app.get("*", (_req, res) => {
  const indexPath = path.join(root, "index.html");
  if (!fs.existsSync(indexPath)) {
    res
      .status(500)
      .send("index.html missing from dist/ — build likely failed");
    return;
  }
  res.sendFile(indexPath);
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`[command-center] listening on ${PORT}`);
});
