import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addTask,
  derive,
  derivePhaseStatus,
  moveTask,
  percentTenths,
  renderHtml,
  runQueue,
  validate,
} from "./generate.mjs";

test("phase status follows the task lifecycle", () => {
  assert.equal(derivePhaseStatus([]), "PLANNED");
  assert.equal(derivePhaseStatus([{ status: "BACKLOG" }]), "BACKLOG");
  assert.equal(
    derivePhaseStatus([{ status: "TODO" }, { status: "BACKLOG" }]),
    "PLANNED",
  );
  assert.equal(
    derivePhaseStatus([{ status: "IN_PROGRESS" }, { status: "BLOCKED" }]),
    "IN PROGRESS",
  );
  assert.equal(derivePhaseStatus([{ status: "REVIEW" }]), "REVIEW");
  assert.equal(derivePhaseStatus([{ status: "HUMAN_REVIEW" }]), "REVIEW");
  assert.equal(
    derivePhaseStatus([{ status: "BLOCKED" }, { status: "BACKLOG" }]),
    "BLOCKED",
  );
  assert.equal(
    derivePhaseStatus([{ status: "DONE" }, { status: "TODO" }]),
    "IN PROGRESS",
  );
  assert.equal(
    derivePhaseStatus([{ status: "DONE" }, { status: "DONE" }]),
    "COMPLETED",
  );
});

test("status shares sum to 100 and are not a fixed template", () => {
  const percents = percentTenths([1, 0, 0, 0, 0, 12], 13);
  assert.equal(
    percents.reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.equal(percents[0], 7.7);
  assert.equal(percents[5], 92.3);
  assert.deepEqual(percentTenths([0, 0], 0), [0, 0]);
});

test("html board renders the kanban and computed progress", () => {
  const state = {
    project: { name: "Test", updatedAt: "2026-10-07" },
    models: [{ id: "m", name: "Model", tier: "simple" }],
    phases: [
      {
        id: "P0",
        name: "Foundation",
        objective: "Start",
        dependencies: [],
        deliverables: [],
      },
    ],
    areas: [{ id: "core", name: "Core" }],
    tasks: [
      {
        id: "T-1",
        title: "First",
        phaseId: "P0",
        areaId: "core",
        priority: "P0",
        status: "DONE",
        modelId: "m",
        dependencies: [],
        tests: [{ type: "Unit", status: "PASS", result: "ok" }],
      },
    ],
    projectBlockers: [],
  };
  const html = renderHtml(derive(state));
  assert.match(html, /Execution board/);
  assert.match(html, /Kanban/);
  assert.match(html, /100%/);
  assert.match(html, /T-1/);
});

test("backlog html follows site page order and a card can move", () => {
  const state = {
    project: { name: "Test", updatedAt: "2026-10-07" },
    models: [{ id: "m", name: "Model", tier: "simple" }],
    phases: [
      {
        id: "W0",
        name: "Website screens",
        objective: "Pages",
        dependencies: [],
        deliverables: [],
      },
    ],
    areas: [{ id: "frontend", name: "Frontend" }],
    tasks: [
      {
        id: "S-2",
        title: "Dashboard",
        phaseId: "W0",
        areaId: "frontend",
        priority: "P1",
        status: "BACKLOG",
        modelId: "m",
        dependencies: [],
        tests: [],
        page: { group: "Home", path: "/Home/Index", order: 2 },
      },
      {
        id: "S-1",
        title: "Sign in",
        phaseId: "W0",
        areaId: "frontend",
        priority: "P1",
        status: "BACKLOG",
        modelId: "m",
        dependencies: [],
        tests: [],
        page: { group: "Sign in", path: "/", order: 1 },
      },
    ],
    projectBlockers: [],
  };
  const html = renderHtml(derive(state));
  assert.ok(html.indexOf("Kanban") < html.indexOf("Phase status"));
  assert.ok(html.indexOf('id="kanban"') < html.indexOf('id="task-detail"'));
  assert.match(html, /User Id and Password/);
  assert.ok(
    html.indexOf("munshipay.com/") < html.indexOf("munshipay.com/Home/Index"),
  );
  const moved = structuredClone(state);
  assert.equal(moveTask(moved, "S-1", "TODO").ok, true);
  assert.equal(moved.tasks[1].status, "TODO");
  assert.equal(moveTask(moved, "S-1", "IN_PROGRESS").ok, true);
  assert.match(moved.tasks[1].startedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(moveTask(moved, "S-1", "BACKLOG").ok, true);
  assert.equal(moved.tasks[1].startedAt, undefined);
  assert.equal(moveTask(structuredClone(state), "S-1", "DONE").ok, false);
});

test("queued tasks are not shown as active model work", () => {
  const state = {
    project: { name: "Test", updatedAt: "2026-10-06" },
    models: [{ id: "m", name: "Model", tier: "simple" }],
    phases: [
      {
        id: "P0",
        name: "Foundation",
        objective: "Start",
        dependencies: [],
        deliverables: [],
      },
    ],
    areas: [{ id: "core", name: "Core" }],
    tasks: [
      {
        id: "T-1",
        title: "Later",
        phaseId: "P0",
        areaId: "core",
        priority: "P1",
        status: "TODO",
        modelId: "m",
        dependencies: [],
        tests: [],
      },
    ],
    projectBlockers: [],
  };
  const view = derive(state);
  assert.equal(view.workload[0].tasks.length, 0);
  assert.deepEqual(
    view.next.map((task) => task.id),
    ["T-1"],
  );
});

test("progress, dependencies, and done-without-tests are enforced", () => {
  const state = {
    project: { name: "Test", updatedAt: "2026-10-06" },
    models: [{ id: "m", name: "Model", tier: "simple" }],
    phases: [
      {
        id: "P0",
        name: "Foundation",
        objective: "Start",
        dependencies: [],
        deliverables: [],
      },
      {
        id: "P1",
        name: "Next",
        objective: "Continue",
        dependencies: ["P0"],
        deliverables: [],
      },
    ],
    areas: [{ id: "core", name: "Core" }],
    tasks: [
      {
        id: "T-1",
        title: "First",
        phaseId: "P0",
        areaId: "core",
        priority: "P0",
        status: "DONE",
        modelId: "m",
        dependencies: [],
        tests: [{ type: "Unit", status: "PASS", result: "ok" }],
      },
      {
        id: "T-2",
        title: "Second",
        phaseId: "P0",
        areaId: "core",
        priority: "P1",
        status: "TODO",
        modelId: "m",
        dependencies: ["T-1"],
        tests: [],
      },
      {
        id: "T-3",
        title: "Waiting",
        phaseId: "P1",
        areaId: "core",
        priority: "P0",
        status: "TODO",
        modelId: "m",
        dependencies: ["T-2"],
        tests: [],
      },
    ],
    projectBlockers: [],
  };

  const view = derive(state);
  assert.equal(view.phases[0].progress, 50);
  assert.equal(view.phases[0].status, "IN PROGRESS");
  assert.equal(view.overall, 33);
  assert.deepEqual(
    view.phaseStatus
      .map((row) => row.percent)
      .reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.deepEqual(
    view.next.map((task) => task.id),
    ["T-2"],
  );

  const invalid = structuredClone(state);
  invalid.tasks[0].tests = [];
  assert.ok(
    validate(invalid).some((error) =>
      error.includes("DONE without a passing test"),
    ),
  );
});

test("website tickets state what is done and what is still to do", () => {
  const state = JSON.parse(
    readFileSync(new URL("./state.json", import.meta.url)),
  );
  const pages = state.tasks.filter((task) => task.id.startsWith("S-"));
  assert.ok(pages.length > 0);
  const paths = new Set();
  for (const task of pages) {
    assert.ok(task.description.includes("https://munshipay.com/"), task.id);
    assert.ok(task.done.length > 0, task.id);
    if (task.status !== "DONE") {
      assert.ok(task.todo.length > 0, `${task.id} lists nothing left to do`);
    }
    if (task.page?.path) {
      assert.ok(!paths.has(task.page.path), `${task.id} repeats a page path`);
      paths.add(task.page.path);
    }
  }
  const html = renderHtml(derive(state));
  assert.match(html, /User Id, Password, and Submit/);
  assert.match(html, /\d+ done · \d+ to do/);
  assert.match(html, /Your testing queue/);
  assert.match(html, /Which model to use/);
  assert.match(html, /To Do/);
});

test("the real board is organized by module and has no stale work", () => {
  const state = JSON.parse(
    readFileSync(new URL("./state.json", import.meta.url)),
  );
  assert.deepEqual(validate(state), []);
  const byId = new Map(state.tasks.map((task) => [task.id, task]));
  const phaseIds = new Set(state.phases.map((phase) => phase.id));

  assert.ok(!phaseIds.has("W0"), "screens belong to module phases");
  for (const phase of state.phases) {
    assert.ok(
      state.tasks.some((task) => task.phaseId === phase.id),
      `${phase.id} has no tasks`,
    );
    for (const dep of phase.dependencies) {
      assert.ok(phaseIds.has(dep), `${phase.id} depends on unknown ${dep}`);
    }
  }

  for (const task of state.tasks) {
    if (task.status !== "DONE" && !task.humanReview) {
      assert.ok(
        Array.isArray(task.todo) && task.todo.length > 0,
        `${task.id} is open and lists nothing left to do`,
      );
    }
    const unmet = (task.dependencies ?? []).filter(
      (dep) => byId.get(dep)?.status !== "DONE",
    );
    if (unmet.length > 0) {
      assert.ok(
        ["BACKLOG", "HUMAN_REVIEW", "BLOCKED"].includes(task.status),
        `${task.id} is ${task.status} but waits on ${unmet.join(", ")}`,
      );
    }
  }

  const visiting = new Set();
  const finished = new Set();
  const visit = (id) => {
    if (finished.has(id)) return;
    assert.ok(!visiting.has(id), `dependency cycle through ${id}`);
    visiting.add(id);
    for (const dep of byId.get(id).dependencies ?? []) visit(dep);
    visiting.delete(id);
    finished.add(id);
  };
  for (const task of state.tasks) visit(task.id);

  const phaseDeps = new Map(state.phases.map((p) => [p.id, p.dependencies]));
  const phaseVisiting = new Set();
  const phaseDone = new Set();
  const visitPhase = (id) => {
    if (phaseDone.has(id)) return;
    assert.ok(!phaseVisiting.has(id), `phase cycle through ${id}`);
    phaseVisiting.add(id);
    for (const dep of phaseDeps.get(id)) visitPhase(dep);
    phaseVisiting.delete(id);
    phaseDone.add(id);
  };
  for (const id of phaseDeps.keys()) visitPhase(id);
});

test("the queue assigns a model and starts the next ready task", () => {
  const state = {
    project: { name: "Test", updatedAt: "2026-10-07" },
    models: [
      { id: "cursor-grok", name: "Cursor Grok", tier: "complex" },
      { id: "m", name: "Model", tier: "simple" },
    ],
    phases: [
      {
        id: "P0",
        name: "Foundation",
        objective: "Start",
        dependencies: [],
        deliverables: [],
      },
    ],
    areas: [{ id: "core", name: "Core" }],
    tasks: [
      {
        id: "T-1",
        title: "First",
        phaseId: "P0",
        areaId: "core",
        priority: "P0",
        status: "DONE",
        modelId: "m",
        dependencies: [],
        tests: [{ type: "Unit", status: "PASS", result: "ok" }],
      },
      {
        id: "T-2",
        title: "Ready",
        phaseId: "P0",
        areaId: "core",
        priority: "P1",
        status: "BACKLOG",
        modelId: "",
        dependencies: ["T-1"],
        tests: [],
      },
      {
        id: "T-3",
        title: "Waiting",
        phaseId: "P0",
        areaId: "core",
        priority: "P0",
        status: "BACKLOG",
        modelId: "m",
        dependencies: ["T-2"],
        tests: [],
      },
    ],
    projectBlockers: [],
  };
  const result = runQueue(state);
  assert.equal(result.ok, true);
  assert.equal(result.started, "T-2");
  assert.equal(state.tasks[1].status, "IN_PROGRESS");
  assert.equal(state.tasks[1].modelId, "cursor-grok");
  assert.equal(state.tasks[2].status, "BACKLOG");
  assert.match(state.tasks[1].startedAt, /^\d{4}-\d{2}-\d{2}$/);
  const added = addTask(state, "Note the release");
  assert.equal(added.ok, true);
  assert.equal(state.tasks.at(-1).status, "TODO");
  assert.equal(state.tasks.at(-1).modelId, "cursor-grok");
  const again = runQueue(state);
  assert.equal(again.ok, true);
  assert.equal(again.started, null);
  assert.equal(state.tasks[1].status, "IN_PROGRESS");
});
