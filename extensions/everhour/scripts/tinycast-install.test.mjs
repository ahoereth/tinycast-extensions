import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, lstatSync, realpathSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const script = new URL("./tinycast-install.mjs", import.meta.url);

test("copy install replaces an existing install without keeping backups", async () => {
  await fixture(async ({ run, destination, root }) => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "old.txt"), "keep me");
    const child = run();
    assert.equal(await exited(child), 0);
    assert.equal(lstatSync(destination).isSymbolicLink(), false);
    assert.equal(readFileSync(join(destination, "index.js"), "utf8"), "built");
    assert.equal(JSON.parse(readFileSync(join(destination, "package.json"), "utf8")).name, "everhour");
    assert.equal(readFileSync(join(destination, "assets", "icon.png"), "utf8"), "icon");
    assert.deepEqual(readdirSync(join(destination, "..")), ["everhour"]);
    assert.deepEqual(readdirSync(join(root, "Library/Application Support/com.tinycast.app")), ["extensions"]);
    assert.equal(readdirSync(destination).includes("old.txt"), false);
  });
});

test("a running Tinycast Dev receives installs without changing stable", async () => {
  await fixture(async ({ run, destination, root }) => {
    writeFileSync(join(root, "dev-running"), "");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "old.txt"), "stable");
    assert.equal(await exited(run()), 0);
    const devDestination = join(root, "Library/Application Support/com.tinycast.app.dev/extensions/everhour");
    assert.equal(readFileSync(join(devDestination, "index.js"), "utf8"), "built");
    assert.equal(readFileSync(join(destination, "old.txt"), "utf8"), "stable");
    assert.deepEqual(readdirSync(destination), ["old.txt"]);
  });
});

test("channel detection failures do not build or install into stable", async () => {
  await fixture(async ({ run, root }) => {
    writeFileSync(join(root, "detection-failed"), "");
    assert.notEqual(await exited(run()), 0);
    assert.equal(readdirSync(root).includes("builds"), false);
    assert.equal(readdirSync(root).includes("Library"), false);
  });
});

test("failed builds leave the existing install untouched", async () => {
  await fixture(async ({ run, destination, root }) => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "old.txt"), "keep me");
    writeFileSync(join(root, "fail"), "");
    assert.notEqual(await exited(run()), 0);
    assert.equal(readFileSync(join(destination, "old.txt"), "utf8"), "keep me");
  });
});

test("watch mode targets running Dev, links dist and rebuilds after a source edit", async () => {
  await fixture(async ({ run, cwd, root }) => {
    writeFileSync(join(root, "dev-running"), "");
    const destination = join(root, "Library/Application Support/com.tinycast.app.dev/extensions/everhour");
    assert.equal(await exited(run()), 0);
    const child = run("--dev");
    let output = "";
    child.stdout.on("data", data => { output += data; });
    await waitFor(() => output.includes("Watching"));
    assert.equal(lstatSync(destination).isSymbolicLink(), true);
    assert.equal(realpathSync(destination), realpathSync(join(cwd, "dist")));
    assert.deepEqual(readdirSync(join(destination, "..")), ["everhour"]);
    assert.deepEqual(readdirSync(join(root, "Library/Application Support/com.tinycast.app.dev")), ["extensions"]);
    writeFileSync(join(cwd, "src", "index.tsx"), "changed");
    await waitFor(() => readFileSync(join(root, "builds"), "utf8").trim().split("\n").length >= 3);
  });
});

async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for watcher");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function exited(child) {
  return new Promise(resolve => child.on("exit", resolve));
}

async function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "tinycast-install-"));
  const cwd = join(root, "extension");
  const bin = join(root, "bin");
  mkdirSync(join(cwd, "src"), { recursive: true });
  mkdirSync(join(cwd, "dist"));
  mkdirSync(bin);
  mkdirSync(join(cwd, "assets"));
  writeFileSync(join(cwd, "assets", "icon.png"), "icon");
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "everhour", commands: [{ name: "index" }] }));
  writeFileSync(join(cwd, "dist", "index.js"), "built");
  writeFileSync(join(bin, "npm"), '#!/bin/sh\n[ ! -f "$HOME/fail" ] || exit 1\necho build >> "$HOME/builds"\n', { mode: 0o755 });
  writeFileSync(join(bin, "pgrep"), '#!/bin/sh\n[ "$1" = -x ] && [ "$2" = "Tinycast Dev" ] || exit 2\n[ ! -f "$HOME/detection-failed" ] || exit 2\n[ -f "$HOME/dev-running" ]\n', { mode: 0o755 });
  const destination = join(root, "Library/Application Support/com.tinycast.app/extensions/everhour");
  const children = [];
  const run = (...args) => {
    const child = spawn(process.execPath, [script.pathname, ...args], {
      cwd, env: { ...process.env, HOME: root, PATH: `${bin}:${process.env.PATH}` }, stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    return child;
  };
  try { await fn({ run, destination, cwd, root }); }
  finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const done = exited(child);
        child.kill();
        await done;
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
}
