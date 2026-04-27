import { sveltekit } from "@sveltejs/kit/vite";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin, ResolvedConfig } from "vite";

const MAX_BUILD_SIZE_BYTES = 50 * 1024 * 1024;
const red = (value: string): string => `\x1b[31m${value}\x1b[0m`;

const directorySize = async (path: string): Promise<number> => {
  const entry = await stat(path);
  if (!entry.isDirectory()) return entry.size;

  const children = await readdir(path);
  const sizes = await Promise.all(children.map((child) => directorySize(resolve(path, child))));
  return sizes.reduce((sum, size) => sum + size, 0);
};

const buildSizeWarningPlugin = (): Plugin => {
  let root = process.cwd();
  let outDir = "dist";
  let reported = false;

  return {
    name: "golf-crash-build-size-warning",
    configResolved(config: ResolvedConfig) {
      root = config.root;
      outDir = config.build.outDir;
    },
    async closeBundle() {
      if (reported) return;

      const configuredOutDir = isAbsolute(outDir) ? outDir : resolve(root, outDir);
      const candidates = [resolve(root, "build"), configuredOutDir, resolve(root, "dist")];
      const outputDir = candidates.find((candidate) => existsSync(candidate));
      if (!outputDir) return;

      reported = true;
      const size = await directorySize(outputDir);
      const sizeMb = size / 1024 / 1024;
      if (size > MAX_BUILD_SIZE_BYTES) {
        console.warn(
          red(
            `[build-size] ${outputDir} is ${sizeMb.toFixed(2)} MB, which exceeds the 50 MB CDN budget.`,
          ),
        );
      }
    },
  };
};

export default defineConfig({
  base: "./",
  plugins: [sveltekit(), buildSizeWarningPlugin()],
  build: {
    rollupOptions: {
      output: {
        compact: true,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
