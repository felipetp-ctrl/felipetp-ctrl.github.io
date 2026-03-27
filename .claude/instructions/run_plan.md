# Execute the following plan

Follow the `Instructions` to execute the `Plan` with a coordinated team of agents, then `Report` the completed work.

## Variables

PLAN_PATH: $ARGUMENTS
TEAM_NAME: spreadsheet-execution

## Team of Agents

Use `TeamCreate` with `team_name: TEAM_NAME` to create the execution team before starting. All teammates are spawned via the `Task` tool with `team_name: TEAM_NAME` and coordinated through the shared task list (`TaskCreate`, `TaskUpdate`, `TaskList`) and direct messaging (`SendMessage`).

### executor (You — the team lead)
- **Role**: Reads and executes the plan step by step. After each step, sends a `SendMessage` to all tracker teammates summarizing what was done, then reviews their feedback before continuing.
- **Tools used**: `TeamCreate`, `TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, and skills (`xlsx`, `pdf`, `docx`, `pptx`)

### intent-tracker
- **Role**: Checks if execution is on track. Compares each step's outcome against the plan's objectives and the intent registry file (if referenced in the plan's Relevant Files section). Flags when execution drifts from the original intent.
- **subagent_type**: `build-agent`
- **Input**: The plan document, the intent registry file at `INTENT_REGISTRY_PATH` (if available), step-by-step progress messages from executor
- **Output**: `<plan-folder>/run-<run-id>/tracking/intent-tracking.yaml` with entries: `intent-id`, `status` (not-started|in-progress|fulfilled|at-risk|blocked), `step`, `evidence`, `drift-flag` (true/false), `drift-description`
- **Behavior**: On each message from executor, evaluates intent progress, updates tracking file, sends brief status back. Sends **urgent** message if drift is detected.

### user-assumption-tracker
- **Role**: Validates assumptions the user made when requesting the task. Pulls user assumptions from the intent registry's `user-assumptions` fields (if available) and from the plan itself. Checks whether they hold true as data is encountered during execution.
- **subagent_type**: `build-agent`
- **Input**: The plan document, the intent registry file at `INTENT_REGISTRY_PATH` (if available), step-by-step progress messages from executor
- **Output**: `<plan-folder>/run-<run-id>/tracking/user-assumptions-validation.yaml` with entries: `intent-id`, `assumption`, `status` (unvalidated|confirmed|violated|partially-true), `step`, `evidence`, `impact`
- **Behavior**: On each message from executor, checks if any user assumptions can be validated against actual data. Updates tracking file, sends brief status back. Sends **urgent** message if a user assumption is violated.

### agent-assumption-tracker
- **Role**: Tracks assumptions the executor is making about the task and data during execution that are NOT explicitly stated in the plan. Catches implicit assumptions about data structures, business rules, file contents, value formats, or mappings.
- **subagent_type**: `build-agent`
- **Input**: The plan document, the agent assumptions file at `AGENT_ASSUMPTIONS_PATH` from planning phase (if available), step-by-step progress messages from executor
- **Output**: `<plan-folder>/run-<run-id>/tracking/agent-execution-assumptions.yaml` with entries: `step`, `agent`, `assumption`, `category` (data-structure|business-rule|file-content|value-format|mapping|other), `risk` (low|medium|high), `basis`
- **Behavior**: On each message from executor, analyzes actions and decisions to detect implicit assumptions. Updates tracking file, sends brief status back. Sends **urgent** message if a high-risk assumption is detected.

### run-file-copier
- **Role**: Evaluates the previous run's folder structure and selectively copies relevant files to the new run folder. Spawned only in iteration mode.
- **subagent_type**: `build-agent`
- **Spawned at**: After iteration metadata is detected and the new run folder is created, BEFORE the first plan step is executed.
- **Input**: Previous run path, new run path, the current plan document, iteration number.
- **Output**: A log entry in `<new-run>/logs/iteration-copy-log.md` listing all copied files/folders and reasoning for skipped items.
- **Behavior**:
    1. List all folders and files in the previous run directory.
    2. For each folder/file, evaluate whether it contains work products relevant to the next iteration (spreadsheets, documents, generated reports, automation scripts, etc.).
    3. **Guidance for skipping**: Execution logs (`logs/`), run-level tracking data (`tracking/`), run result summaries (`run-result/`), and temporary staging artifacts are generally NOT relevant to carry forward — they belong to the previous execution's audit trail and the new run recreates its own.
    4. **When in doubt, copy it.** It is better to have an unnecessary file than to miss a needed one.
    5. Copy selected files preserving directory structure into the new run folder.
    6. Write the copy log, mark task complete, and send summary to executor.
- **Lifecycle**: Spawned → assigned task → completes task → sends summary to executor → receives `shutdown_request`

## Instructions

- Read the plan at `PLAN_PATH`, think hard (ultrathink) about the plan and execute it step by step.
- **Detect iteration mode**: After reading the plan, check if it contains an `## Iteration Metadata` section. If found, extract:
    - `ITERATION_NUMBER`: The iteration number
    - `PREVIOUS_RUN_ID`: The previous run ID
    - `PLAN_FOLDER`: The plan folder name
    - `PREVIOUS_RUN_PATH`: The previous run path (resolves to `run_outputs/<PLAN_FOLDER>/run-<PREVIOUS_RUN_ID>/`)
    - Set `IS_ITERATION` to `true`. If the section is not found, set `IS_ITERATION` to `false`.
- **Plan naming convention**: Plans can originate from `/plan_spreadsheet_execution` (whole-number iterations: 1, 2, 3, ...) or `/replan_changing_assumption` (sub-iterations: K.M where K is the iteration resumed from, M is the attempt). Both produce plans in the same format. The detection logic is the same:
    - If the plan contains `## Iteration Metadata` → iteration mode (IS_ITERATION=true)
    - Otherwise → base run mode (IS_ITERATION=false)
    - Iteration numbers may be whole (e.g., `2`) or sub-iterations (e.g., `1.1`, `2.3`). Treat as a string — use the `Previous Run Path` from the metadata for file resolution, not the iteration number.
    - The plan's `## Relevant Files` section lists all artifact paths explicitly — use those paths, do not guess or derive paths from the iteration number.
- **Copy previous run files (iteration mode only)**: If `IS_ITERATION` is `true`, perform these steps AFTER generating the new `run-<generated-id>/` folder structure but BEFORE executing the first plan step:
    1. Verify that `PREVIOUS_RUN_PATH` exists. If it does not exist, log a warning in `logs/run-log.md`: "WARNING: Previous run directory not found at <path>. Proceeding without copying previous files." and continue execution.
    2. Spawn the **run-file-copier** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "run-file-copier"`. Create a task with `TaskCreate` describing the copy work and assign it via `TaskUpdate(owner: "run-file-copier")`. Pass the previous run path, new run path, the plan document, and iteration number.
    3. Wait for `run-file-copier` to complete. Review its copy log summary.
    4. Inform all tracker teammates that this is iteration <ITERATION_NUMBER> building on run-<PREVIOUS_RUN_ID>, and which files were seeded into the new run folder.
- **Extract tracking file paths from the plan**: Parse the plan's `## Relevant Files` section to locate the intent registry and agent assumptions files. Set `INTENT_REGISTRY_PATH` and `AGENT_ASSUMPTIONS_PATH` to the paths found in the plan. If the plan does not reference these files, leave the variables empty and inform the trackers that no planning-phase tracking files are available.
- Use skills to read and manipulate pdfs, spreadsheets, word documents and powerpoints.
- Create the team (`TeamCreate`) and spawn all three tracker teammates (`Task` with `team_name`) before executing the first step. Pass `INTENT_REGISTRY_PATH` and `AGENT_ASSUMPTIONS_PATH` to the relevant trackers when spawning them.
- After completing each plan step, send a `SendMessage` to all three trackers with: step number, actions taken, data encountered, decisions made. Review their responses before continuing. If any tracker sends an **urgent** flag, pause and address it.
- After the last step, send a completion message to trackers, then shut them down with `shutdown_request` (include `run-file-copier` if it was spawned) and call `TeamDelete`.

## Plan
$ARGUMENTS

## Report
- Summarize the work you've just done in a concise bullet point list.
- Report the files and total lines changed with `git diff --stat`
- <if IS_ITERATION is true> Report that this was iteration <ITERATION_NUMBER> building on previous run-<PREVIOUS_RUN_ID>. Summarize which folders/files were copied and which were skipped (from `logs/iteration-copy-log.md`). </if>
- Include tracker summaries:

```
## Intent Tracking (from tracking/intent-tracking.yaml)
| Intent ID | Status | Drift? | Description |
|-----------|--------|--------|-------------|
| <id> | <status> | <yes/no> | <drift description if any> |

## User Assumptions (from tracking/user-assumptions-validation.yaml)
| Assumption | Status | Impact |
|------------|--------|--------|
| <assumption> | <status> | <impact if violated> |

## Agent Assumptions (from tracking/agent-execution-assumptions.yaml)
| Step | Assumption | Risk |
|------|------------|------|
| <step> | <assumption> | <risk> |

Review the above before accepting results. Replan if any intents are unfulfilled or critical assumptions were violated.
```
