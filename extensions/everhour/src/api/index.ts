import fetch from "node-fetch";
import { getPreferenceValues } from "@raycast/api";
import {
  Project,
  Task,
  TaskTimerResp,
  TaskStopTimerResp,
  CurrentTimerResp,
  TimeRecordResp,
  ErrorResponse,
  TaskResp,
} from "../types";

const API_KEY = getPreferenceValues<Preferences>().token;

const headers = {
  "X-Api-Key": API_KEY,
  "Content-Type": "application/json",
};

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

export const getRecentTasks = async (userId = "me", days = 7): Promise<Task[]> => {
  const [currentDate] = daysAgo(days).toISOString().split("T");
  const timeRecords: TimeRecordResp[] = [];
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.everhour.com/users/${encodeURIComponent(userId)}/time?limit=1000&page=${page}&from=${currentDate}`,
      { headers },
    );
    if (!response.ok) {
      const error = (await response.json()) as ErrorResponse;
      throw new Error(error.message);
    }
    const records = (await response.json()) as TimeRecordResp[];
    timeRecords.push(...records);
    if (records.length < 1000) break;
  }

  const aggregatedTasks = timeRecords.reduce((agg: { [key: string]: Task }, { time, task, date }: TimeRecordResp) => {
    if (!task) return agg;
    if (!agg[task.id]) {
      agg[task.id] = { ...task, time: { total: task.time?.total ?? 0, recent: 0 }, lastWorked: date };
    }
    const entry = agg[task.id];
    entry.time.recent += time;
    if (date > (entry.lastWorked ?? "")) entry.lastWorked = date;
    return agg;
  }, {});

  return Object.values(aggregatedTasks).sort((a, b) => (b.lastWorked ?? "").localeCompare(a.lastWorked ?? ""));
};

export const getProjects = async (): Promise<Project[]> => {
  const response = await fetch("https://api.everhour.com/projects?limit=1000&query=", {
    headers,
  });
  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message);
  }
  const projects = (await response.json()) as Project[];

  return projects.map(({ id, name }: Project) => ({
    id,
    name,
  }));
};

export const getTasks = async (projectId: string): Promise<Task[]> => {
  const response = await fetch(
    `https://api.everhour.com/projects/${projectId}/tasks?page=1&limit=250&excludeClosed=true&query=`,
    {
      headers,
    },
  );
  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message);
  }
  const tasks = (await response.json()) as TaskResp[] as Task[];

  return tasks;
};

export const searchTasks = async (query: string, projectId = "", limit = 50, signal?: AbortSignal): Promise<Task[]> => {
  const path = projectId ? `/projects/${encodeURIComponent(projectId)}/tasks/search` : "/tasks/search";
  const params = new URLSearchParams({ query: query.trim(), limit: String(limit), searchInClosed: "false" });
  const response = await fetch(`https://api.everhour.com${path}?${params}`, { headers, signal });
  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message);
  }
  const tasks = (await response.json()) as TaskResp[];
  return tasks.map((task) => ({ ...task, time: { total: task.time?.total ?? 0, recent: 0 } }));
};

export const getCurrentTimer = async (): Promise<string | null> => {
  const response = await fetch("https://api.everhour.com/timers/current", {
    headers,
  });
  const currentTimer = (await response.json()) as CurrentTimerResp;

  if (currentTimer.status === "stopped") {
    return null;
  }

  return currentTimer.task?.id ?? null;
};

export const startTaskTimer = async (taskId: string): Promise<{ status: string; taskName: string }> => {
  const response = await fetch("https://api.everhour.com/timers", {
    method: "POST",
    headers,
    body: JSON.stringify({
      task: taskId,
    }),
  });
  const respJson = (await response.json()) as TaskTimerResp;

  return {
    status: respJson.status,
    taskName: respJson.task.name,
  };
};

export const stopCurrentTaskTimer = async (): Promise<{ status: string; taskName: string }> => {
  const response = await fetch("https://api.everhour.com/timers/current", {
    method: "DELETE",
    headers,
  });
  const respJson = (await response.json()) as TaskStopTimerResp;

  return {
    status: respJson.status,
    taskName: respJson.taskTime?.task?.name,
  };
};

export const submitTaskHours = async (taskId: string, hours: string): Promise<{ taskName: string }> => {
  const seconds = parseFloat(hours) * 60 * 60;

  const response = await fetch(`https://api.everhour.com/tasks/${taskId}/time`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      time: seconds,
      date: new Date().toISOString().split("T")[0],
    }),
  });
  const respJson = (await response.json()) as TaskTimerResp;

  return {
    taskName: respJson.task?.name,
  };
};
