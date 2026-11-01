import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => mocks[name] ?? require(name),
    URLSearchParams,
    Date,
    AbortController,
  });
  return exports;
}
const task = (id, name, projects = ["p"], extra = {}) => ({
  id,
  name,
  projects,
  time: { total: 0, recent: 0 },
  ...extra,
});

test("search groups matching open history first by recency, filters projects, and removes duplicates", () => {
  const { groupTaskResults } = load("utils/task-search");
  const history = [
    task("a", "Fix login", ["p"], { lastWorked: "2026-01-01" }),
    task("b", "Fix logout", ["p"], { lastWorked: "2026-01-03" }),
    task("c", "Fix closed", ["p"], { status: "closed" }),
    task("d", "Fix elsewhere", ["q"]),
    task("e", "Unrelated"),
  ];
  const results = [task("a", "Fix login"), task("f", "Fix signup"), task("g", "Fix elsewhere", ["q"])];
  const groups = groupTaskResults(history, results, " FIX ", "p");
  assert.deepEqual(
    Array.from(groups.recent, (t) => t.id),
    ["b", "a"],
  );
  assert.deepEqual(
    Array.from(groups.other, (t) => t.id),
    ["f"],
  );
  assert.equal(groupTaskResults(history, results, "absent", "p").recent.length, 0);
});

test("task search encodes input, scopes projects, excludes closed tasks, and supports increasing limits", async () => {
  const urls = [];
  const signal = new AbortController().signal;
  const { searchTasks } = load("api/index", {
    "@raycast/api": { getPreferenceValues: () => ({ token: "test" }) },
    "node-fetch": async (url, options) => {
      urls.push(new URL(url));
      assert.equal(options.signal, signal);
      return { ok: true, json: async () => [task("a", "A")] };
    },
  });
  const result = await searchTasks("a & b", "", 50, signal);
  assert.equal(result[0].time.recent, 0);
  assert.equal(urls[0].pathname, "/tasks/search");
  assert.equal(urls[0].searchParams.get("query"), "a & b");
  assert.equal(urls[0].searchParams.get("searchInClosed"), "false");
  await searchTasks("test", "p/id", 100, signal);
  assert.equal(urls[1].pathname, "/projects/p%2Fid/tasks/search");
  assert.equal(urls[1].searchParams.get("limit"), "100");
});

test("recent history supports 30 days, orders by work date, and accepts empty history", async () => {
  let records = [
    { date: "2026-01-01", time: 60, task: task("a", "A") },
    { date: "2026-01-03", time: 120, task: task("b", "B") },
    { date: "2026-01-02", time: 30, task: task("a", "A") },
  ];
  const { getRecentTasks } = load("api/index", {
    "@raycast/api": { getPreferenceValues: () => ({ token: "test" }) },
    "node-fetch": async (url) => {
      assert.ok(new URL(url).searchParams.get("from"));
      return { ok: true, json: async () => records };
    },
  });
  const result = await getRecentTasks("me", 30);
  assert.deepEqual(
    Array.from(result, (t) => t.id),
    ["b", "a"],
  );
  assert.equal(result[1].time.recent, 90);
  records = [];
  assert.equal((await getRecentTasks("me", 30)).length, 0);
});

test("recent history fetches subsequent pages rather than truncating busy months", async () => {
  const pages = [];
  const { getRecentTasks } = load("api/index", {
    "@raycast/api": { getPreferenceValues: () => ({ token: "test" }) },
    "node-fetch": async (url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      pages.push(page);
      const records =
        page === 1
          ? Array.from({ length: 1000 }, () => ({ date: "2026-01-01", time: 1, task: task("a", "A") }))
          : [{ date: "2026-01-02", time: 30, task: task("b", "B") }];
      return { ok: true, json: async () => records };
    },
  });
  const result = await getRecentTasks("me", 30);
  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.length, 2);
  assert.equal(result.find((t) => t.id === "a").time.recent, 1000);
});

test("search failures surface API errors", async () => {
  const { searchTasks } = load("api/index", {
    "@raycast/api": { getPreferenceValues: () => ({ token: "test" }) },
    "node-fetch": async () => ({ ok: false, json: async () => ({ message: "Rate limited" }) }),
  });
  await assert.rejects(searchTasks("test"), /Rate limited/);
});
