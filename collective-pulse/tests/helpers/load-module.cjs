const { buildSync } = require("esbuild");
const path = require("node:path");
const Module = require("node:module");
const cache = new Map();
module.exports = function loadModule(file) {
  const filename = path.resolve(__dirname, "../..", file);
  if (cache.has(filename)) return cache.get(filename);
  const result = buildSync({
    entryPoints: [filename],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    write: false,
    logLevel: "silent",
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(result.outputFiles[0].text, filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
};
