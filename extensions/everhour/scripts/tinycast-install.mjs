import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dev = process.argv.includes("--dev");
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const dist = resolve("dist");
const parent = join(homedir(), "Library/Application Support/com.tinycast.app/extensions");
const destination = join(parent, manifest.name);

function build() {
  const result = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Extension build failed; installation left unchanged.");
  for (const file of manifest.commands.map(command => `${command.name}.js`)) {
    if (!existsSync(join(dist, file))) throw new Error(`Missing build output: dist/${file}`);
  }
  cpSync("package.json", join(dist, "package.json"));
  if (existsSync("assets")) cpSync("assets", join(dist, "assets"), { recursive: true });
}

function install() {
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".everhour-install-"));
  const staged = join(staging, "extension");
  const previous = join(staging, "previous");
  try {
    if (dev) symlinkSync(dist, staged, "dir");
    else cpSync(dist, staged, { recursive: true });
    let replaced = false;
    try {
      renameSync(destination, previous);
      replaced = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      renameSync(staged, destination);
    } catch (error) {
      if (replaced) renameSync(previous, destination);
      throw error;
    }
    rmSync(previous, { recursive: true, force: true });
  } finally {
    if (!existsSync(previous)) rmSync(staging, { recursive: true, force: true });
  }
  console.log(`Installed at ${destination}`);
}

build();
install();

if (dev) {
  let timer;
  // shortcut: rebuild the whole extension; use incremental builds if this becomes slow.
  watch(process.cwd(), { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const path = filename.toString();
    if (!/^(src\/|assets\/|package\.json$|tsconfig\.json$)/.test(path)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
        console.log("Rebuilt. Close and reopen the Tinycast command to load changes.");
      } catch (error) {
        console.error(error.message);
      }
    }, 200);
  });
  console.log("Watching source files. Press Ctrl+C to stop; the symlink stays installed.");
}
