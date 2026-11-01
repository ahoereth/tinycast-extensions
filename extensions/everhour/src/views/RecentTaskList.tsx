import { useState, useEffect } from "react";
import { List, Action, ActionPanel, Icon, showToast, Toast } from "@raycast/api";
import { TaskListItem } from "../components";
import { getRecentTasks, getCurrentTimer, getProjects, searchTasks } from "../api";
import { Project, Task } from "../types";
import { groupTaskResults } from "../utils/task-search";

export function RecentTaskList() {
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [limit, setLimit] = useState(50);
  const [revision, setRevision] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searching, setSearching] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState<{ key: string; tasks: Task[] }>({ key: "", tasks: [] });
  const text = query.trim();
  const searchKey = JSON.stringify([text, projectId, limit]);
  const isSearch = text.length >= 2;
  const results = result.key === searchKey ? result.tasks : [];

  const refreshRecords = async () => {
    const [recent, month] = await Promise.all([getRecentTasks(), getRecentTasks("me", 30)]);
    setRecentTasks(recent);
    setHistory(month);
    return recent;
  };

  const refreshActiveTimer = async () => {
    try {
      setActiveTimerTaskId(await getCurrentTimer());
      await refreshRecords();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Refresh Tasks",
        message: (error as Error).message,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError("");
    Promise.all([getRecentTasks(), getRecentTasks("me", 30), getProjects(), getCurrentTimer()])
      .then(([recent, month, projects, active]) => {
        if (cancelled) return;
        setRecentTasks(recent);
        setHistory(month);
        setProjects(projects.sort((a, b) => a.name.localeCompare(b.name)));
        setActiveTimerTaskId(active);
      })
      .catch((error) => {
        if (!cancelled) setHistoryError((error as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setSearchError("");
    if (!isSearch) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const tasks = await searchTasks(text, projectId, limit, controller.signal);
        if (!controller.signal.aborted) setResult({ key: searchKey, tasks });
      } catch (error) {
        if (!controller.signal.aborted) setSearchError((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, projectId, limit, revision]);

  const groups = groupTaskResults(isSearch ? history : recentTasks, results, text, projectId);
  const recent = isSearch
    ? groups.recent
    : [...groups.recent].sort((a, b) => Number(b.id === activeTimerTaskId) - Number(a.id === activeTimerTaskId));
  const error = historyError || searchError;
  const isLoading = loadingHistory || searching;
  const renderTask = (task: Task, days: number) => (
    <TaskListItem
      key={task.id}
      refreshRecords={refreshRecords}
      refreshActiveTimer={refreshActiveTimer}
      task={task}
      hasActiveTimer={task.id === activeTimerTaskId}
      recentDays={days}
    />
  );

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      searchBarPlaceholder="Search open tasks (at least 2 characters)…"
      onSearchTextChange={(value) => {
        setQuery(value);
        setLimit(50);
      }}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by project"
          value={projectId}
          onChange={(value) => {
            setProjectId(value);
            setLimit(50);
          }}
        >
          <List.Dropdown.Item title="All projects" value="" />
          {projects.map((project) => (
            <List.Dropdown.Item key={project.id} title={project.name} value={project.id} />
          ))}
        </List.Dropdown>
      }
    >
      {error ? (
        <List.Section title="Could not load all tasks" subtitle={error}>
          <List.Item
            id="search:retry"
            title="Retry"
            icon={Icon.ArrowClockwise}
            actions={
              <ActionPanel>
                <Action title="Retry" onAction={() => setRevision((value) => value + 1)} />
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      {text.length === 1 ? (
        <List.EmptyView title="Type at least 2 characters" />
      ) : (
        <>
          {recent.length > 0 ? (
            <List.Section title={isSearch ? undefined : "Last 7 days"}>
              {recent.map((task) => renderTask(task, isSearch ? 30 : 7))}
            </List.Section>
          ) : null}
          {isSearch && groups.other.length > 0 ? (
            <List.Section
              title="Older than 30 days"
              subtitle={limit >= 250 && results.length >= limit ? "Refine your search for more results" : undefined}
            >
              {groups.other.map((task) => renderTask(task, 7))}
            </List.Section>
          ) : null}
          {isSearch && results.length >= limit && limit < 250 ? (
            <List.Item
              id="search:more"
              title="Load more matches"
              icon={Icon.Ellipsis}
              actions={
                <ActionPanel>
                  <Action title="Load More Matches" onAction={() => setLimit((value) => value + 50)} />
                </ActionPanel>
              }
            />
          ) : null}
          {!error && !isLoading && recent.length === 0 && groups.other.length === 0 ? (
            <List.EmptyView
              title={isSearch ? "No matching open tasks" : "No recent tasks"}
              description="Search by task name or choose another project."
            />
          ) : null}
        </>
      )}
    </List>
  );
}
