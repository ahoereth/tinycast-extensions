import { Task } from "../types";

export function groupTaskResults(history: Task[], results: Task[], query: string, projectId: string) {
  const text = query.trim().toLowerCase();
  const matches = (task: Task) =>
    task.status !== "closed" &&
    (!projectId || task.projects.includes(projectId)) &&
    (!text || `${task.name} ${task.number ?? ""}`.toLowerCase().includes(text));
  const recent = history.filter(matches).sort((a, b) => (b.lastWorked ?? "").localeCompare(a.lastWorked ?? ""));
  const seen = new Set(recent.map((task) => task.id));
  const other = results.filter((task) => {
    if (task.status === "closed" || (projectId && !task.projects.includes(projectId)) || seen.has(task.id))
      return false;
    seen.add(task.id);
    return true;
  });
  return { recent, other };
}
