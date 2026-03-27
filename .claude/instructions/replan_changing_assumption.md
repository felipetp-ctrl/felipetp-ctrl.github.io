---
description: Changes a specific assumption in an existing plan and propagates the change through the plan, YAML tracking files, and context YAMLs. Decides strategy (FRESH_PLAN, ROLLBACK_ITERATION, CONTINUE_ITERATION) and produces plans compatible with run_plan.md.
argument-hint: [user-prompt-to-modify-assumption] [plan-folder] [run-id] [sop-document]
model: opus
---

# Replan: Change Assumption

Given an existing plan folder and a natural-language prompt describing what assumption to change and how, this command identifies the target assumption(s), traces their impact through the plan, decides a replanning strategy, rewrites affected sections, updates all YAML tracking files, audits for consistency, and produces a change report. Follow the `Instructions` and work through the `Workflow` to complete the replanning.

The command does NOT modify original files. Depending on strategy:
- **FRESH_PLAN**: Produces a new base plan with `_replan-<change-id>` suffixed artifacts
- **ROLLBACK_ITERATION / CONTINUE_ITERATION**: Produces an iteration plan with `_iteration<K.M>` suffixed artifacts (sub-iteration numbering)

All output is structurally identical to what `plan_spreadsheet_execution.md` produces — `run_plan.md` handles it without special logic.

## Variables

USER_PROMPT_TO_MODIFY_ASSUMPTION: $1
PLAN_FOLDER: $2
RUN_ID: $3
STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT(optional): $4
TEAM_NAME: assumption-replan

- `PLAN_FOLDER` -- The name of the plan folder inside `run_outputs/` (e.g., `caixa-diario-novembro`). Resolved at `run_outputs/<PLAN_FOLDER>/`.
- `RUN_ID` -- The run identifier (e.g., `cmw4kbxq`, `20260226-102921-tke6`). The target run folder is resolved at `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/`.

### Derived Internal Variables

These are computed from the input variables, not provided by the user:

```
PLAN_FOLDER_PATH = run_outputs/<PLAN_FOLDER>
RUN_FOLDER_PATH = run_outputs/<PLAN_FOLDER>/run-<RUN_ID>
```

ITERATION_NUMBER is NOT an input — it is auto-discovered by scanning PLAN_FOLDER_PATH (see Workflow step "Discover Iteration State").

## Sub-iteration Numbering Convention

1. **Whole-number iterations** (1, 2, 3, ...) are produced by `plan_spreadsheet_execution`
2. **Sub-iterations** (`K.M`) are produced by this command where:
   - **K** = the iteration being resumed FROM (the major number reflects which state you're building on)
   - **M** = the assumption-replan attempt number at that level (starts at 1, increments)
3. If replanning from an existing sub-iteration (e.g., from 1.1), append another level: `1.1.1` (discouraged — prefer staying at 2 levels)
4. `plan_spreadsheet_execution` always uses the next whole number and is unaffected by sub-iterations

### How to discover the next sub-iteration number

Scan `PLAN_FOLDER_PATH` for existing `_iteration<K>.<M>` suffixed artifacts where K matches the target iteration. The next available M is `max(existing Ms) + 1`, or `1` if none exist.

## Team of Agents

Use `TeamCreate` with `team_name: TEAM_NAME` to create the assumption-replan team before starting the workflow. All teammates are spawned via the `Task` tool with the `team_name` parameter set to `TEAM_NAME` and coordinated through the shared task list (`TaskCreate`, `TaskUpdate`, `TaskList`) and direct messaging (`SendMessage`).

### replan-lead (You -- the orchestrator)
- **Role**: Team lead. Orchestrates the entire assumption-change workflow, reads all existing artifacts, discovers iteration state, decides replanning strategy, coordinates all teammates, synthesizes their outputs, writes the final modified plan and updated YAMLs, and shuts down the team when done.
- **Responsibilities**: Discovers iteration state and builds iteration-to-run mapping, reads existing plan artifacts, decides strategy (FRESH_PLAN / ROLLBACK_ITERATION / CONTINUE_ITERATION), designs the change propagation strategy, reviews teammate outputs for correctness, applies audit corrections, produces the final change report.
- **Tools used**: `TeamCreate`, `TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`

### assumption-matcher
- **Role**: Assumption identification specialist. Reads the `USER_PROMPT_TO_MODIFY_ASSUMPTION` and semantically matches it against entries in `agent-assumptions.yaml` and `user-assumptions` lists in `intent-registry.yaml`. The user may describe the same assumption in different words than how it was originally recorded, so matching must be semantic, not just lexical.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 2 (Match Assumptions)
- **Input**: `USER_PROMPT_TO_MODIFY_ASSUMPTION`, agent-assumptions YAML (latest iteration version), intent-registry YAML (latest iteration version), run-level tracking data from `RUN_FOLDER_PATH` (agent-execution-assumptions, user-assumptions-validation), and the review report (`RUN_FOLDER_PATH/run-review/<RUN_ID>-review.md`) — these provide evidence of which assumptions were problematic at runtime
- **Output**: `PLAN_FOLDER_PATH/matched-assumptions_replan-<change-id>.yaml` -- a YAML file listing every matched assumption with the following schema per entry:
    ```yaml
    - source-file: <agent-assumptions.yaml or intent-registry.yaml>
      original-entry: <full original YAML entry>
      match-confidence: <high|medium|low>
      match-reasoning: <why this entry matches the user's change request>
      new-assumption: <what the assumption should be after the change>
      iteration: <base | iteration number where this assumption was introduced>
    ```
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> reads both YAML files and performs semantic matching -> writes `matched-assumptions_replan-<change-id>.yaml` -> marks task completed via `TaskUpdate(status: "completed")` -> sends summary to replan-lead via `SendMessage` -> receives `shutdown_request`

### impact-tracer
- **Role**: Plan impact analyst. Takes the matched assumptions and traces every location in the plan document, context YAMLs, and intent registry where that assumption influenced a decision. Also identifies transitive dependencies -- other assumptions that chain from the matched one.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 3 (Trace Impact, after matched-assumptions is available)
- **Input**: `PLAN_FOLDER_PATH/matched-assumptions_replan-<change-id>.yaml`, the plan `.md` (latest iteration version), all `<filename>-context.yaml` files, intent-registry YAML, agent-assumptions YAML, run-level tracking data from `RUN_FOLDER_PATH` (intent-tracking, agent-execution-assumptions, user-assumptions-validation) to understand runtime behavior
- **Output**: `PLAN_FOLDER_PATH/impact-map_replan-<change-id>.yaml` -- a YAML file listing every affected artifact with the following schema per entry:
    ```yaml
    - artifact: <file path>
      section: <which section/step>
      dependency-type: <direct|transitive>
      description: <how the assumption influenced this section>
      change-required: <yes|no|maybe>
      change-description: <what needs to change>
    ```
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> reads matched assumptions and all plan artifacts -> traces every dependency -> writes `impact-map_replan-<change-id>.yaml` -> marks task completed via `TaskUpdate(status: "completed")` -> sends summary to replan-lead via `SendMessage` -> receives `shutdown_request`

### file-re-explorer (conditional)
- **Role**: File structure re-analyst. Only spawned if the impact-tracer identifies file-context YAMLs that need updating (i.e., the assumption was about file structure, column interpretation, header detection, sheet layout, or data types). Re-reads the affected source files and re-interprets their structure under the new assumption.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 5 (Re-explore Files, only if impact-tracer found context YAMLs needing update)
- **Input**: List of affected source file paths, the new assumption from `matched-assumptions_replan-<change-id>.yaml`, `USER_PROMPT_TO_MODIFY_ASSUMPTION`
- **Output**: Updated context YAMLs written using strategy-appropriate suffix:
    - FRESH_PLAN: `PLAN_FOLDER_PATH/<filename>-context_replan-<change-id>.yaml`
    - ROLLBACK/CONTINUE: `PLAN_FOLDER_PATH/<filename>-context_iteration<K.M>.yaml`
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> re-reads affected source files -> re-interprets structure under new assumption -> writes updated context YAMLs -> marks task completed via `TaskUpdate(status: "completed")` -> sends summary to replan-lead via `SendMessage` -> receives `shutdown_request`

### plan-rewriter
- **Role**: Plan document rewriter. Receives the strategy decision and adapts output accordingly. For FRESH_PLAN: rewrites entire plan, no Iteration Metadata. For ROLLBACK/CONTINUE: rewrites affected sections, includes Iteration Metadata with sub-iteration. Also produces updated versions of `intent-registry.yaml` and `agent-assumptions.yaml`.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 6 (Rewrite/Create Plan)
- **Input**: `PLAN_FOLDER_PATH/impact-map_replan-<change-id>.yaml`, `PLAN_FOLDER_PATH/matched-assumptions_replan-<change-id>.yaml`, `PLAN_FOLDER_PATH/strategy-decision_replan-<change-id>.yaml`, the plan `.md`, all context YAMLs (updated versions from step 5 if available), intent-registry YAML, `USER_PROMPT_TO_MODIFY_ASSUMPTION`
- **Output** (depends on strategy):
    - **FRESH_PLAN**:
        - `PLAN_FOLDER_PATH/replan-<change-id>-<descriptive-name>.md` -- new base plan (NO `## Iteration Metadata`)
        - `PLAN_FOLDER_PATH/intents/intent-registry_replan-<change-id>.yaml` -- fresh intent registry
        - `PLAN_FOLDER_PATH/assumptions/agent-assumptions_replan-<change-id>.yaml` -- fresh assumptions (old matched assumptions marked `status: superseded`, new assumptions added with `replan: assumption-change-<change-id>` tag)
    - **ROLLBACK_ITERATION** (to iteration K, creating K.M):
        - `PLAN_FOLDER_PATH/run-<run-id-of-K>/replan-<K.M>-<descriptive-name>.md` -- iteration plan (HAS `## Iteration Metadata`)
        - `PLAN_FOLDER_PATH/intents/intent-registry_iteration<K.M>.yaml`
        - `PLAN_FOLDER_PATH/assumptions/agent-assumptions_iteration<K.M>.yaml` (old matched assumptions marked `status: superseded`, new assumptions added with `replan: assumption-change-<change-id>` tag)
        - `PLAN_FOLDER_PATH/assumptions/assumption-changes_iteration<K.M>.yaml` -- change analysis
    - **CONTINUE_ITERATION** (from TARGET_RUN_ITERATION N, creating N.M):
        - `PLAN_FOLDER_PATH/run-<RUN_ID>/replan-<N.M>-<descriptive-name>.md` -- iteration plan (HAS `## Iteration Metadata`)
        - `PLAN_FOLDER_PATH/intents/intent-registry_iteration<N.M>.yaml`
        - `PLAN_FOLDER_PATH/assumptions/agent-assumptions_iteration<N.M>.yaml` (old matched assumptions marked `status: superseded`, new assumptions added with `replan: assumption-change-<change-id>` tag)
        - `PLAN_FOLDER_PATH/assumptions/assumption-changes_iteration<N.M>.yaml` -- change analysis
- **Critical instruction**: The rewriter must follow the SAME plan format and level of detail as the original `plan_spreadsheet_execution.md` planner. Specifically:
    - Maintain all existing plan sections (Task Description, Objective, Phases, Relevant Files, Step by Step Tasks, Logging Strategy, Validation, Output Execution Summary)
    - For spreadsheet tasks, specify task type (search|crud|filtering|analysis) and complexity (simple|medium|complex)
    - Reference `<filename>-context.yaml` files for file-dependent steps
    - Preserve cell-value-source rules (`=100+150` instead of `250`)
    - Keep the run-id directory structure (`PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<generated-id>/`)
    - Include the logging strategy with `run-<generated-id>/logs/` paths
    - Include the output execution summary pointing to `run-<generated-id>/run-result/`
    - Preserve ALL unaffected sections exactly -- only modify sections identified in the impact map (ROLLBACK/CONTINUE only; FRESH rewrites everything)
    - For ROLLBACK/CONTINUE, include `## Iteration Metadata` matching this format:
        ```md
        ## Iteration Metadata
        - **Iteration Number**: <K.M> or <N.M>
        - **Previous Run ID**: <run-id of the iteration being resumed from>
        - **Plan Folder**: <plan-folder-name>
        - **Previous Run Path**: `run_outputs/<plan-folder>/run-<previous-run-id>/`
        - **Assumption Replan**: true
        - **Change ID**: <change-id>
        - **Resumed From Iteration**: <K or N>
        ```
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> reads all inputs -> executes strategy -> produces plan and updated YAMLs -> marks task completed via `TaskUpdate(status: "completed")` -> sends summary to replan-lead via `SendMessage` -> receives `shutdown_request`

### assumptions-auditor
- **Role**: Consistency validator. Validates that the rewritten plan is internally consistent with the new assumption and that no stale references to the old assumption remain. Checks structural validity of all updated YAMLs.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 7 (Audit Consistency)
- **Input**: Modified plan, all updated YAMLs (using strategy-appropriate paths), `USER_PROMPT_TO_MODIFY_ASSUMPTION`, original plan for comparison
- **Output**: `PLAN_FOLDER_PATH/audit-report_replan-<change-id>.yaml` -- a YAML file listing any inconsistencies found, stale references, or sections that still reflect the old assumption. Schema:
    ```yaml
    - type: <stale-reference|inconsistency|unintended-change|structural-error>
      artifact: <file path>
      section: <which section/step>
      description: <what the issue is>
      severity: <high|medium|low>
      recommendation: <how to fix>
    ```
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> reads modified plan and updated YAMLs -> validates consistency -> writes `audit-report_replan-<change-id>.yaml` -> marks task completed via `TaskUpdate(status: "completed")` -> sends summary to replan-lead via `SendMessage`, including counts of issues found by severity.

## Instructions

- IMPORTANT: If no `USER_PROMPT_TO_MODIFY_ASSUMPTION` is provided, stop and ask the user to provide it.
- IMPORTANT: If no `PLAN_FOLDER` or `RUN_ID` is provided, stop and ask the user to provide them.
- **Input Validation**: Validate that `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/` exists. If the plan folder or run folder is not found, stop and ask the user to provide the correct values.
- Discover the original plan `.md` file by globbing `PLAN_FOLDER_PATH/*.md` and `PLAN_FOLDER_PATH/run-*/replan-*.md` — exclude `user-prompt.md` and `user-prompt_iteration*.md`.
- **Auto-discover iteration state**: Scan `PLAN_FOLDER_PATH` for all `run-<id>/` folders, plan files with `## Iteration Metadata`, and `_iteration<X>` suffixed artifacts to build the `ITERATION_RUN_MAP` (see Workflow "Discover Iteration State").
- **Non-destructive**: NEVER modify original plan files or YAMLs in place. All output uses strategy-appropriate naming:
    - Analysis artifacts (matched-assumptions, impact-map, strategy-decision, audit-report): always `_replan-<change-id>` suffix in `PLAN_FOLDER_PATH/`
    - Tracking artifacts (intent-registry, agent-assumptions, assumption-changes, context YAMLs): `_replan-<change-id>` for FRESH_PLAN, `_iteration<K.M>` for ROLLBACK/CONTINUE
    - Plan files: `replan-<change-id>-<name>.md` for FRESH_PLAN (in PLAN_FOLDER_PATH), `replan-<K.M>-<name>.md` for ROLLBACK/CONTINUE (in the target run folder)
- **All artifacts stay in the plan folder** — no separate subfolder (no `replan-assumptions/` or similar).
- **Preserve unaffected sections**: The plan rewriter must NOT touch sections that are not in the impact map (ROLLBACK/CONTINUE strategies). FRESH_PLAN rewrites everything.
- **Same planning quality**: The rewriter must produce plan sections with the same level of detail, same format, and same considerations as the original `plan_spreadsheet_execution.md` planner — including task types (search|crud|filtering|analysis), complexity (simple|medium|complex), context YAML references, cell-value-source rules (`=100+150` instead of `250`), run-id structure, and logging strategy.
- <if `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` provided> Read the SOP file for additional context. Don't follow the SOP — it is for reference on relevant details. Use relevant business rules, restrictions, category mappings, file content, mapping rules, similar activities, and any relevant information to complement the replanning. Reference the SOP in the modified plan for guidance while executing.</if>
- **Transitive propagation**: If changing assumption A invalidates assumption B (which was derived from A), both must be updated. The impact-tracer must identify these chains and the plan-rewriter must update all of them.
- **No execution**: This command only modifies the plan and its tracking files. It does NOT execute any plan steps.
- **Team coordination**: Use the same `TeamCreate`/`TaskCreate`/`TaskUpdate`/`SendMessage` pattern as `plan_spreadsheet_execution.md`. All teammates described in `## Team of Agents` are spawned via the `Task` tool with `team_name: TEAM_NAME` and coordinated through the shared task list and `SendMessage`.
- **Change ID generation**: Generate a short alphanumeric change ID (8 characters) combined with a kebab-case descriptive name derived from the user's change prompt. Use this as `<change-id>` throughout the workflow (e.g., `a1b2c3d4-fix-column-mapping`).
- **Team Setup**: Before starting the workflow, create the team using `TeamCreate` with `team_name: TEAM_NAME` (value: `assumption-replan`).
- **Team Shutdown**: After step 8 (Finalize & Report), send `SendMessage` of type `shutdown_request` to each active teammate (`assumption-matcher`, `impact-tracer`, `file-re-explorer` if spawned, `plan-rewriter`, `assumptions-auditor`). Wait for all teammates to acknowledge shutdown. Finally, call `TeamDelete` to clean up the team resources.

## Workflow

before starting:
- Activate venv in run_outputs/
- Create the assumption-replan team: call `TeamCreate` with `team_name: TEAM_NAME` (value: `assumption-replan`). This creates the shared task list at `~/.claude/tasks/TEAM_NAME/`.
- Generate the `<change-id>`: a short alphanumeric ID (8 chars) + kebab-case descriptive name from `USER_PROMPT_TO_MODIFY_ASSUMPTION` (e.g., `a1b2c3d4-fix-column-mapping`).
- **Discover Iteration State**: Scan `PLAN_FOLDER_PATH` to build the iteration map:
    1. Glob for all `run-*/` folders inside `PLAN_FOLDER_PATH`.
    2. For each run folder, look for plan files containing `## Iteration Metadata` and extract the iteration number and run ID.
    3. Glob for `_iteration*` suffixed artifacts to identify all iteration numbers (whole and sub-iteration).
    4. Build `ITERATION_RUN_MAP`: a mapping of `{iteration-number → run-id}` (e.g., `{1: "abc", 2: "def", 1.1: "jkl"}`).
    5. Set `LATEST_ITERATION`: the highest whole-number iteration found (ignoring sub-iterations for this purpose).
    6. Set `HAS_RUNS`: `true` if any run folders exist, `false` otherwise.
    7. **Anchor on RUN_ID**: Identify which iteration the provided `RUN_ID` belongs to by reading the plan file in `run-<RUN_ID>/` for `## Iteration Metadata`, or matching against `ITERATION_RUN_MAP`. Set `TARGET_RUN_ITERATION` = the iteration number of the provided RUN_ID. Use this as the anchor for strategy decisions instead of just using "latest".
    8. Identify the latest plan file (base plan or highest-iteration plan) for use in subsequent steps.

1. **Load Existing Artifacts** -- Read from `PLAN_FOLDER_PATH` and `RUN_FOLDER_PATH`:
    1. Discover the plan `.md` file (the latest iteration plan or base plan identified during iteration state discovery).
    2. Read the latest version of `intents/intent-registry.yaml` (or `intent-registry_iteration<N>.yaml` if iterations exist).
    3. Read the latest version of `assumptions/agent-assumptions.yaml` (or `agent-assumptions_iteration<N>.yaml` if iterations exist).
    4. Read `user-prompt.md` (and `user-prompt_iteration<N>.md` if iterations exist) for context.
    5. List and read all `*-context.yaml` files in `PLAN_FOLDER_PATH` (use latest iteration versions).
    6. Read run-level artifacts from `RUN_FOLDER_PATH` (if they exist):
        - `RUN_FOLDER_PATH/tracking/intent-tracking.yaml` — execution-time intent tracking
        - `RUN_FOLDER_PATH/tracking/user-assumptions-validation.yaml` — user assumption validation results
        - `RUN_FOLDER_PATH/tracking/agent-execution-assumptions.yaml` — agent execution assumptions
        - `RUN_FOLDER_PATH/run-review/<RUN_ID>-review.md` — the review report (provides evidence of what failed and why, informing assumption matching and impact analysis)
    7. <if `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` provided> Read the SOP for additional context — use relevant business rules, restrictions, categories, mapping rules, category mappings, explained categories, other files that may contain sources of information, similar activities, or activities the user may have replaced, and any relevant information to complement the replanning with details. Also consider information in images within the SOP.</if>

2. **Match Assumptions** -- Spawn the **assumption-matcher** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "assumption-matcher"`. Create a task with `TaskCreate` describing the assumption matching work and assign it to `assumption-matcher` via `TaskUpdate(owner: "assumption-matcher")`. The teammate must:
    1. Parse every entry in the latest agent-assumptions YAML (fields: `intent-id`, `agent`, `step`, `assumption`, `risk`).
    2. Parse every `user-assumptions` list item in each intent in the latest intent-registry YAML.
    3. Read run-level tracking data from `RUN_FOLDER_PATH` (if available): `tracking/agent-execution-assumptions.yaml`, `tracking/user-assumptions-validation.yaml`, and the review report at `run-review/<RUN_ID>-review.md`. These provide runtime evidence of which assumptions were problematic, violated, or flagged as high-risk.
    4. Semantically compare each entry against the `USER_PROMPT_TO_MODIFY_ASSUMPTION` — the user may describe the same assumption in different words than how it was recorded. Use meaning-based matching, not just keyword matching. Prioritize assumptions that were flagged as violated, partially-true, or high-risk in the run tracking data.
    5. For each match, determine confidence (high|medium|low) and write the reasoning.
    6. For each match, formulate the `new-assumption` text based on the user's change request.
    7. For each match, record the `iteration` tag (which iteration introduced the assumption — `base` if no tag, or the iteration number from the `iteration:` field).
    8. Output `PLAN_FOLDER_PATH/matched-assumptions_replan-<change-id>.yaml` following the schema defined in the `## Team of Agents` section.
    9. Mark task completed via `TaskUpdate(status: "completed")` and send summary to replan-lead via `SendMessage`.

3. **Trace Impact** -- After `matched-assumptions_replan-<change-id>.yaml` is available, spawn the **impact-tracer** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "impact-tracer"`. Create a task with `TaskCreate` describing the impact tracing work and assign it to `impact-tracer` via `TaskUpdate(owner: "impact-tracer")`. The teammate must:
    1. For each matched assumption, search the plan document section by section for every reference to or dependency on the assumption's subject matter.
    2. Check all `<filename>-context.yaml` files for interpretations that were influenced by the assumption (e.g., column naming, header row identification, data type assumptions, sheet layout).
    3. Check the intent-registry YAML for intent interpretations that relied on or were shaped by the assumption.
    4. Read run-level tracking data from `RUN_FOLDER_PATH` (if available): `tracking/intent-tracking.yaml`, `tracking/agent-execution-assumptions.yaml`, `tracking/user-assumptions-validation.yaml`. Use this to understand which plan steps were affected at runtime and how the assumption manifested during execution.
    5. Identify transitive dependencies — other assumptions in agent-assumptions YAML that were derived from or chain from the matched assumption. These must also be flagged for update.
    6. Output `PLAN_FOLDER_PATH/impact-map_replan-<change-id>.yaml` following the schema defined in the `## Team of Agents` section.
    7. Mark task completed via `TaskUpdate(status: "completed")` and send summary to replan-lead via `SendMessage`, including a flag indicating whether any context YAMLs need updating.

4. **Decide Strategy** -- The replan-lead analyzes the impact map and decides the replanning strategy:
    1. Analyze impact map: count `change-required: yes` vs total sections to compute impact percentage.
    2. Check if matched assumptions have `iteration:` tags (which iteration introduced them).
    3. Check `HAS_RUNS` and `ITERATION_RUN_MAP`.
    4. Apply decision criteria:
        - **FRESH_PLAN** — Start from scratch with a corrected base plan:
            - Impact map shows >60% of plan sections need `change-required: yes`
            - Core data interpretation is affected (what input files represent, output structure)
            - The assumption is foundational (affects Task Description / Objective)
            - Also the only option when **no runs exist yet** (pre-execution replan, `HAS_RUNS` is false)
            - Output sub-iteration: **none** (it's a new base plan)
        - **ROLLBACK_ITERATION** — Resume from the state of a previous iteration:
            - The assumption was introduced in a specific iteration K (traceable via `iteration:` tags)
            - Rolling back to iteration K's state and replanning from there is cleaner
            - Only viable when runs exist for iteration K
            - Output sub-iteration: **K.M** (where K is the iteration to resume from, M is next available)
        - **CONTINUE_ITERATION** — Apply the change on top of the current run's state:
            - Default when runs exist and the change is contained (<60% affected)
            - Most of the plan remains valid
            - Output sub-iteration: **N.M** (where N = `TARGET_RUN_ITERATION`, the iteration of the provided RUN_ID; M is next available)
    5. Compute `TARGET_SUB_ITERATION`:
        - FRESH_PLAN: no iteration number
        - ROLLBACK to K: scan for existing `K.M` artifacts, next M = `K.<max_M + 1>` (or `K.1` if none)
        - CONTINUE from N: scan for existing `N.M` artifacts, next M = `N.<max_M + 1>` (or `N.1` if none)
    6. Write decision to `PLAN_FOLDER_PATH/strategy-decision_replan-<change-id>.yaml`:
        ```yaml
        strategy: FRESH_PLAN | ROLLBACK_ITERATION | CONTINUE_ITERATION
        reasoning: <why this strategy was chosen>
        impact-percentage: <% of sections affected>
        assumption-origin-iteration: <base | K | K.M>
        target-sub-iteration: <K.M> (null for FRESH_PLAN)
        resume-from-iteration: <K or N> (null for FRESH_PLAN)
        resume-from-run-id: <RUN_ID for CONTINUE_ITERATION, run-id-of-K for ROLLBACK_ITERATION> (null for FRESH_PLAN)
        ```

5. **Re-explore Files (conditional)** -- If the impact-tracer found `<filename>-context.yaml` files that need updating (the assumption was about file structure, column interpretation, header detection, sheet layout, or data types), spawn the **file-re-explorer** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "file-re-explorer"`. Create a task with `TaskCreate` describing which files to re-explore and why, and assign it to `file-re-explorer` via `TaskUpdate(owner: "file-re-explorer")`. The teammate must:
    1. Re-read the affected source files from their original locations (paths found in the context YAMLs or the plan's Relevant Files section).
    2. Re-interpret their structure under the new assumption from `matched-assumptions_replan-<change-id>.yaml`.
    3. Write updated context YAMLs using strategy-appropriate suffix:
        - FRESH_PLAN: `PLAN_FOLDER_PATH/<filename>-context_replan-<change-id>.yaml`
        - ROLLBACK/CONTINUE: `PLAN_FOLDER_PATH/<filename>-context_iteration<K.M>.yaml`
    4. Mark task completed via `TaskUpdate(status: "completed")` and send updated context summaries to replan-lead via `SendMessage`.
    - <if no context YAMLs need updating> Skip this step entirely. Do not spawn the file-re-explorer teammate.</if>

6. **Rewrite/Create Plan** -- Spawn the **plan-rewriter** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "plan-rewriter"`. Create a task with `TaskCreate` describing the plan rewriting work and assign it to `plan-rewriter` via `TaskUpdate(owner: "plan-rewriter")`. Provide the teammate with:
    - The plan `.md` path (latest version)
    - `PLAN_FOLDER_PATH/impact-map_replan-<change-id>.yaml`
    - `PLAN_FOLDER_PATH/matched-assumptions_replan-<change-id>.yaml`
    - `PLAN_FOLDER_PATH/strategy-decision_replan-<change-id>.yaml`
    - All context YAMLs (use updated versions from step 5 if available, originals otherwise)
    - The latest intent-registry YAML path
    - `USER_PROMPT_TO_MODIFY_ASSUMPTION`
    - <if `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` provided> The SOP path for business context reference.</if>
    - The teammate must execute based on the strategy:

    **FRESH_PLAN**:
    1. Rewrite ALL sections of the plan based on the corrected assumption.
    2. Write the new plan to `PLAN_FOLDER_PATH/replan-<change-id>-<descriptive-name>.md` — NO `## Iteration Metadata`.
    3. The plan's `## Relevant Files` must list exact artifact paths using `_replan-<change-id>` suffix.
    4. Produce `PLAN_FOLDER_PATH/intents/intent-registry_replan-<change-id>.yaml` — fresh intent registry reflecting the corrected assumption.
    5. Produce `PLAN_FOLDER_PATH/assumptions/agent-assumptions_replan-<change-id>.yaml` — old matched assumptions marked `status: superseded`, new assumptions added with `replan: assumption-change-<change-id>` tag.

    **ROLLBACK_ITERATION** (to iteration K, creating K.M):
    1. Load state from iteration K's artifacts (use `ITERATION_RUN_MAP` to find the run).
    2. Rewrite affected sections + adjust iteration-specific content.
    3. Write the plan to `PLAN_FOLDER_PATH/run-<run-id-of-K>/replan-<K.M>-<descriptive-name>.md` — with `## Iteration Metadata`.
    4. The plan's `## Relevant Files` must list exact artifact paths using `_iteration<K.M>` suffix.
    5. Produce `PLAN_FOLDER_PATH/intents/intent-registry_iteration<K.M>.yaml`.
    6. Produce `PLAN_FOLDER_PATH/assumptions/agent-assumptions_iteration<K.M>.yaml` — old matched assumptions marked `status: superseded`, new assumptions added with `replan: assumption-change-<change-id>` tag, transitively-dependent assumptions updated.
    7. Produce `PLAN_FOLDER_PATH/assumptions/assumption-changes_iteration<K.M>.yaml` — change analysis for this sub-iteration.

    **CONTINUE_ITERATION** (from TARGET_RUN_ITERATION N, creating N.M):
    1. Load state from the target run iteration's artifacts.
    2. Rewrite ONLY affected sections, preserving all unaffected sections with their exact original text.
    3. Write the plan to `PLAN_FOLDER_PATH/run-<RUN_ID>/replan-<N.M>-<descriptive-name>.md` — with `## Iteration Metadata`.
    4. The plan's `## Relevant Files` must list exact artifact paths using `_iteration<N.M>` suffix.
    5. Produce `PLAN_FOLDER_PATH/intents/intent-registry_iteration<N.M>.yaml`.
    6. Produce `PLAN_FOLDER_PATH/assumptions/agent-assumptions_iteration<N.M>.yaml` — old matched assumptions marked `status: superseded`, new assumptions added with `replan: assumption-change-<change-id>` tag, transitively-dependent assumptions updated.
    7. Produce `PLAN_FOLDER_PATH/assumptions/assumption-changes_iteration<N.M>.yaml` — change analysis for this sub-iteration.

    For ROLLBACK/CONTINUE, the `## Iteration Metadata` section in the plan must be:
    ```md
    ## Iteration Metadata
    - **Iteration Number**: <K.M> or <N.M>
    - **Previous Run ID**: <run-id of the iteration being resumed from>
    - **Plan Folder**: <plan-folder-name>
    - **Previous Run Path**: `run_outputs/<plan-folder>/run-<previous-run-id>/`
    - **Assumption Replan**: true
    - **Change ID**: <change-id>
    - **Resumed From Iteration**: <K or N>
    ```

    For all strategies, the rewriter must:
    - Maintain the same depth and format as the original planner (task types, complexity, cell-value-source rules, run-id structure, logging strategy, context YAML references).
    - Mark task completed via `TaskUpdate(status: "completed")` and send summary to replan-lead via `SendMessage`.

7. **Audit Consistency** -- Spawn the **assumptions-auditor** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "assumptions-auditor"`. Create a task with `TaskCreate` describing the audit work and assign it to `assumptions-auditor` via `TaskUpdate(owner: "assumptions-auditor")`. The teammate must:
    1. Read the modified plan (at the strategy-appropriate path) and verify it does not contain stale references to the old assumption.
    2. Verify the modified plan is internally consistent — steps reference correct files, phases align, context YAMLs match the plan's expectations.
    3. Verify all updated YAMLs (intent-registry, agent-assumptions, assumption-changes if applicable) are structurally valid YAML and consistent with the modified plan.
    4. Verify no unintended changes were introduced to sections that should have been preserved exactly (ROLLBACK/CONTINUE only).
    5. If step 5 produced updated context YAMLs, verify they are consistent with the modified plan's Relevant Files section.
    6. For ROLLBACK/CONTINUE, verify the `## Iteration Metadata` section is present and correctly formatted.
    7. For FRESH_PLAN, verify NO `## Iteration Metadata` section is present.
    8. Output `PLAN_FOLDER_PATH/audit-report_replan-<change-id>.yaml` following the schema defined in the `## Team of Agents` section.
    9. Mark task completed via `TaskUpdate(status: "completed")` and send summary to replan-lead via `SendMessage`, including counts of issues found by severity.

8. **Finalize & Report** -- The replan-lead reviews the audit report:
    - If the audit found high-severity issues, apply corrections to the modified plan and updated YAMLs directly.
    - Write final versions of all modified files to their respective locations.
    - Produce the change report following the `## Report` section format below.

9. **Shutdown Team** -- Send `SendMessage` of type `shutdown_request` to each active teammate (`assumption-matcher`, `impact-tracer`, `file-re-explorer` if spawned, `plan-rewriter`, `assumptions-auditor`). Wait for all teammates to acknowledge shutdown. Finally, call `TeamDelete` to clean up the team resources.

## Output Structure

### FRESH_PLAN

```
<plan-folder>/
├── <original-plan>.md                                        # Original plan (unchanged)
├── replan-<change-id>-<descriptive-name>.md                  # New base plan (NO ## Iteration Metadata)
├── matched-assumptions_replan-<change-id>.yaml               # Analysis: what was matched
├── impact-map_replan-<change-id>.yaml                        # Analysis: impact map
├── strategy-decision_replan-<change-id>.yaml                 # Analysis: strategy choice
├── audit-report_replan-<change-id>.yaml                      # Analysis: consistency audit
├── <filename>-context_replan-<change-id>.yaml                # Updated context YAMLs (if any)
├── assumptions/
│   ├── agent-assumptions.yaml                                # Original assumptions (unchanged)
│   └── agent-assumptions_replan-<change-id>.yaml             # Fresh assumptions
└── intents/
    ├── intent-registry.yaml                                  # Original intents (unchanged)
    └── intent-registry_replan-<change-id>.yaml               # Fresh intent registry
```

### ROLLBACK_ITERATION (rollback to iteration K, creating K.M)

```
<plan-folder>/
├── <original-plan>.md                                        # Original plan (unchanged)
├── run-<run-id-of-K>/
│   └── replan-<K.M>-<descriptive-name>.md                    # Iteration plan (HAS ## Iteration Metadata)
├── matched-assumptions_replan-<change-id>.yaml               # Analysis artifact
├── impact-map_replan-<change-id>.yaml                        # Analysis artifact
├── strategy-decision_replan-<change-id>.yaml                 # Analysis artifact
├── audit-report_replan-<change-id>.yaml                      # Analysis artifact
├── <filename>-context_iteration<K.M>.yaml                    # Updated context YAMLs (if any)
├── assumptions/
│   ├── agent-assumptions.yaml                                # Original assumptions (unchanged)
│   ├── agent-assumptions_iteration<K.M>.yaml                 # Sub-iteration assumptions
│   └── assumption-changes_iteration<K.M>.yaml                # Change analysis
└── intents/
    ├── intent-registry.yaml                                  # Original intents (unchanged)
    └── intent-registry_iteration<K.M>.yaml                   # Sub-iteration intents
```

### CONTINUE_ITERATION (continue from RUN_ID's iteration N, creating N.M)

```
<plan-folder>/
├── <original-plan>.md                                        # Original plan (unchanged)
├── run-<RUN_ID>/
│   └── replan-<N.M>-<descriptive-name>.md                    # Iteration plan (HAS ## Iteration Metadata)
├── matched-assumptions_replan-<change-id>.yaml               # Analysis artifact
├── impact-map_replan-<change-id>.yaml                        # Analysis artifact
├── strategy-decision_replan-<change-id>.yaml                 # Analysis artifact
├── audit-report_replan-<change-id>.yaml                      # Analysis artifact
├── <filename>-context_iteration<N.M>.yaml                    # Updated context YAMLs (if any)
├── assumptions/
│   ├── agent-assumptions.yaml                                # Original assumptions (unchanged)
│   ├── agent-assumptions_iteration<N.M>.yaml                 # Sub-iteration assumptions
│   └── assumption-changes_iteration<N.M>.yaml                # Change analysis
└── intents/
    ├── intent-registry.yaml                                  # Original intents (unchanged)
    └── intent-registry_iteration<N.M>.yaml                   # Sub-iteration intents
```

## Report

After completing the workflow, provide this report to the user:

```
Assumption Change Plan Created

Change ID: <change-id>
Strategy: <FRESH_PLAN | ROLLBACK_ITERATION | CONTINUE_ITERATION>
Strategy Reasoning: <brief reasoning>
Plan Folder: run_outputs/<PLAN_FOLDER>
Run ID: <RUN_ID>
<if ROLLBACK_ITERATION or CONTINUE_ITERATION>
Sub-iteration: <K.M or N.M>
Resumed From: iteration <K or N> (run-<run-id>)
</if>
Modified Plan: <full path to output plan>

To run: /run_plan <full path to output plan>

## Assumption Change Summary
| # | Original Assumption | New Assumption | Source | Confidence |
|---|---------------------|----------------|--------|------------|
| 1 | <old assumption text> | <new assumption text> | <agent-assumptions.yaml or intent-registry.yaml> | <high/medium/low> |

## Impact Summary
| Artifact | Section | Change Type |
|----------|---------|-------------|
| <plan-name>.md | <step/section> | <modified/added/removed> |
| <filename>-context.yaml | <section> | <updated> |
| intent-registry.yaml | <intent-id> | <interpretation updated> |

## Audit Results
- Stale references found: <count>
- Inconsistencies found: <count>
- Unintended changes: <count>

## Updated Intent Registry
| Intent ID | Intent | Updated Interpretation | Changed? |
|-----------|--------|----------------------|----------|
| <id> | <intent> | <new interpretation> | <yes/no> |

## Updated Assumptions
| Intent ID | Step | Old Assumption | New Assumption | Status |
|-----------|------|----------------|----------------|--------|
| <id> | <step> | <old> | <new> | <superseded -> new> |
```
