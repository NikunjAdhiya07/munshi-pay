import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statePath = path.join(root, "board", "state.json");
const skillsRoot = path.join(root, "skills");

const TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "BLOCKED",
  "DONE",
  "HUMAN_REVIEW",
];

const PHASE_STATUS_ORDER = [
  "COMPLETED",
  "IN PROGRESS",
  "REVIEW",
  "BLOCKED",
  "PLANNED",
  "BACKLOG",
];

const KANBAN = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"];

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

const STATUS_LABEL = {
  BACKLOG: "BACKLOG",
  TODO: "TODO",
  IN_PROGRESS: "IN PROGRESS",
  REVIEW: "REVIEW",
  BLOCKED: "BLOCKED",
  DONE: "DONE",
  HUMAN_REVIEW: "HUMAN REVIEW",
  COMPLETED: "COMPLETED",
  PLANNED: "PLANNED",
  "IN PROGRESS": "IN PROGRESS",
};

export function loadState(file = statePath) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function validate(state) {
  const errors = [];
  const phaseIds = new Set((state.phases ?? []).map((p) => p.id));
  const areaIds = new Set((state.areas ?? []).map((a) => a.id));
  const modelIds = new Set((state.models ?? []).map((m) => m.id));
  const taskIds = new Set();

  if (!state.project?.name) errors.push("project.name is required");
  if (!Array.isArray(state.phases) || state.phases.length === 0) {
    errors.push("at least one phase is required");
  }
  if (!Array.isArray(state.tasks)) errors.push("tasks array is required");

  for (const task of state.tasks ?? []) {
    if (taskIds.has(task.id)) errors.push(`duplicate task id ${task.id}`);
    taskIds.add(task.id);
    if (!TASK_STATUSES.includes(task.status)) {
      errors.push(`${task.id} has invalid status ${task.status}`);
    }
    if (!phaseIds.has(task.phaseId))
      errors.push(`${task.id} references unknown phase ${task.phaseId}`);
    if (!areaIds.has(task.areaId))
      errors.push(`${task.id} references unknown area ${task.areaId}`);
    if (!modelIds.has(task.modelId))
      errors.push(`${task.id} references unknown model ${task.modelId}`);
    if (!(task.priority in PRIORITY_RANK))
      errors.push(`${task.id} has invalid priority ${task.priority}`);
    if (task.status === "DONE" && !passingTests(task)) {
      errors.push(`${task.id} is DONE without a passing test record`);
    }
    if (task.status === "HUMAN_REVIEW" && !task.humanReview) {
      errors.push(`${task.id} is HUMAN_REVIEW without humanReview details`);
    }
    if (task.status === "BLOCKED" && !task.blocker) {
      errors.push(`${task.id} is BLOCKED without a blocker`);
    }
  }

  for (const task of state.tasks ?? []) {
    for (const dep of task.dependencies ?? []) {
      if (!taskIds.has(dep))
        errors.push(`${task.id} depends on unknown task ${dep}`);
    }
  }

  for (const item of state.projectBlockers ?? []) {
    for (const field of ["id", "why", "unknown", "action", "after"]) {
      if (!item[field])
        errors.push(`project blocker ${item.id ?? "?"} missing ${field}`);
    }
  }

  return errors;
}

function passingTests(task) {
  return (task.tests ?? []).some((test) => test.status === "PASS");
}

export function moveTask(state, id, status) {
  if (!TASK_STATUSES.includes(status) || status === "HUMAN_REVIEW") {
    return {
      ok: false,
      error:
        "Drop the card on Backlog, To do, In progress, Review, Blocked, or Done.",
    };
  }
  const task = (state.tasks ?? []).find((item) => item.id === id);
  if (!task) return { ok: false, error: `No task ${id}.` };
  if (status === "DONE" && !passingTests(task)) {
    return {
      ok: false,
      error: "Done needs a passing test. Move the card to Review instead.",
    };
  }
  task.status = status;
  if (status === "IN_PROGRESS" && !task.startedAt) {
    task.startedAt = new Date().toISOString().slice(0, 10);
  }
  if (status === "BACKLOG" || status === "TODO") {
    delete task.startedAt;
  }
  if (status === "BLOCKED") {
    task.blocker = task.blocker || "Moved to Blocked on the execution board.";
  } else {
    delete task.blocker;
  }
  state.project.updatedAt = new Date().toISOString().slice(0, 10);
  const errors = validate(state);
  if (errors.length) return { ok: false, error: errors.join(" ") };
  return { ok: true };
}

export function derivePhaseStatus(tasks) {
  if (tasks.length === 0) return "PLANNED";
  const statuses = new Set(tasks.map((task) => task.status));
  if ([...statuses].every((status) => status === "DONE")) return "COMPLETED";
  if (statuses.has("IN_PROGRESS")) return "IN PROGRESS";
  if (statuses.has("REVIEW") || statuses.has("HUMAN_REVIEW")) return "REVIEW";
  if (statuses.has("DONE")) return "IN PROGRESS";
  if (statuses.has("BLOCKED") && !statuses.has("TODO")) return "BLOCKED";
  if (statuses.has("TODO")) return "PLANNED";
  if (statuses.has("BLOCKED")) return "BLOCKED";
  return "BACKLOG";
}

export function percentTenths(counts, total) {
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((count) => (count * 1000) / total);
  const floors = raw.map((value) => Math.floor(value));
  const leftover = 1000 - floors.reduce((sum, value) => sum + value, 0);
  const ranked = raw
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let n = 0; n < leftover; n += 1) floors[ranked[n].index] += 1;
  return floors.map((value) => value / 10);
}

function taskSort(a, b) {
  const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priority !== 0) return priority;
  return a.id.localeCompare(b.id);
}

function depsDone(task, byId) {
  return (task.dependencies ?? []).every(
    (id) => byId.get(id)?.status === "DONE",
  );
}

const MODEL_HINT = {
  "cursor-fast": "Simple edits, scripts, and checklists",
  "cursor-grok": "Screens, flows, and integration",
  "claude-sonnet": "Schema, records, and reports",
  "claude-opus": "Architecture, payroll math, and security",
};

export function assignModelId(task, models = []) {
  const ids = new Set(models.map((model) => model.id));
  const pick = (id) => {
    if (ids.size === 0 || ids.has(id)) return id;
    return models[0]?.id ?? id;
  };
  const area = task.areaId;
  if (
    area === "payroll-engine" ||
    area === "architecture" ||
    area === "security"
  ) {
    return pick("claude-opus");
  }
  if (area === "authentication") return pick("cursor-grok");
  if (area === "database" || area === "backend" || area === "reports") {
    return pick("claude-sonnet");
  }
  if (
    area === "foundation" ||
    area === "testing" ||
    area === "devops" ||
    area === "documentation" ||
    area === "design-system"
  ) {
    return pick("cursor-fast");
  }
  return pick("cursor-grok");
}

function assignMissingModels(state) {
  for (const task of state.tasks ?? []) {
    if (task.modelId) continue;
    task.modelId = assignModelId(task, state.models ?? []);
  }
}

function remember(state, text) {
  if (!Array.isArray(state.project.activity)) state.project.activity = [];
  state.project.activity.unshift({
    at: new Date().toISOString(),
    text,
  });
  state.project.activity = state.project.activity.slice(0, 20);
}

export function runQueue(state) {
  assignMissingModels(state);
  const byId = new Map((state.tasks ?? []).map((task) => [task.id, task]));
  const queued = [];
  for (const task of state.tasks ?? []) {
    if (task.status !== "BACKLOG") continue;
    if (!depsDone(task, byId)) continue;
    task.status = "TODO";
    queued.push(task);
  }
  const active = (state.tasks ?? []).some(
    (task) => task.status === "IN_PROGRESS",
  );
  let started = null;
  if (!active) {
    const next = (state.tasks ?? [])
      .filter((task) => task.status === "TODO" && depsDone(task, byId))
      .sort(taskSort)[0];
    if (next) {
      next.status = "IN_PROGRESS";
      if (!next.startedAt)
        next.startedAt = new Date().toISOString().slice(0, 10);
      started = next;
    }
  }
  if (queued.length || started) {
    const parts = [];
    if (queued.length) parts.push(`Queued ${queued.length} ready tasks`);
    if (started) {
      parts.push(`Started ${started.id} on ${started.modelId}`);
    }
    remember(state, parts.join(". "));
    state.project.updatedAt = new Date().toISOString().slice(0, 10);
  }
  const errors = validate(state);
  if (errors.length) return { ok: false, error: errors.join(" ") };
  return {
    ok: true,
    queued: queued.map((task) => task.id),
    started: started?.id ?? null,
  };
}

export function addTask(state, title) {
  const name = String(title ?? "")
    .trim()
    .slice(0, 160);
  if (!name) return { ok: false, error: "Enter a task title." };
  const phaseId =
    (state.phases ?? []).find((phase) => phase.id === "P5")?.id ??
    state.phases?.[0]?.id;
  const areaId =
    (state.areas ?? []).find((area) => area.id === "frontend")?.id ??
    state.areas?.[0]?.id;
  const numbers = (state.tasks ?? []).map((task) => {
    const match = /^T-(\d+)$/.exec(task.id);
    return match ? Number(match[1]) : 0;
  });
  const id = `T-${String(Math.max(0, ...numbers) + 1).padStart(3, "0")}`;
  const task = {
    id,
    title: name,
    phaseId,
    areaId,
    priority: "P2",
    status: "TODO",
    modelId: "",
    dependencies: [],
    tests: [],
  };
  task.modelId = assignModelId(task, state.models ?? []);
  state.tasks.push(task);
  const errors = validate(state);
  if (errors.length) {
    state.tasks.pop();
    return { ok: false, error: errors.join(" ") };
  }
  remember(state, `${id} added and assigned to ${task.modelId}`);
  state.project.updatedAt = new Date().toISOString().slice(0, 10);
  return { ok: true, id };
}

export function derive(state) {
  const tasks = state.tasks ?? [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const phases = (state.phases ?? []).map((phase) => {
    const phaseTasks = tasks.filter((task) => task.phaseId === phase.id);
    const done = phaseTasks.filter((task) => task.status === "DONE").length;
    const progress =
      phaseTasks.length === 0
        ? 0
        : Math.round((done / phaseTasks.length) * 100);
    return {
      ...phase,
      status: derivePhaseStatus(phaseTasks),
      progress,
      done,
      total: phaseTasks.length,
      tasks: [...phaseTasks].sort(taskSort),
    };
  });

  const phaseStatusCounts = PHASE_STATUS_ORDER.map(
    (status) => phases.filter((phase) => phase.status === status).length,
  );
  const phaseStatusPercents = percentTenths(phaseStatusCounts, phases.length);
  const phaseStatus = PHASE_STATUS_ORDER.map((status, index) => ({
    status,
    count: phaseStatusCounts[index],
    percent: phaseStatusPercents[index],
  }));

  const areas = (state.areas ?? []).map((area) => {
    const areaTasks = tasks.filter((task) => task.areaId === area.id);
    const completed = areaTasks.filter((task) => task.status === "DONE").length;
    const active = areaTasks.filter((task) =>
      ["IN_PROGRESS", "REVIEW", "HUMAN_REVIEW"].includes(task.status),
    ).length;
    const blocked = areaTasks.filter(
      (task) => task.status === "BLOCKED",
    ).length;
    const progress =
      areaTasks.length === 0
        ? 0
        : Math.round((completed / areaTasks.length) * 100);
    return {
      ...area,
      total: areaTasks.length,
      completed,
      active,
      blocked,
      progress,
    };
  });

  const done = tasks.filter((task) => task.status === "DONE").length;
  const overall =
    tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

  const workload = (state.models ?? []).map((model) => ({
    ...model,
    tasks: tasks
      .filter(
        (task) =>
          task.modelId === model.id &&
          ["IN_PROGRESS", "REVIEW", "HUMAN_REVIEW", "BLOCKED"].includes(
            task.status,
          ),
      )
      .sort(taskSort),
  }));

  const humanReview = [
    ...tasks
      .filter((task) => task.status === "HUMAN_REVIEW" && task.humanReview)
      .map((task) => ({
        id: task.id,
        title: task.title,
        ...task.humanReview,
      })),
    ...(state.projectBlockers ?? []).filter((item) => item.needsHuman),
  ];

  const blockers = [
    ...tasks
      .filter((task) => task.status === "BLOCKED")
      .map((task) => ({
        id: task.id,
        title: task.title,
        detail: task.blocker,
      })),
    ...(state.projectBlockers ?? [])
      .filter((item) => !item.needsHuman)
      .map((item) => ({ id: item.id, title: item.why, detail: item.unknown })),
  ];

  const testing = tasks.flatMap((task) =>
    (task.tests ?? []).map((test) => ({
      taskId: task.id,
      title: task.title,
      phaseId: task.phaseId,
      modelId: task.modelId,
      ...test,
    })),
  );

  const next = tasks
    .filter(
      (task) =>
        ["TODO", "IN_PROGRESS"].includes(task.status) && depsDone(task, byId),
    )
    .sort(taskSort);

  const kanban = Object.fromEntries(
    KANBAN.map((column) => [
      column,
      tasks
        .filter((task) =>
          column === "REVIEW"
            ? task.status === "REVIEW" || task.status === "HUMAN_REVIEW"
            : task.status === column,
        )
        .sort(taskSort),
    ]),
  );

  return {
    project: state.project,
    models: state.models ?? [],
    phases,
    phaseStatus,
    areas: areas.filter((area) => area.total > 0),
    tasks,
    workload,
    humanReview,
    blockers,
    testing,
    next,
    kanban,
    overall,
    done,
    total: tasks.length,
  };
}

function bar(percent) {
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function fmtPercent(value) {
  return `${value.toFixed(1)}%`;
}

function modelName(view, id) {
  return view.models.find((model) => model.id === id)?.name ?? id;
}

function skillRecords() {
  if (!fs.existsSync(skillsRoot)) return [];
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(skillsRoot, entry.name, "SKILL.md");
      if (!fs.existsSync(file)) return null;
      const text = fs.readFileSync(file, "utf8");
      const meta = parseFrontmatter(text);
      return {
        name: meta.name || entry.name,
        description: meta.description || "",
        version: meta.version || "0.1.0",
        updated: meta.updated || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return data;
}

export function renderBoard(view) {
  const lines = [];
  lines.push("<!-- Generated from board/state.json. Do not edit by hand. -->");
  lines.push("");
  lines.push("```text");
  lines.push("=========================================================");
  lines.push("       PAYROLL PLATFORM");
  lines.push("              EXECUTION BOARD");
  lines.push("=========================================================");
  lines.push("```");
  lines.push("");
  lines.push(
    `Source: \`board/state.json\` · updated ${view.project.updatedAt}`,
  );
  lines.push("");
  lines.push(
    `Overall progress: **${view.overall}%** (${view.done}/${view.total} tasks done)`,
  );
  lines.push("");
  lines.push("## Project phases");
  lines.push("");
  lines.push("```text");
  for (const phase of view.phases) {
    const label = `${phase.id} ${phase.name}`.padEnd(42, " ");
    lines.push(
      `${label} ${bar(phase.progress)} ${String(phase.progress).padStart(3, " ")}%  ${phase.status}`,
    );
  }
  lines.push("```");
  lines.push("");
  lines.push("## Phase status");
  lines.push("");
  lines.push(
    "Percentages are calculated from phase counts with the largest-remainder method.",
  );
  lines.push("");
  lines.push("| Status | Phases | Share |");
  lines.push("| --- | ---: | ---: |");
  for (const row of view.phaseStatus) {
    lines.push(`| ${row.status} | ${row.count} | ${fmtPercent(row.percent)} |`);
  }
  lines.push("");
  const slices = view.phaseStatus.filter((row) => row.count > 0);
  if (slices.length > 0) {
    lines.push("```mermaid");
    lines.push("pie showData");
    lines.push("    title Phase status distribution");
    for (const row of slices) {
      lines.push(`    "${row.status}" : ${row.count}`);
    }
    lines.push("```");
    lines.push("");
    lines.push(
      "Statuses with a zero count are omitted from the chart and listed in the table.",
    );
    lines.push("");
  }
  lines.push("## Areas");
  lines.push("");
  lines.push("| Area | Tasks | Done | Active | Blocked | Progress |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const area of view.areas) {
    lines.push(
      `| ${area.name} | ${area.total} | ${area.completed} | ${area.active} | ${area.blocked} | ${area.progress}% |`,
    );
  }
  lines.push("");
  lines.push("## AI model workload");
  lines.push("");
  lines.push(
    "Models are configured in `board/state.json`. Assignment is per task.",
  );
  lines.push("");
  for (const model of view.workload) {
    lines.push(`### ${model.name}`);
    lines.push("");
    if (model.tasks.length === 0) {
      lines.push("Idle.");
      lines.push("");
      continue;
    }
    for (const task of model.tasks) {
      const phase = view.phases.find((item) => item.id === task.phaseId);
      lines.push(`- ${task.title}`);
      lines.push(`  - Task: \`${task.id}\``);
      lines.push(
        `  - Area: ${view.areas.find((area) => area.id === task.areaId)?.name ?? task.areaId}`,
      );
      lines.push(`  - Phase: ${task.phaseId} ${phase?.name ?? ""}`.trimEnd());
      lines.push(`  - Status: ${STATUS_LABEL[task.status]}`);
      lines.push(`  - Started: ${task.startedAt ?? "—"}`);
      lines.push(`  - Expected completion: ${task.expectedCompletion ?? "—"}`);
      lines.push(`  - Output: ${task.output || "—"}`);
    }
    lines.push("");
  }
  lines.push("## Testing queue");
  lines.push("");
  if (view.testing.length === 0) {
    lines.push("No completed implementation has entered the queue yet.");
  } else {
    lines.push(
      "| Task | Phase | Agent | Test type | Status | Result | Failures | Required action |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const test of view.testing) {
      lines.push(
        `| ${test.title} | ${test.phaseId} | ${modelName(view, test.modelId)} | ${test.type} | ${test.status} | ${test.result || "—"} | ${test.failures || "—"} | ${test.action || "—"} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Kanban");
  lines.push("");
  lines.push("| BACKLOG | TODO | IN PROGRESS | REVIEW | BLOCKED | DONE |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  const columns = KANBAN.map((column) => view.kanban[column]);
  const height = Math.max(1, ...columns.map((column) => column.length));
  for (let index = 0; index < height; index += 1) {
    const cells = columns.map((column) => {
      const task = column[index];
      if (!task) return " ";
      const mark = task.status === "HUMAN_REVIEW" ? " (human)" : "";
      return `${task.id} ${task.title}${mark}`;
    });
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Human review required");
  lines.push("");
  if (view.humanReview.length === 0) {
    lines.push("Nothing is waiting on you.");
  } else {
    for (const item of view.humanReview) {
      lines.push(`### ${item.title}`);
      lines.push("");
      lines.push(`- Why human input is required: ${item.why}`);
      lines.push(`- What the agent could not determine: ${item.unknown}`);
      lines.push(`- What you need to do: ${item.action}`);
      lines.push(`- What happens after approval: ${item.after}`);
      lines.push("");
    }
  }
  lines.push("## Current blockers");
  lines.push("");
  if (view.blockers.length === 0) {
    lines.push("No blockers.");
  } else {
    for (const blocker of view.blockers) {
      lines.push(`- **${blocker.id}** ${blocker.title}: ${blocker.detail}`);
    }
  }
  lines.push("");
  lines.push("## Next automatic actions");
  lines.push("");
  if (view.next.length === 0) {
    lines.push("No unblocked work is queued.");
  } else {
    view.next.slice(0, 8).forEach((task, index) => {
      lines.push(
        `${index + 1}. \`${task.id}\` ${task.title} (${task.phaseId}, ${modelName(view, task.modelId)})`,
      );
    });
  }
  lines.push("");
  lines.push("## Phase detail");
  lines.push("");
  for (const phase of view.phases) {
    lines.push(`### ${phase.id} — ${phase.name}`);
    lines.push("");
    lines.push(`- Objective: ${phase.objective}`);
    lines.push(`- Status: ${phase.status}`);
    lines.push(`- Progress: ${phase.progress}% (${phase.done}/${phase.total})`);
    lines.push(
      `- Dependencies: ${(phase.dependencies ?? []).join(", ") || "None"}`,
    );
    lines.push(
      `- Blockers: ${
        phase.tasks
          .filter((task) => task.blocker)
          .map((task) => task.blocker)
          .join("; ") || "None"
      }`,
    );
    lines.push(
      `- Deliverables: ${(phase.deliverables ?? []).join("; ") || "None recorded"}`,
    );
    lines.push("- Tasks:");
    for (const task of phase.tasks) {
      lines.push(
        `  - \`${task.id}\` ${task.title} — ${STATUS_LABEL[task.status]} — ${modelName(view, task.modelId)}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function renderStatus(view) {
  const current =
    view.phases.find((phase) => phase.status === "IN PROGRESS") ??
    view.phases.find((phase) => phase.status !== "COMPLETED");
  const active = view.tasks.filter((task) => task.status === "IN_PROGRESS");
  const lines = [];
  lines.push("<!-- Generated from board/state.json. Do not edit by hand. -->");
  lines.push("");
  lines.push("# Project Status");
  lines.push("");
  lines.push(`Overall progress: ${view.overall}%`);
  lines.push("");
  lines.push("Current phase:");
  lines.push("");
  lines.push(current ? `${current.id} — ${current.name}` : "None");
  lines.push("");
  lines.push("Currently working:");
  lines.push("");
  if (active.length === 0) lines.push("- Nothing is in progress.");
  for (const task of active) lines.push(`- ${task.title}`);
  lines.push("");
  const passed = view.testing.filter((test) => test.status === "PASS").length;
  const failed = view.testing.filter((test) => test.status === "FAIL").length;
  const running = view.testing.filter(
    (test) => test.status === "RUNNING",
  ).length;
  lines.push("Testing:");
  lines.push("");
  lines.push(`- ${passed} passed`);
  lines.push(`- ${failed} failed`);
  lines.push(`- ${running} running`);
  lines.push("");
  lines.push("Blocked:");
  lines.push("");
  if (view.blockers.length === 0) lines.push("- None");
  for (const blocker of view.blockers) lines.push(`- ${blocker.title}`);
  lines.push("");
  lines.push("Human review:");
  lines.push("");
  if (view.humanReview.length === 0) lines.push("- None");
  for (const item of view.humanReview) lines.push(`- ${item.title}`);
  lines.push("");
  lines.push("Next:");
  lines.push("");
  if (view.next.length === 0) lines.push("- No unblocked work is queued.");
  for (const task of view.next.slice(0, 5)) lines.push(`- ${task.title}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderTodo(view) {
  const lines = [];
  lines.push("<!-- Generated from board/state.json. Do not edit by hand. -->");
  lines.push("");
  lines.push("# To do");
  lines.push("");
  lines.push(
    "Completed tasks are omitted. Change status in `board/state.json`, then run `npm run board`.",
  );
  lines.push("");
  const groups = [
    "IN_PROGRESS",
    "REVIEW",
    "HUMAN_REVIEW",
    "TODO",
    "BLOCKED",
    "BACKLOG",
  ];
  for (const phase of view.phases) {
    const open = phase.tasks.filter((task) => task.status !== "DONE");
    if (open.length === 0) continue;
    lines.push(`## ${phase.id} — ${phase.name}`);
    lines.push("");
    for (const status of groups) {
      const items = open.filter((task) => task.status === status);
      if (items.length === 0) continue;
      lines.push(`### ${STATUS_LABEL[status]}`);
      lines.push("");
      for (const task of items) {
        const deps = (task.dependencies ?? []).length
          ? ` · depends on ${task.dependencies.join(", ")}`
          : "";
        lines.push(
          `- \`${task.id}\` ${task.title} · ${modelName(view, task.modelId)}${deps}`,
        );
      }
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderSkillRegistry(records) {
  const lines = [];
  lines.push("<!-- Generated from skills/*/SKILL.md. Do not edit by hand. -->");
  lines.push("");
  lines.push("# Skill registry");
  lines.push("");
  lines.push(
    "Canonical skills live in `skills/`. `npm run board` copies each skill to `.claude/skills/` and `.cursor/skills/`.",
  );
  lines.push("");
  lines.push(
    "| Skill | Purpose | Trigger | Agent | Status | Version | Last updated |",
  );
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const skill of records) {
    const purpose = skill.description
      .split(". Use when")[0]
      .replaceAll("|", "/");
    const trigger = skill.description.includes("Use when")
      ? skill.description
          .slice(skill.description.indexOf("Use when"))
          .replaceAll("|", "/")
      : "See skill description";
    lines.push(
      `| ${skill.name} | ${purpose} | ${trigger} | Cursor and Claude Code | Active | ${skill.version} | ${skill.updated} |`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const PHASE_COLORS = {
  COMPLETED: "#0F6E56",
  "IN PROGRESS": "#1F4E79",
  REVIEW: "#9A3412",
  BLOCKED: "#9F1239",
  PLANNED: "#8A8175",
  BACKLOG: "#5C6B7A",
};

const PAGE_COPY = {
  "/": "Sign in with User Id and Password, then Submit. The reference has no forgot-password link and no self-registration. A valid sign-in continues to company selection.",
  "/CompanyList/CmpList":
    "Lists the companies this login may open. Choosing Enter selects that company. Logout returns to sign-in.",
  "/CompanyList/SelectCompany":
    "Confirms the selected company before payroll data is shown.",
  "/Home/Index":
    "Dashboard for the active company: pending applications, active employees, companies, the salary-process month, payroll-run count, missing identity fields, news, and events such as birthdays, joiners, and leavers.",
  "/Company/Index":
    "Company profile. Tabs cover company details, allowance heads, and other details, including address, bank, PF, ESI, professional tax, pay rules, and owners.",
  "/Employee/Index":
    "Employee list with code, name, designation, department, join and birth dates, left date, UAN, PF, ESI, and site. Search, sort, and paging match the shared grid.",
  "/Employee/Create":
    "Creates an employee. Code and name and join date are required. Salary base, bank, PF, and ESI flags are set here.",
  "/Employee/Edit":
    "Employee profile: identity, job, salary bank, PF, and ESI. Left date is available on edit.",
  "/Employee/OtherDtl":
    "Category, shift, contacts, and the PF bank, separate from the salary bank on the profile.",
  "/Employee/SalaryDtl":
    "Salary history for one employee: category, as-on date, gross, CTC, earning heads, employer contributions, and take-home.",
  "/Employee/NomineeDtl": "Nominees and family members for the employee.",
  "/Employee/DocumentDtl": "Uploaded identity documents for the employee.",
  "/ImportData/Index":
    "Excel import hub for employees, salary rates, nominees, deductions, leave opening, leave flow, and attendance.",
  "/ExportData/Index":
    "Excel export for employees, salary rates, month salary, month deductions, and a transfer-to-mobile-app group.",
  "/SETPercentage/Index":
    "Category-level percentage splits for gross or CTC: basic, DA, PF, ESI, and leave.",
  "/PT/Create":
    "Professional-tax slabs: as-on date, state, lower limit, upper limit, and amount. Overlapping slabs still need a confirmed rule.",
  "/Dmast/Create":
    "Miscellaneous lists such as department and designation. Type and description are required.",
  "/HolidayMaster/Create": "Holiday dates for a year, with a description.",
  "/ThoughtMaster/Create":
    "A dated thought shown in the product. Date is required.",
  "/FlowMaster/Create":
    "Leave-flow master: a category and four code/name pairs. How it drives approval still needs confirmation.",
  "/RateChange/Create": "Rate change entry for salary rates.",
  "/ShiftMaster/Index_ShiftMaster":
    "Shift master used by employee other-details and attendance.",
  "/MusterNew/Index":
    "Monthly muster. This is the attendance screen. There is no separate daily-attendance menu.",
  "/Loan/Index":
    "Loan list and entry. Creating a loan was unauthorized for the observed login.",
  "/Deductionhead/Index":
    "Deduction-head entry. Creating a head was unauthorized for the observed login.",
  "/Transaction/Index": "Salary summary for an accounting year.",
  "/SalaryProcess/SalaryProcess":
    "Process salary for a month. The reference action was not submitted.",
  "/SalaryEntry/SalaryEntryList": "Salary entry list after processing.",
  "/QuickSalaryProcess/Index": "Quick salary entry for a faster monthly run.",
  "/FullAndFinal/FullAndFinalList":
    "Full and final settlement list, with a worksheet at /FullAndFinal/FullAndFinalView.",
  "/LeaveMaster/Create":
    "Leave master. Create was unauthorized for the observed login.",
  "/LeavePolicy/Index":
    "Leave policy by pay cadre, leave name, duration, and ratio. Create was denied for the observed login.",
  "/LeaveOpening/Create":
    "Leave register: year, employee, and six leave buckets with brought-forward, yearly, and balance figures.",
  "/LeaveCarryForward/Index":
    "Carry forward from the current year to the next year, using the same six leave buckets.",
  "/LeaveEncash/Index":
    "Leave encashment slips: year, employee strength, leave name, amount, used leave, and cash leave.",
  "/ITMaster/Index":
    "Menu target only. The page was missing on the reference deployment. Income-tax output still appears under reports.",
  "/ReportList/Index":
    "Grouped payroll reports, including salary register, salary slip, and income-tax forms.",
  "/UserRole/Create": "Create a role with a name and status.",
  "/UserMaster/Index": "Users with a role and selected company.",
  "/UserRights/Index": "Rights by role and menu: view, add, edit, and delete.",
  "/DataLock/Index_EssLock":
    "Lock or unlock employee self-service by department.",
  "/DataLock/Index_DataLock":
    "Lock or unlock salary and attendance for a month.",
  "/RetrievePassword/Index":
    "Retrieve an employee password by code. The reference screen was not submitted.",
  "/TransferEmployee/Create":
    "Transfer an employee to another company on a date.",
  "/MergeCode/Create": "Merge an employee code into a new code.",
};

function taskDescription(view, task) {
  if (task.description) return task.description;
  if (task.page?.path && PAGE_COPY[task.page.path])
    return PAGE_COPY[task.page.path];
  if (task.title === "Task entry" || task.title === "News entry") {
    return "Menu item on the reference site. The create page returned unauthorized, so the URL was not recorded. The dashboard still shows a task counter and a news panel.";
  }
  const phase = view.phases.find((item) => item.id === task.phaseId);
  const parts = [];
  if (phase) parts.push(`${phase.name}. ${phase.objective}`);
  if (task.output) parts.push(task.output);
  if (task.humanReview?.why) parts.push(task.humanReview.why);
  return parts.join(" ") || task.title;
}

function ticketCatalog(view) {
  return view.tasks.map((task) => {
    const phase = view.phases.find((item) => item.id === task.phaseId);
    const area = view.areas.find((item) => item.id === task.areaId);
    const dependencies = (task.dependencies ?? [])
      .map((id) => view.tasks.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => ({
        id: item.id,
        title: item.title,
        status: STATUS_LABEL[item.status] ?? item.status,
      }));
    const dependents = view.tasks
      .filter((item) => (item.dependencies ?? []).includes(task.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        status: STATUS_LABEL[item.status] ?? item.status,
      }));
    const related = task.page
      ? view.tasks
          .filter(
            (item) =>
              item.id !== task.id && item.page?.group === task.page.group,
          )
          .map((item) => ({
            id: item.id,
            title: item.title,
            path: item.page.path || "",
          }))
      : [];
    return {
      id: task.id,
      title: task.title,
      status: STATUS_LABEL[task.status] ?? task.status,
      statusCode: task.status,
      phaseId: task.phaseId,
      phaseName: phase?.name ?? task.phaseId,
      phaseObjective: phase?.objective ?? "",
      area: area?.name ?? task.areaId,
      model: modelName(view, task.modelId),
      priority: task.priority,
      description: taskDescription(view, task),
      done: Array.isArray(task.done) ? task.done : [],
      todo: Array.isArray(task.todo) ? task.todo : [],
      output: task.output || "",
      blocker: task.blocker || "",
      startedAt: task.startedAt || "",
      expectedCompletion: task.expectedCompletion || "",
      page: task.page
        ? {
            group: task.page.group || "",
            path: task.page.path || "",
            order: task.page.order ?? 0,
          }
        : null,
      dependencies,
      dependents,
      related,
      tests: (task.tests ?? []).map((test) => ({
        type: test.type,
        status: test.status,
        result: test.result || "",
      })),
      humanReview: task.humanReview
        ? {
            why: task.humanReview.why,
            unknown: task.humanReview.unknown,
            action: task.humanReview.action,
            after: task.humanReview.after,
          }
        : null,
    };
  });
}

function checkpointLine(task) {
  const done = Array.isArray(task.done) ? task.done.length : 0;
  const todo = Array.isArray(task.todo) ? task.todo.length : 0;
  if (!done && !todo) return "";
  return `<p class="quiet">${done} done · ${todo} to do</p>`;
}

const COLUMN_META = [
  { status: "BACKLOG", label: "Backlog", color: "#2dd4bf" },
  { status: "TODO", label: "To Do", color: "#60a5fa" },
  { status: "IN_PROGRESS", label: "In Progress", color: "#f59e0b" },
  { status: "REVIEW", label: "Review", color: "#a78bfa" },
  { status: "BLOCKED", label: "Blocked", color: "#fb7185" },
  { status: "DONE", label: "Done", color: "#34d399" },
];

const SLICE_COLOR = {
  BACKLOG: "#64748b",
  TODO: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  REVIEW: "#a78bfa",
  BLOCKED: "#fb7185",
  DONE: "#22c55e",
};

const MODEL_TONE = {
  "cursor-fast": "fast",
  "cursor-grok": "grok",
  "claude-sonnet": "sonnet",
  "claude-opus": "opus",
};

const PHASE_BAR = [
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f59e0b",
  "#22d3ee",
  "#fb7185",
  "#818cf8",
  "#4ade80",
  "#f472b6",
  "#38bdf8",
  "#facc15",
  "#2dd4bf",
  "#c084fc",
  "#94a3b8",
  "#fb923c",
];

function priorityTone(priority) {
  if (priority === "P0") return "high";
  if (priority === "P1") return "medium";
  return "low";
}

function modelShort(view, id) {
  if (id === "claude-sonnet") return "Sonnet";
  if (id === "claude-opus") return "Opus";
  if (id === "cursor-fast") return "Cursor Fast";
  if (id === "cursor-grok") return "Cursor Grok";
  return modelName(view, id);
}

function areaLabel(view, id) {
  return view.areas.find((area) => area.id === id)?.name ?? id;
}

function formatWhen(value) {
  const text = String(value ?? "");
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  if (text.includes("T")) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusDonut(slices, percent) {
  const total = slices.reduce((sum, row) => sum + row.count, 0) || 1;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = slices
    .filter((row) => row.count > 0)
    .map((row) => {
      const length = (row.count / total) * circumference;
      const dash = `${length} ${circumference - length}`;
      const arc = `<circle cx="60" cy="60" r="${radius}" fill="none" stroke="${row.color}" stroke-width="12" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)" />`;
      offset += length;
      return arc;
    })
    .join("");
  return `<svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label="${percent} percent of tasks done">${arcs}<text x="60" y="66" text-anchor="middle" fill="#f8fafc" font-size="22" font-weight="700">${percent}%</text></svg>`;
}

function orderedColumn(view, status) {
  const tasks = view.kanban[status] ?? [];
  if (status !== "BACKLOG") return tasks;
  const pages = tasks
    .filter((task) => task.page)
    .sort(
      (a, b) =>
        (a.page.order ?? 0) - (b.page.order ?? 0) || a.id.localeCompare(b.id),
    );
  return [...pages, ...tasks.filter((task) => !task.page)];
}

function cardHtml(view, task) {
  const path = task.page?.path
    ? `<p class="path">munshipay.com${escapeHtml(task.page.path)}</p>`
    : task.page
      ? `<p class="path">Path not observed on the reference login</p>`
      : "";
  const tone = MODEL_TONE[task.modelId] || "grok";
  const priority = priorityTone(task.priority);
  const human =
    task.status === "HUMAN_REVIEW"
      ? `<span class="chip human">human</span>`
      : "";
  return `<article class="card" draggable="true" data-id="${escapeHtml(task.id)}" data-phase="${escapeHtml(task.phaseId)}" data-area="${escapeHtml(task.areaId)}" data-model="${escapeHtml(task.modelId)}">
    <h3>${escapeHtml(task.title)}</h3>
    <div class="chips">
      <span class="chip">${escapeHtml(task.id)}</span>
      <span class="chip">${escapeHtml(task.phaseId)}</span>
      <span class="chip" title="${escapeHtml(areaLabel(view, task.areaId))}">${escapeHtml(task.areaId)}</span>
      <span class="chip pri ${priority}">${priority}</span>
      ${human}
    </div>
    ${path}
    ${checkpointLine(task)}
    <div class="card-foot"><span class="badge ${tone}">${escapeHtml(modelShort(view, task.modelId))}</span></div>
  </article>`;
}

export function renderHtml(view) {
  const columns = COLUMN_META.filter(
    (column) => column.status !== "BLOCKED" || view.kanban.BLOCKED.length > 0,
  );
  const counts = columns.map((column) => ({
    status: column.status,
    label: column.label,
    color: SLICE_COLOR[column.status],
    count: (view.kanban[column.status] ?? []).length,
  }));
  const statusLegend = counts
    .map(
      (row) =>
        `<li><i style="background:${row.color}"></i><span>${escapeHtml(row.label)}</span><b>${row.count}</b></li>`,
    )
    .join("");
  const phaseBars = view.phases
    .map((phase, index) => {
      const color =
        phase.progress === 100
          ? "#34d399"
          : PHASE_BAR[index % PHASE_BAR.length];
      return `<li>
        <span class="phase-name"><b>${escapeHtml(phase.id)}</b> ${escapeHtml(phase.name)}</span>
        <span class="bar" role="img" aria-label="${phase.progress} percent"><span style="width:${phase.progress}%;background:${color}"></span></span>
        <span class="frac">${phase.done}/${phase.total}</span>
      </li>`;
    })
    .join("");
  const openTests = [
    ...view.kanban.IN_PROGRESS,
    ...view.kanban.REVIEW,
    ...view.kanban.TODO,
  ]
    .filter(
      (task) => !(task.tests ?? []).some((test) => test.status === "PASS"),
    )
    .slice(0, 4);
  const testing =
    openTests.length === 0
      ? `<p class="quiet">Nothing is waiting for a test. Run the queue to start the next ready task.</p>`
      : openTests
          .map((task) => {
            const steps = Array.isArray(task.todo) ? task.todo.length : 0;
            const detail =
              steps > 0
                ? `${steps} step${steps === 1 ? "" : "s"} to do. Open the card for details.`
                : "Open the card for the test record.";
            return `<article class="queue-item"><h3>${escapeHtml(task.id)} ${escapeHtml(task.title)}</h3><p>${escapeHtml(detail)}</p></article>`;
          })
          .join("");
  const modelCards = (view.models ?? [])
    .map((model) => {
      const left = view.tasks.filter(
        (task) => task.modelId === model.id && task.status !== "DONE",
      ).length;
      const tone = MODEL_TONE[model.id] || "grok";
      return `<article class="model-row"><span class="badge ${tone}">${escapeHtml(modelShort(view, model.id))}</span><div><b>${left} task${left === 1 ? "" : "s"} left</b><p>${escapeHtml(MODEL_HINT[model.id] || model.tier || "Assigned from the task area")}</p></div></article>`;
    })
    .join("");
  const logged = Array.isArray(view.project.activity)
    ? view.project.activity
    : [];
  const activitySource =
    logged.length > 0
      ? logged
      : view.tasks
          .filter((task) => task.status === "DONE")
          .map((task) => ({
            at:
              task.expectedCompletion ||
              task.startedAt ||
              view.project.updatedAt,
            text: `${task.id} done. ${task.output || task.title}`,
          }))
          .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const activity =
    activitySource.length === 0
      ? `<p class="quiet">No activity yet.</p>`
      : activitySource
          .slice(0, 6)
          .map(
            (item) =>
              `<article class="activity"><time>${escapeHtml(formatWhen(item.at))}</time><p>${escapeHtml(item.text)}</p></article>`,
          )
          .join("");
  const kanban = columns
    .map((column) => {
      const tasks = orderedColumn(view, column.status);
      const body = tasks.map((task) => cardHtml(view, task)).join("");
      return `<section class="column" data-status="${column.status}" style="--accent:${column.color}"><h3>${escapeHtml(column.label)} <span class="count">${tasks.length}</span></h3><div class="cards">${body || `<p class="quiet">Empty</p>`}</div></section>`;
    })
    .join("");
  const phaseOptions = view.phases
    .map(
      (phase) =>
        `<option value="${escapeHtml(phase.id)}">${escapeHtml(phase.id)} ${escapeHtml(phase.name)}</option>`,
    )
    .join("");
  const areaOptions = view.areas
    .map(
      (area) =>
        `<option value="${escapeHtml(area.id)}">${escapeHtml(area.name)}</option>`,
    )
    .join("");
  const modelOptions = (view.models ?? [])
    .map(
      (model) =>
        `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}</option>`,
    )
    .join("");
  const phaseStatus = view.phaseStatus
    .map(
      (row) =>
        `<li><i style="background:${PHASE_COLORS[row.status]}"></i><span>${escapeHtml(row.status)}</span><b>${row.count}</b><em>${fmtPercent(row.percent)}</em></li>`,
    )
    .join("");
  const human =
    view.humanReview.length === 0
      ? ""
      : `<p class="banner">Human review: ${view.humanReview.map((item) => escapeHtml(item.title)).join(" · ")}</p>`;
  const tickets = JSON.stringify(ticketCatalog(view)).replaceAll(
    "<",
    "\\u003c",
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(view.project.name)} — Execution board</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:#121a2b; --card:#1a2336; --line:#2a364d; --ink:#e8eef8; --muted:#93a0b8; --accent:#60a5fa; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 13px/1.4 "Segoe UI", sans-serif; }
    button, input, select { font: inherit; color: inherit; }
    h1 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: -0.02em; }
    h2, h3, p { margin: 0; }
    main { height: 100%; display: flex; flex-direction: column; min-height: 0; }
    .top { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--line); background: #0d1424; }
    .tools { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-left: auto; min-width: 0; }
    .live { display: inline-flex; align-items: center; gap: 6px; color: #86efac; font-size: 12px; }
    .live i { width: 8px; height: 8px; border-radius: 99px; background: #22c55e; display: block; }
    select, .title-input { background: #0f1728; border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
    .title-input { width: 180px; }
    button { border: 0; border-radius: 8px; padding: 7px 12px; background: #2563eb; color: white; cursor: pointer; }
    button.quiet-btn { background: #1e293b; color: var(--ink); border: 1px solid var(--line); }
    button:disabled { opacity: 0.6; cursor: default; }
    .error { min-height: 0; color: #fda4af; padding: 0 14px; }
    .error:empty { display: none; }
    .banner { margin: 8px 14px 0; padding: 8px 10px; background: #3b2a14; color: #fde68a; border-radius: 8px; }
    .insights { display: grid; grid-template-columns: 1.05fr 1.2fr 1fr 1fr 0.95fr; gap: 10px; padding: 10px 14px 0; }
    .insight { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; min-height: 196px; max-height: 228px; overflow: auto; }
    .insight h2 { margin-bottom: 10px; color: var(--muted); font-size: 11px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; }
    .overall { display: flex; gap: 12px; align-items: center; }
    .done-line { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .legend, .phases { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
    .legend li { display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: center; color: var(--muted); font-size: 12px; }
    .legend i { width: 8px; height: 8px; border-radius: 99px; display: block; }
    .phases li { display: grid; grid-template-columns: minmax(0, 1fr) 72px auto; gap: 8px; align-items: center; }
    .phase-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .phase-name b { color: var(--muted); font-weight: 650; margin-right: 4px; }
    .bar { height: 8px; background: #243044; border-radius: 99px; overflow: hidden; }
    .bar span { display: block; height: 100%; }
    .frac { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 12px; }
    .queue-item, .model-row, .activity { padding: 8px 0; border-top: 1px solid #243044; }
    .queue-item h3, .model-row b { font-size: 13px; }
    .queue-item p, .model-row p, .activity p, .quiet { color: var(--muted); font-size: 12px; }
    .model-row { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; }
    .activity { display: grid; grid-template-columns: 108px 1fr; gap: 8px; }
    .activity time { color: var(--muted); font-size: 12px; }
    #kanban { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 14px 12px; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
    .board { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(var(--cols), minmax(200px, 1fr)); gap: 10px; overflow: auto; }
    .column { --accent: var(--accent); display: flex; flex-direction: column; min-height: 280px; max-height: 100%; background: #101828; border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 12px; overflow: hidden; }
    .column.over { outline: 2px solid var(--accent); outline-offset: -2px; }
    .column h3 { display: flex; justify-content: space-between; align-items: center; padding: 10px 10px 8px; font-size: 13px; }
    .column h3 .count { color: var(--muted); font-weight: 500; }
    .cards { overflow: auto; padding: 0 8px 8px; }
    .card { background: var(--card); border: 1px solid #314158; border-radius: 10px; padding: 10px; margin-bottom: 8px; cursor: grab; }
    .card h3 { font-size: 13px; font-weight: 650; }
    .card.selected { outline: 2px solid #60a5fa; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .chip { color: #d5deec; background: #243044; border-radius: 999px; padding: 1px 6px; font-size: 11px; }
    .pri.high { color: #fecaca; background: #4c1d24; }
    .pri.medium { color: #fde68a; background: #3f3414; }
    .pri.low { color: #bbf7d0; background: #143024; }
    .chip.human { color: #fed7aa; background: #4a2c12; }
    .path { margin-top: 6px; color: #93c5fd; font-family: Consolas, "Courier New", monospace; font-size: 11px; }
    .card .quiet { margin-top: 6px; }
    .card-foot { display: flex; justify-content: flex-end; margin-top: 8px; }
    .badge { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 650; }
    .badge.grok { color: #6ee7b7; background: #12352c; }
    .badge.fast { color: #7dd3fc; background: #0c3348; }
    .badge.sonnet { color: #e9d5ff; background: #3b1764; }
    .badge.opus { color: #fdba74; background: #4a2a12; }
    .more { margin: 0 14px 16px; color: var(--muted); }
    .more summary { cursor: pointer; }
    .more .legend li { grid-template-columns: 8px 1fr auto auto; }
    #task-detail { position: fixed; z-index: 20; left: 16px; right: 16px; bottom: 12px; max-height: min(46vh, 420px); overflow: auto; background: #121a2b; color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.35); }
    #task-detail[hidden] { display: none; }
    .ticket-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
    .sheet { display: grid; gap: 10px; }
    .sheet h3 { font-size: 18px; }
    .checklists { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .checklists h4 { margin: 0 0 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    .checklists ul { margin: 0; padding-left: 18px; }
    .sheet dl { display: grid; grid-template-columns: 9rem 1fr; gap: 4px 12px; margin: 0; }
    .sheet dt { color: var(--muted); }
    .sheet dd { margin: 0; }
    .related { display: flex; flex-wrap: wrap; gap: 6px; }
    .related button, .ticket-bar button { background: transparent; color: #93c5fd; border: 1px solid var(--line); }
    @media (max-width: 1100px) {
      main { height: auto; }
      .top { flex-wrap: wrap; }
      .insights { grid-template-columns: 1fr; }
      .insight { max-height: none; }
      .board { grid-template-columns: repeat(var(--cols), minmax(240px, 1fr)); }
    }
  </style>
</head>
<body>
  <main>
    <header class="top">
      <h1>${escapeHtml(view.project.name)} — Execution board</h1>
      <div class="tools">
        <span class="live"><i></i> live</span>
        <label><span class="sr-only">Phase</span><select id="filter-phase" aria-label="Phase"><option value="">All phases</option>${phaseOptions}</select></label>
        <label><span class="sr-only">Area</span><select id="filter-area" aria-label="Area"><option value="">All areas</option>${areaOptions}</select></label>
        <label><span class="sr-only">Model</span><select id="filter-model" aria-label="Model"><option value="">All models</option>${modelOptions}</select></label>
        <form id="add-form"><input class="title-input" name="title" aria-label="New task title" placeholder="New task title…" required /><button type="submit">Add</button></form>
        <button type="button" class="quiet-btn" id="run-queue">Run queue</button>
      </div>
    </header>
    <p class="error" id="move-error"></p>
    ${human}
    <div class="insights">
      <section class="insight">
        <h2>Overall</h2>
        <div class="overall">${statusDonut(counts, view.overall)}<div><p class="done-line">${view.done} of ${view.total} tasks done</p><ul class="legend">${statusLegend}</ul></div></div>
      </section>
      <section class="insight">
        <h2>Progress by phase</h2>
        <ul class="phases">${phaseBars}</ul>
      </section>
      <section class="insight">
        <h2>Your testing queue</h2>
        ${testing}
      </section>
      <section class="insight">
        <h2>Which model to use</h2>
        ${modelCards}
      </section>
      <section class="insight">
        <h2>Recent activity</h2>
        ${activity}
      </section>
    </div>
    <section id="kanban" style="--cols:${columns.length}">
      <h2 class="sr-only">Kanban</h2>
      <div class="board">${kanban}</div>
    </section>
    <details class="more">
      <summary>Phase status</summary>
      <ul class="legend">${phaseStatus}</ul>
      <p class="quiet">Run queue assigns a model, moves ready backlog into To Do, and starts the next task. Done still needs a passing test. Drag a card to another column to save the move.</p>
    </details>
    <script type="application/json" id="task-data">${tickets}</script>
  </main>
  <section id="task-detail" hidden>
    <div class="ticket-bar">
      <h2>Task</h2>
      <button type="button" id="task-close">Close</button>
    </div>
    <div id="task-sheet"></div>
  </section>
  <script>
    const SELECTED = "board-task";
    let dragging = false;
    let suppressClick = false;

    function tickets() {
      const node = document.querySelector("#task-data");
      if (!node) return [];
      try { return JSON.parse(node.textContent); } catch (error) { return []; }
    }

    function line(dl, label, value) {
      if (!value) return;
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.append(dt, dd);
    }

    function checkpointList(title, items) {
      if (!items || !items.length) return null;
      const wrap = document.createElement("div");
      const heading = document.createElement("h4");
      heading.textContent = title;
      const list = document.createElement("ul");
      items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.append(li);
      });
      wrap.append(heading, list);
      return wrap;
    }

    function linkList(title, items, onPick) {
      if (!items.length) return null;
      const wrap = document.createElement("div");
      const heading = document.createElement("h4");
      heading.textContent = title;
      const row = document.createElement("div");
      row.className = "related";
      items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.path ? item.title + " · " + item.path : item.id + " " + item.title;
        button.addEventListener("click", () => onPick(item.id));
        row.append(button);
      });
      wrap.append(heading, row);
      return wrap;
    }

    function showTask(id) {
      const task = tickets().find((item) => item.id === id);
      const section = document.querySelector("#task-detail");
      const sheet = document.querySelector("#task-sheet");
      document.querySelectorAll(".card.selected").forEach((card) => card.classList.remove("selected"));
      if (!task || !section || !sheet) {
        if (section) section.hidden = true;
        return;
      }
      document.querySelectorAll('.card[data-id="' + CSS.escape(id) + '"]').forEach((card) => card.classList.add("selected"));
      section.hidden = false;
      sheet.replaceChildren();
      const head = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = task.id + " · " + task.title;
      const description = document.createElement("p");
      description.className = "description";
      description.textContent = task.description;
      head.append(title, description);
      const lists = document.createElement("div");
      lists.className = "checklists";
      const doneList = checkpointList("Done", task.done);
      const todoList = checkpointList("To do", task.todo);
      if (doneList) lists.append(doneList);
      if (todoList) lists.append(todoList);
      if (lists.childElementCount) head.append(lists);
      if (task.page && task.page.path) {
        const path = document.createElement("p");
        path.className = "path";
        path.textContent = "munshipay.com" + task.page.path;
        head.append(path);
      }
      const facts = document.createElement("dl");
      line(facts, "Status", task.status);
      line(facts, "Section", task.page ? task.page.group : task.phaseName);
      line(facts, "Phase", task.phaseId + " · " + task.phaseName);
      line(facts, "Phase objective", task.phaseObjective);
      line(facts, "Area", task.area);
      line(facts, "Model", task.model);
      line(facts, "Priority", task.priority);
      line(facts, "Started", task.startedAt);
      line(facts, "Expected", task.expectedCompletion);
      line(facts, "Output", task.output);
      line(facts, "Blocker", task.blocker);
      sheet.append(head, facts);
      if (task.humanReview) {
        const review = document.createElement("p");
        review.textContent = "Human review: " + task.humanReview.why + " Unknown: " + task.humanReview.unknown + " Action: " + task.humanReview.action + " After: " + task.humanReview.after;
        sheet.append(review);
      }
      if (task.tests.length) {
        const tests = document.createElement("p");
        tests.textContent = task.tests.map((test) => test.type + " " + test.status + (test.result ? " — " + test.result : "")).join("; ");
        sheet.append(tests);
      }
      const openRelated = (relatedId) => {
        sessionStorage.setItem(SELECTED, relatedId);
        showTask(relatedId);
      };
      const depends = linkList("Depends on", task.dependencies, openRelated);
      const blocks = linkList("Required by", task.dependents, openRelated);
      const sameSection = linkList("Same section", task.related, openRelated);
      [depends, blocks, sameSection].forEach((node) => { if (node) sheet.append(node); });
      const run = document.createElement("button");
      run.type = "button";
      run.className = "run";
      run.dataset.run = task.id;
      if (task.statusCode === "IN_PROGRESS") {
        run.textContent = "Running in In progress";
        run.disabled = true;
      } else if (task.statusCode === "DONE") {
        run.textContent = "Done";
        run.disabled = true;
      } else if (task.statusCode === "HUMAN_REVIEW") {
        run.textContent = "Waiting for human review";
        run.disabled = true;
      } else {
        run.textContent = "Run task";
      }
      sheet.append(run);
    }

    function applyFilters() {
      const phase = document.querySelector("#filter-phase");
      const area = document.querySelector("#filter-area");
      const model = document.querySelector("#filter-model");
      const phaseValue = phase ? phase.value : "";
      const areaValue = area ? area.value : "";
      const modelValue = model ? model.value : "";
      document.querySelectorAll(".card").forEach((card) => {
        const show = (!phaseValue || card.dataset.phase === phaseValue) && (!areaValue || card.dataset.area === areaValue) && (!modelValue || card.dataset.model === modelValue);
        card.hidden = !show;
      });
      document.querySelectorAll(".column").forEach((column) => {
        const count = column.querySelector(".count");
        if (count) count.textContent = String(column.querySelectorAll(".card:not([hidden])").length);
      });
    }

    async function postJson(url, body) {
      const error = document.querySelector("#move-error");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!response.ok) {
        if (error) error.textContent = await response.text();
        return false;
      }
      if (error) error.textContent = "";
      return true;
    }

    document.addEventListener("change", (event) => {
      if (event.target.closest("#filter-phase, #filter-area, #filter-model")) applyFilters();
    });
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("#add-form");
      if (!form) return;
      event.preventDefault();
      const title = new FormData(form).get("title");
      if (await postJson("/add", { title: title })) location.reload();
    });
    document.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".card");
      if (!card) return;
      dragging = true;
      event.dataTransfer.setData("text/plain", card.dataset.id);
      event.dataTransfer.effectAllowed = "move";
    });
    document.addEventListener("dragend", () => {
      dragging = false;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      document.querySelectorAll(".column.over").forEach((column) => column.classList.remove("over"));
    });
    document.addEventListener("dragover", (event) => {
      const column = event.target.closest(".column");
      if (!column) return;
      event.preventDefault();
      column.classList.add("over");
    });
    document.addEventListener("dragleave", (event) => {
      const column = event.target.closest(".column");
      if (column && !column.contains(event.relatedTarget)) column.classList.remove("over");
    });
    document.addEventListener("click", async (event) => {
      if (event.target.closest("#run-queue")) {
        if (await postJson("/queue", {})) location.reload();
        return;
      }
      if (event.target.closest("#task-close")) {
        sessionStorage.removeItem(SELECTED);
        const section = document.querySelector("#task-detail");
        if (section) section.hidden = true;
        document.querySelectorAll(".card.selected").forEach((card) => card.classList.remove("selected"));
        return;
      }
      if (suppressClick || event.target.closest("[data-run]") || event.target.closest(".related")) return;
      const card = event.target.closest(".card");
      if (!card) return;
      sessionStorage.setItem(SELECTED, card.dataset.id);
      showTask(card.dataset.id);
    });
    document.addEventListener("click", async (event) => {
      const run = event.target.closest("[data-run]");
      if (!run || run.disabled) return;
      if (await postJson("/move", { id: run.dataset.run, status: "IN_PROGRESS" })) {
        sessionStorage.setItem(SELECTED, run.dataset.run);
        location.reload();
      }
    });
    document.addEventListener("drop", async (event) => {
      const column = event.target.closest(".column");
      if (!column) return;
      event.preventDefault();
      column.classList.remove("over");
      const id = event.dataTransfer.getData("text/plain");
      if (await postJson("/move", { id: id, status: column.dataset.status })) {
        sessionStorage.setItem(SELECTED, id);
        location.reload();
      }
      dragging = false;
    });
    function restoreTask() {
      const id = sessionStorage.getItem(SELECTED);
      if (id) showTask(id);
    }
    restoreTask();
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      setInterval(() => {
        if (dragging) return;
        const filters = {
          phase: document.querySelector("#filter-phase")?.value || "",
          area: document.querySelector("#filter-area")?.value || "",
          model: document.querySelector("#filter-model")?.value || "",
        };
        fetch(location.href, { cache: "no-store" }).then((response) => response.text()).then((html) => {
          const next = new DOMParser().parseFromString(html, "text/html");
          const currentStyle = document.querySelector("style");
          const nextStyle = next.querySelector("style");
          if ((currentStyle?.textContent || "") !== (nextStyle?.textContent || "")) {
            location.reload();
            return;
          }
          const current = document.querySelector("main");
          const incoming = next.querySelector("main");
          if (current && incoming && current.innerHTML !== incoming.innerHTML) {
            current.replaceWith(incoming);
            const phase = document.querySelector("#filter-phase");
            const area = document.querySelector("#filter-area");
            const model = document.querySelector("#filter-model");
            if (phase) phase.value = filters.phase;
            if (area) area.value = filters.area;
            if (model) model.value = filters.model;
            applyFilters();
            restoreTask();
          }
        }).catch(() => {});
      }, 3000);
    }
  </script>
</body>
</html>
`;
}

function jsString(value) {
  return JSON.stringify(value);
}

export function renderCanvas(view) {
  const payload = {
    updatedAt: view.project.updatedAt,
    overall: view.overall,
    done: view.done,
    total: view.total,
    phases: view.phases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      status: phase.status,
      progress: phase.progress,
      done: phase.done,
      total: phase.total,
    })),
    phaseStatus: view.phaseStatus,
    areas: view.areas.map((area) => ({
      name: area.name,
      progress: area.progress,
      total: area.total,
      completed: area.completed,
      active: area.active,
      blocked: area.blocked,
    })),
    workload: view.workload
      .filter((model) => model.tasks.length > 0)
      .map((model) => ({
        name: model.name,
        tasks: model.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          phaseId: task.phaseId,
          status: STATUS_LABEL[task.status],
          output: task.output || "—",
        })),
      })),
    testing: view.testing.map((test) => ({
      title: test.title,
      phaseId: test.phaseId,
      type: test.type,
      status: test.status,
      result: test.result || "",
    })),
    humanReview: view.humanReview.map((item) => item.title),
    blockers: view.blockers.map((item) => `${item.title}: ${item.detail}`),
    next: view.next.slice(0, 5).map((task) => `${task.id} ${task.title}`),
  };

  return `import { BarChart, Callout, Divider, Grid, H1, H2, PieChart, Row, Stack, Stat, Table, Text } from "cursor/canvas";

type Snapshot = {
  updatedAt: string;
  overall: number;
  done: number;
  total: number;
  phases: Array<{ id: string; name: string; status: string; progress: number; done: number; total: number }>;
  phaseStatus: Array<{ status: string; count: number; percent: number }>;
  areas: Array<{ name: string; progress: number; total: number; completed: number; active: number; blocked: number }>;
  workload: Array<{ name: string; tasks: Array<{ id: string; title: string; phaseId: string; status: string; output: string }> }>;
  testing: Array<{ title: string; phaseId: string; type: string; status: string; result: string }>;
  humanReview: string[];
  blockers: string[];
  next: string[];
};

const SNAPSHOT: Snapshot = ${jsString(payload)};

const TONE = {
  COMPLETED: "success",
  "IN PROGRESS": "info",
  REVIEW: "warning",
  BLOCKED: "danger",
  PLANNED: "neutral",
  BACKLOG: "neutral",
} as const;

function toneFor(status: string) {
  if (status in TONE) return TONE[status as keyof typeof TONE];
  return "neutral" as const;
}

export default function ExecutionBoard() {
  const pie = SNAPSHOT.phaseStatus
    .filter((row) => row.count > 0)
    .map((row) => ({ label: row.status, value: row.count, tone: toneFor(row.status) }));

  return (
    <Stack gap={24}>
      <Stack gap={6}>
        <H1>Payroll consultancy platform</H1>
        <Text tone="secondary">
          Execution board derived from board/state.json · updated {SNAPSHOT.updatedAt}. Phase shares use the largest-remainder method on phase counts.
        </Text>
      </Stack>
      <Row gap={16}>
        <Stat value={SNAPSHOT.overall + "%"} label="Tasks done" />
        <Stat value={SNAPSHOT.done + "/" + SNAPSHOT.total} label="Completed tasks" />
        <Stat value={String(SNAPSHOT.phases.length)} label="Phases" />
      </Row>
      <Grid columns={2} gap={24}>
        <Stack gap={8}>
          <H2>Phase status distribution</H2>
          <PieChart data={pie} donut size={220} />
          <Text size="small" tone="tertiary">
            Source: board/state.json · one count per phase · zero-count statuses stay in the table only
          </Text>
        </Stack>
        <Stack gap={8}>
          <H2>Phase progress</H2>
          <BarChart
            categories={SNAPSHOT.phases.map((phase) => phase.id)}
            series={[{ name: "Task completion", data: SNAPSHOT.phases.map((phase) => phase.progress), tone: "info" }]}
            valueSuffix="%"
            yMax={100}
            height={220}
            showValues
          />
          <Text size="small" tone="tertiary">
            Y axis: share of tasks done in that phase (%) · source: board/state.json
          </Text>
        </Stack>
      </Grid>
      <H2>Phase register</H2>
      <Table
        headers={["Phase", "Name", "Status", "Done", "Progress"]}
        columnAlign={["left", "left", "left", "right", "right"]}
        rows={SNAPSHOT.phases.map((phase) => [phase.id, phase.name, phase.status, phase.done + "/" + phase.total, phase.progress + "%"])}
        rowTone={SNAPSHOT.phases.map((phase) => toneFor(phase.status))}
        striped
      />
      <H2>Area progress</H2>
      <BarChart
        horizontal
        categories={SNAPSHOT.areas.map((area) => area.name)}
        series={[{ name: "Tasks done", data: SNAPSHOT.areas.map((area) => area.progress), tone: "neutral" }]}
        valueSuffix="%"
        yMax={100}
        height={Math.max(220, SNAPSHOT.areas.length * 28)}
      />
      <Text size="small" tone="tertiary">
        Y axis: project area · X axis: percent of that area's tasks marked done · source: board/state.json
      </Text>
      <Table
        headers={["Area", "Tasks", "Done", "Active", "Blocked", "Progress"]}
        columnAlign={["left", "right", "right", "right", "right", "right"]}
        rows={SNAPSHOT.areas.map((area) => [area.name, String(area.total), String(area.completed), String(area.active), String(area.blocked), area.progress + "%"])}
        striped
      />
      {SNAPSHOT.workload.length > 0 ? (
        <Stack gap={8}>
          <H2>Model workload</H2>
          <Table
            headers={["Model", "Task", "Phase", "Status", "Output"]}
            rows={SNAPSHOT.workload.flatMap((model) => model.tasks.map((task) => [model.name, task.id + " " + task.title, task.phaseId, task.status, task.output]))}
            striped
          />
        </Stack>
      ) : null}
      {SNAPSHOT.testing.length > 0 ? (
        <Stack gap={8}>
          <H2>Testing queue</H2>
          <Table
            headers={["Task", "Phase", "Type", "Status", "Result"]}
            rows={SNAPSHOT.testing.map((test) => [test.title, test.phaseId, test.type, test.status, test.result])}
            rowTone={SNAPSHOT.testing.map((test) => (test.status === "PASS" ? "success" : test.status === "FAIL" ? "danger" : "warning"))}
            striped
          />
        </Stack>
      ) : null}
      <Divider />
      {SNAPSHOT.humanReview.length === 0 ? (
        <Callout tone="success" title="Human review">
          Nothing is waiting on you.
        </Callout>
      ) : (
        <Callout tone="warning" title="Human review required">
          {SNAPSHOT.humanReview.join(" · ")}
        </Callout>
      )}
      {SNAPSHOT.blockers.length === 0 ? (
        <Text tone="secondary">No blockers.</Text>
      ) : (
        <Callout tone="danger" title="Blockers">
          {SNAPSHOT.blockers.join(" · ")}
        </Callout>
      )}
      {SNAPSHOT.next.length > 0 ? (
        <Stack gap={8}>
          <H2>Next automatic actions</H2>
          <Table headers={["Order", "Task"]} rows={SNAPSHOT.next.map((item, index) => [String(index + 1), item])} />
        </Stack>
      ) : null}
    </Stack>
  );
}
`;
}

const OUTPUTS = [
  ["EXECUTION_BOARD.md", renderBoard],
  ["docs/status.md", renderStatus],
  ["docs/to-do.md", renderTodo],
  ["board/execution-board.html", renderHtml],
];

function syncSkills() {
  const targets = [
    path.join(root, ".claude", "skills"),
    path.join(root, ".cursor", "skills"),
  ];
  for (const target of targets) fs.mkdirSync(target, { recursive: true });
  if (!fs.existsSync(skillsRoot)) return;
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const from = path.join(skillsRoot, entry.name);
    for (const target of targets) {
      const dest = path.join(target, entry.name);
      fs.cpSync(from, dest, { recursive: true, force: true });
    }
  }
}

function writeText(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

export function saveState(state, file = statePath) {
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
  const bin = path.join(
    root,
    "node_modules",
    "@biomejs",
    "biome",
    "bin",
    "biome",
  );
  if (!fs.existsSync(bin)) return;
  spawnSync(process.execPath, [bin, "format", "--write", file], { cwd: root });
}

export function buildOutputs(state) {
  const errors = validate(state);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
  const view = derive(state);
  const files = new Map(OUTPUTS.map(([file, render]) => [file, render(view)]));
  files.set("docs/skill-registry.md", renderSkillRegistry(skillRecords()));
  return { view, files };
}

function serveBoard(port) {
  const server = http.createServer((request, response) => {
    if (
      request.method === "POST" &&
      (request.url === "/move" ||
        request.url === "/add" ||
        request.url === "/queue")
    ) {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        try {
          const body = JSON.parse(
            Buffer.concat(chunks).toString("utf8") || "{}",
          );
          const state = loadState();
          const result =
            request.url === "/add"
              ? addTask(state, body.title)
              : request.url === "/queue"
                ? runQueue(state)
                : moveTask(state, body.id, body.status);
          if (!result.ok) {
            response.writeHead(400, {
              "Content-Type": "text/plain; charset=utf-8",
            });
            response.end(result.error);
            return;
          }
          saveState(state);
          response.writeHead(204);
          response.end();
        } catch (error) {
          response.writeHead(500, {
            "Content-Type": "text/plain; charset=utf-8",
          });
          response.end(error instanceof Error ? error.message : String(error));
        }
      });
      return;
    }
    if (request.url !== "/" && request.url !== "/index.html") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    try {
      const state = loadState();
      const errors = validate(state);
      if (errors.length) throw new Error(errors.join("\n"));
      const html = renderHtml(derive(state));
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(html);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Execution board http://127.0.0.1:${port}`);
  });
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const canvasFlag = args.indexOf("--canvas");
  const canvasPath =
    canvasFlag >= 0 ? path.resolve(args[canvasFlag + 1]) : null;
  const state = loadState();
  const { files } = buildOutputs(state);
  if (canvasPath) {
    files.set(path.relative(root, canvasPath), renderCanvas(derive(state)));
  }
  const mismatches = [];
  for (const [file, contents] of files) {
    const absolute = path.isAbsolute(file) ? file : path.join(root, file);
    if (check) {
      const current = fs.existsSync(absolute)
        ? fs.readFileSync(absolute, "utf8")
        : "";
      if (current !== contents) mismatches.push(file);
    } else {
      writeText(absolute, contents);
    }
  }
  if (!check) syncSkills();
  if (check && mismatches.length) {
    console.error(`Generated files are out of date:\n${mismatches.join("\n")}`);
    process.exit(1);
  }
  if (!check) {
    console.log(`Wrote ${[...files.keys()].join(", ")}`);
    console.log("Synced skills to .claude/skills and .cursor/skills");
  }
  if (args.includes("--serve")) {
    const portFlag = args.indexOf("--port");
    const port = portFlag >= 0 ? Number(args[portFlag + 1]) : 4317;
    serveBoard(port);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
