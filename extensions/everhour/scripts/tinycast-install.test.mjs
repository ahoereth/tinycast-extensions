import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, lstatSync, realpathSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const script = new URL("./tinycast-install.mjs", import.meta.url);

test("copy install preserves an existing install", async () => {
  await fixture(async ({ run, destination }) => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "old.txt"), "keep me");
    const child = run();
    assert.equal(await exited(child), 0);
    assert.equal(lstatSync(destination).isSymbolicLink(), false);
    assert.equal(readFileSync(join(destination, "index.js"), "utf8"), "built");
    assert.equal(JSON.parse(readFileSync(join(destination, "package.json"), "utf8")).name, "everhour");
    assert.equal(readFileSync(join(destination, "assets", "icon.png"), "utf8"), "icon");
    const backup = readdirSync(join(destination, "..")).find(name => name.startsWith("everhour.backup-"));
    assert.ok(backup);
    assert.equal(readFileSync(join(destination, "..", backup, "old.txt"), "utf8"), "keep me");
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

test("dev install links dist and rebuilds after a source edit", async () => {
  await fixture(async ({ run, destination, cwd, root }) => {
    const child = run("--dev");
    let output = "";
    child.stdout.on("data", data => { output += data; });
    await waitFor(() => output.includes("Watching"));
    assert.equal(lstatSync(destination).isSymbolicLink(), true);
    assert.equal(realpathSync(destination), realpathSync(join(cwd, "dist")));
    writeFileSync(join(cwd, "src", "index.tsx"), "changed");
    await waitFor(() => readFileSync(join(root, "builds"), "utf8").trim().split("\n").length >= 2);
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
