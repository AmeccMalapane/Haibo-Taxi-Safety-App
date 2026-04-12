// Azure App Service startup script
// Uses tsx to run TypeScript directly without pre-compilation
require("tsx/cjs");
require("./server/index.ts");
