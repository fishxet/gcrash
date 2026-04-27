import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const packageJsonPath = resolve(packageDir, "package.json");
const buildDir = resolve(packageDir, "build");
const releaseDir = resolve(packageDir, "stake-release");

const main = async () => {
  const pkg = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const gameID = pkg.gameID ?? pkg.gameId ?? pkg.name;
  const { version } = pkg;

  if (!gameID || !version) {
    throw new Error("package.json must define gameID (or name) and version");
  }

  try {
    await access(resolve(buildDir, "index.html"));
  } catch {
    throw new Error("build/index.html was not found");
  }

  const outputDir = resolve(releaseDir, gameID, version);
  const staleZip = resolve(releaseDir, `${gameID}-${version}.zip`);

  await rm(outputDir, { recursive: true, force: true });
  await rm(staleZip, { force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(buildDir, outputDir, { recursive: true });

  console.log(`[stake-release] Wrote release folder ${outputDir}`);
};

await main();
