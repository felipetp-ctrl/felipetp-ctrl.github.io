---
description: Orchestrates the Plan -> Run -> Review iterative loop for generic task execution, delegating each phase to subagents until all intents are satisfied
argument-hint: [user-prompt] [sop-document] [resume-plan-folder] [resume-run-id] [user-input-on-resume] [ask-user-after-n-stale]
model: opus
---

# Generic Loop Orchestrator: Plan -> Run -> Review

Orchestrate a closed **Plan -> Run -> Review** iterative loop. Receive an initial user prompt, drive the full cycle until the review verdict is `PASS`, and manage iteration numbering, resumption, and user-input routing. Token efficiency is paramount: all heavy execution is delegated to independent subagents via the `Agent` tool. The orchestrator never executes `/plan_execution`, `/run_plan`, `/review_run`, or `/replan_changing_assumption` directly in its own context. It only coordinates, tracks state, and reports progress.

The four sub-commands being coordinated are:

- `/plan_execution` -- Creates a detailed execution plan with intent/assumption tracking
- `/run_plan` -- Executes a plan step-by-step with real-time intent/assumption tracking
- `/review_run` -- Independently reviews a completed run for intent fulfillment
- `/replan_changing_assumption` -- Changes a specific assumption and propagates through plan/YAMLs (takes `PLAN_FOLDER` + `RUN_ID` separately, not a full path)

## Variables

```
USER_PROMPT: $1
STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT(optional): $2
RESUME_FROM_PLAN_FOLDER(optional): $3
RESUME_FROM_RUN_ID(optional): $4
USER_INPUT_ON_RESUME(optional): $5
ASK_USER_AFTER_N_STALE_ITERATIONS(optional, default=omitted): $6
```

- `USER_PROMPT` -- The original task description (what the user wants accomplished). Preserved unchanged across all iterations.
- `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` -- Optional SOP document path, passed through to plan and replan commands.
- `RESUME_FROM_PLAN_FOLDER` -- When resuming, the plan folder name in `run_outputs/`. Triggers resume mode.
- `RESUME_FROM_RUN_ID` -- When resuming, the run ID to resume from. Required if `RESUME_FROM_PLAN_FOLDER` is provided.
- `USER_INPUT_ON_RESUME` -- Optional user input when resuming (condition to verify OR assumption to change). The orchestrator classifies and routes it.
- `ASK_USER_AFTER_N_STALE_ITERATIONS` -- Optional. If provided, the orchestrator pauses after N consecutive iterations where the same set of intents remain unsatisfied (no progress). The counter tracks staleness, not total failures -- it resets to 0 whenever a previously-unsatisfied intent becomes satisfied. If omitted, the orchestrator never pauses and loops autonomously until review passes.

## Token Efficiency Strategy

**Critical**: The orchestrator MUST NOT execute `/plan_execution`, `/run_plan`, `/review_run`, or `/replan_changing_assumption` directly in its own context. Each of these commands spawns teams of agents and consumes significant tokens. Running them directly would accumulate massive context across iterations and exhaust the token budget.

### Delegation Approach

For each phase (Plan, Run, Review, Replan), the orchestrator spawns a **fresh subagent** using the `Agent` tool. Each subagent:

- Starts with a clean context window (no accumulated history from previous iterations)
- Receives only the minimal inputs needed for its phase (paths, IDs, arguments)
- Executes the slash command via the `Skill` tool
- Returns only essential outputs (paths, IDs, verdicts) back to the orchestrator

The orchestrator maintains a **lightweight state object** tracking iteration history without accumulating the full content of plans, runs, and reviews.

### Subagent Spawn Pattern

```
For each phase:
  Agent(
    subagent_type: "general-purpose",
    prompt: "<minimal instructions with exact paths and arguments>",
    description: "<phase>-iteration-<N>"
  )
```

The prompt to each subagent must:
1. Tell it exactly which skill to invoke and with what arguments
2. Tell it what outputs to extract and report back
3. Explicitly instruct it NOT to summarize content -- just return paths, IDs, and verdicts
4. NOT include the full history of previous iterations -- only the current iteration's inputs

## Orchestrator State

The orchestrator maintains minimal state across iterations. This state is tracked in-memory and also persisted to a file for resume capability.

### State File

Path: `run_outputs/<plan-folder>/orchestrator-state.yaml`

```yaml
original-user-prompt: "<the original USER_PROMPT>"
sop-document: "<path or null>"
plan-folder: "<plan-folder name>"
ask-user-after-n-stale-iterations: <N or null>
stale-intent-counter: 0
last-unsatisfied-intents: []
current-status: "in-progress"

iterations:
  - iteration-number: 1
    type: "standard"
    plan-path: "<full path to plan .md>"
    run-id: "<generated run ID>"
    run-status: "completed"
    review-path: "<full path to review .md>"
    review-verdict: "PASS"
    review-summary: "<2-3 sentence summary from review>"
    unsatisfied-intent-ids: []
    user-input: null
    user-input-classification: null
    timestamp: "<ISO datetime>"

  - iteration-number: 2
    type: "standard"
    plan-path: "..."
    run-id: "..."
    run-status: "completed"
    review-path: "..."
    review-verdict: "PARTIAL"
    review-summary: "..."
    unsatisfied-intent-ids: ["intent-2", "intent-3"]
    user-input: null
    user-input-classification: null
    timestamp: "..."

  - iteration-number: "2.1"
    type: "replan"
    replan-trigger: "<user input that triggered the replan>"
    plan-path: "..."
    run-id: "..."
    run-status: "completed"
    review-path: "..."
    review-verdict: "PASS"
    review-summary: "..."
    unsatisfied-intent-ids: []
    user-input: "compare to file X..."
    user-input-classification: "assumption-change"
    timestamp: "..."
```

### State Update Rules

1. **After Plan phase**: Create a new iteration entry with `plan-path` populated. Set `run-id`, `run-status`, `review-path`, `review-verdict`, `review-summary`, `unsatisfied-intent-ids` to null/pending. Set `timestamp` to current ISO datetime.
2. **After Run phase**: Update the current iteration entry with `run-id` and `run-status` ("completed" on success, "failed" on error).
3. **After Review phase**: Update the current iteration entry with `review-path`, `review-verdict`, `review-summary`, `unsatisfied-intent-ids`.
4. **On resume**: Read the state file from `run_outputs/<RESUME_FROM_PLAN_FOLDER>/orchestrator-state.yaml`. Do NOT re-derive state from folder scanning.
5. **On completion**: Set `current-status` to `"passed"` or `"stopped-by-user"`.

### Run Status Tracking

- Set `run-status` to `"completed"` when the run subagent finishes successfully and returns a run ID.
- Set `run-status` to `"failed"` if the subagent errors out.
- Set `run-status` to `"interrupted"` if the loop was stopped mid-run.
- Only iterations with `run-status: "completed"` are eligible for review or guidance routing.

### Last Completed Run

When the orchestrator needs to route user guidance (from resume, checkpoints, or stuck-loop prompts), it must target the **last iteration with `run-status: "completed"`**. Never target an incomplete, failed, or interrupted run. Scan the iterations list in reverse to find it.

## Instructions

1. **Input validation**: If no `USER_PROMPT` is provided, stop and ask the user to provide it.
2. **Mode detection**: If `RESUME_FROM_PLAN_FOLDER` is provided, enter Resume Mode. Otherwise, enter Fresh Start Mode.
3. **Token efficiency**: MUST delegate all Plan/Run/Review/Replan work to subagents via the `Agent` tool. Never execute commands directly in your own context. Each subagent starts with a clean context.
4. **Subagent isolation**: Pass only minimal information to subagents (paths, IDs, arguments). Do NOT pass the orchestrator's accumulated state or history.
5. **State file is source of truth**: Always read/write `orchestrator-state.yaml`. Never rely on scanning folder structures for iteration state.
6. **Preserve original prompt**: Pass the original `USER_PROMPT` unchanged to every `/plan_execution` call. Iteration context comes from other arguments, not by modifying the prompt.
7. **Non-destructive**: Never overwrite previous iteration artifacts. All commands already handle this via their suffix conventions.
8. **Classification must be logged**: When classifying user input, record the classification and reasoning in the state file for auditability.
9. **Orchestrator never acts on guidance directly**: All user input (from resume, checkpoints, or stuck-loop prompts) must be routed through either `/review_run` (as `USER_CONDITION`) or `/replan_changing_assumption` (as `USER_PROMPT_TO_MODIFY_ASSUMPTION`). The orchestrator is a coordinator only -- it classifies and delegates.
10. **Guidance always targets the last completed run**: When routing user guidance, scan the state file's iterations list in reverse to find the last iteration with `run-status: "completed"`. Skip any failed or interrupted runs.
11. **User input classification heuristic**:
    - If the user input describes a **condition to verify** against outputs (e.g., "the sum should equal Y", "compare output to reference file Z") -> classify as `"review-condition"` and route to `/review_run` as `USER_CONDITION`.
    - If the user input describes a **correction to an assumption** (e.g., "field A maps to field B, not C", "the date format is DD/MM/YYYY") -> classify as `"assumption-change"` and route to `/replan_changing_assumption`.
    - **If ambiguous**: default to `"review-condition"` (less destructive -- a review does not change plans).
12. **Iteration numbering**:
    - Next whole iteration number = max(whole numbers in state file's iterations) + 1. Ignore sub-iterations (e.g., 2.1, 3.2) for this calculation.
    - Examples: iterations [1, 2, 2.1] -> next = 3. Iterations [1, 2, 3, 3.1, 3.2] -> next = 4.
    - Sub-iteration numbering is handled entirely by `/replan_changing_assumption` (it auto-discovers). The orchestrator does NOT compute sub-iteration numbers.
13. **Stale-intent checking**:
    - After each failed review, receive `unsatisfied_intent_ids` from the review subagent.
    - Compare against `last-unsatisfied-intents` in the state file:
      - If the unsatisfied set is **identical or a superset** (no previously-unsatisfied intent became satisfied): increment `stale-intent-counter`.
      - If **any previously-unsatisfied intent is now satisfied** (progress was made): reset `stale-intent-counter` to 0.
    - Update `last-unsatisfied-intents` to the current set.
    - If `ASK_USER_AFTER_N_STALE_ITERATIONS` is set and `stale-intent-counter` >= that value: pause and present options to user.
14. **Subagent failure handling**: If a subagent fails (returns error or does not produce expected outputs):
    - Do NOT immediately retry.
    - Log the failure in the state file (set `run-status: "failed"` if it was a run phase failure).
    - Report the failure to the user and ask for input.
    - Any user input received is classified and routed through `/review_run` or `/replan_changing_assumption` targeting the **last completed run** (not the failed one).

## Workflow

### Mode Detection

1. If `RESUME_FROM_PLAN_FOLDER` is provided -> **Resume Mode** (go to Step R1)
2. Otherwise -> **Fresh Start Mode** (go to Step 1)

---

### Fresh Start Mode

#### Step 1: Initialize

1. Log the start: "Starting Plan -> Run -> Review loop for: <first 80 chars of USER_PROMPT>..."
2. Set `iteration_number = 1`, `plan_folder = null` (will be set after first plan completes)

#### Step 2: Plan

Spawn a subagent to execute `/plan_execution` via the `Skill` tool.

**If iteration 1 (first iteration, no previous run data)**:

```
Agent(
  subagent_type: "general-purpose",
  description: "plan-iteration-1",
  prompt: "Execute the skill /plan_execution with these arguments:
    $1 = <USER_PROMPT>
    $2 = <STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT or empty>
  After the skill completes, report back:
    1. The full path to the generated plan .md file
    2. The plan folder name (the directory under run_outputs/)
  Do NOT summarize the plan contents -- just return the paths."
)
```

**If iteration N > 1 (has previous run data)**:

```
Agent(
  subagent_type: "general-purpose",
  description: "plan-iteration-<N>",
  prompt: "Execute the skill /plan_execution with these arguments:
    $1 = <USER_PROMPT (original, unchanged)>
    $2 = <STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT or empty>
    $3 = <ITERATION_NUMBER>
    $4 = <PREVIOUS_REVIEW_REPORT_PATH>
    $5 = <PREVIOUS_PLAN_PATH>
  After the skill completes, report back:
    1. The full path to the generated plan .md file
    2. The plan folder name (the directory under run_outputs/)
  Do NOT summarize the plan contents -- just return the paths."
)
```

After the subagent responds:

1. Extract `plan_path` and `plan_folder` from the subagent's response.
2. If this is **iteration 1**: create the state file at `run_outputs/<plan_folder>/orchestrator-state.yaml` with the initial structure (populate `original-user-prompt`, `sop-document`, `plan-folder`, `ask-user-after-n-stale-iterations`, `current-status: "in-progress"`, and the first iteration entry with `plan-path` set).
3. If this is **iteration N > 1**: add a new iteration entry to the state file with `iteration-number: N`, `type: "standard"`, `plan-path` populated, other fields null/pending.
4. Report: `[Iteration <N>] Plan: created at <plan_path>`

#### Step 3: Run

Spawn a subagent to execute `/run_plan` via the `Skill` tool.

```
Agent(
  subagent_type: "general-purpose",
  description: "run-iteration-<N>",
  prompt: "Execute the skill /run_plan with argument: <plan_path>
  After the skill completes, report back:
    1. The generated run ID
    2. The full path to the run folder
    3. The path to the execution summary (nextsteps.md)
  Do NOT summarize the run contents -- just return the paths and ID."
)
```

After the subagent responds:

1. Extract `run_id` and `run_folder_path` from the subagent's response.
2. Update the current iteration entry in the state file: set `run-id` and `run-status: "completed"`.
3. Report: `[Iteration <N>] Run: completed with run ID <run_id>`

If the subagent fails:

1. Set `run-status: "failed"` in the state file.
2. Report failure to the user and ask for input.
3. If user provides input, classify and route it targeting the **last completed run** (scan iterations in reverse for `run-status: "completed"`).

#### Step 4: Review

Spawn a subagent to execute `/review_run` via the `Skill` tool.

**Standard review (no user condition)**:

```
Agent(
  subagent_type: "general-purpose",
  description: "review-iteration-<N>",
  prompt: "Execute the skill /review_run with arguments:
    $1 = <plan_folder>
    $2 = <run_id>
  After the skill completes, report back:
    1. The overall verdict (PASS, PARTIAL, or FAIL)
    2. The path to the review report
    3. A 2-3 sentence summary of the findings (intents satisfied vs not, key gaps)
    4. The list of unsatisfied intent-ids (any intent with verdict NOT-SATISFIED,
       PARTIALLY-SATISFIED, or INCONCLUSIVE) -- return as a comma-separated list
       of intent-ids, or 'none' if all satisfied
  Do NOT include the full review report -- just the verdict, path, summary, and
  unsatisfied intent-ids."
)
```

**Review with user condition**:

```
Agent(
  subagent_type: "general-purpose",
  description: "review-iteration-<N>-with-condition",
  prompt: "Execute the skill /review_run with arguments:
    $1 = <plan_folder>
    $2 = <run_id>
    $3 = <USER_CONDITION>
  After the skill completes, report back:
    1. The overall verdict (PASS, PARTIAL, or FAIL)
    2. The path to the review report
    3. A 2-3 sentence summary of the findings (intents satisfied vs not, key gaps)
    4. The list of unsatisfied intent-ids (any intent with verdict NOT-SATISFIED,
       PARTIALLY-SATISFIED, or INCONCLUSIVE) -- return as a comma-separated list
       of intent-ids, or 'none' if all satisfied
  Do NOT include the full review report -- just the verdict, path, summary, and
  unsatisfied intent-ids."
)
```

After the subagent responds:

1. Extract `verdict`, `review_path`, `review_summary`, and `unsatisfied_intent_ids` from the subagent's response.
2. Parse `unsatisfied_intent_ids` into a list (split on comma, trim whitespace; empty list if "none").
3. Update the current iteration entry in the state file: set `review-path`, `review-verdict`, `review-summary`, `unsatisfied-intent-ids`, `timestamp`.
4. Report: `[Iteration <N>] Review: <VERDICT> -- <1-sentence summary>`

#### Step 5: Loop Decision

1. **If `verdict == PASS`**: Go to **Completion**.

2. **If `verdict == PARTIAL` or `FAIL`**:

   a. **Stale-intent check**: Compare `unsatisfied_intent_ids` from the review against `last-unsatisfied-intents` in the state file.
      - If the unsatisfied set is identical or a superset (no previously-unsatisfied intent became satisfied): increment `stale-intent-counter`.
      - If any previously-unsatisfied intent is now satisfied: reset `stale-intent-counter` to 0.
      - Update `last-unsatisfied-intents` to the current unsatisfied set.
      - Write updated counters to the state file.

   b. **Stale-intent checkpoint** (if `ASK_USER_AFTER_N_STALE_ITERATIONS` is set and `stale-intent-counter` >= that value):
      - Present the **On Stale-Intent Checkpoint** report (see Report to User section).
      - Use `AskUserQuestion` to present these options and wait for user response:
        1. **Continue** -- Reset `stale-intent-counter` to 0 and proceed to next iteration.
        2. **Provide guidance** -- Classify the user's guidance using the user input classification heuristic (instruction 11). Route it:
           - If `"review-condition"`: spawn a review subagent with the guidance as `USER_CONDITION` targeting the **last completed run**. If the new verdict is `PASS` -> Completion. If `PARTIAL`/`FAIL` -> continue the loop.
           - If `"assumption-change"`: spawn a replan subagent (see Resume Mode Step R3 "assumption-change" branch). Continue with Run -> Review -> Loop Decision.
           - Reset `stale-intent-counter` to 0.
        3. **Stop** -- Go to **Completion** with `current-status: "stopped-by-user"`.

   c. **Determine next iteration number**: Look at all iteration numbers in the state file, extract whole numbers only (ignore sub-iterations), and compute next = max(whole numbers) + 1.

   d. **Build inputs for next Plan phase**:
      - `USER_PROMPT` = original user prompt (preserved from start, unchanged)
      - `SOP` = original SOP (if provided)
      - `ITERATION_NUMBER` = next whole number
      - `PREVIOUS_RUN_REPORT` = path to the review report from this iteration (`review_path`)
      - `PREVIOUS_PLANNING_FILE` = path to the plan from this iteration (`plan_path`)

   e. Report: `[Iteration <N>] Review: <VERDICT> -- <summary>. Starting iteration <NEXT_N>...`

   f. **Go to Step 2** (Plan) with the iteration arguments.

---

### Resume Mode

#### Step R1: Load State

1. Read `run_outputs/<RESUME_FROM_PLAN_FOLDER>/orchestrator-state.yaml`.
2. If the state file does not exist, stop and inform the user that the plan folder does not contain orchestrator state. Suggest starting fresh.
3. Load all top-level fields: `original-user-prompt`, `sop-document`, `plan-folder`, `ask-user-after-n-stale-iterations`, `stale-intent-counter`, `last-unsatisfied-intents`, `current-status`.
4. Find the **last completed run**: scan the `iterations` list in reverse for the most recent entry with `run-status: "completed"`. This is the run that user guidance will target.
5. Validate that `RESUME_FROM_RUN_ID` matches the last completed run's `run-id`. If it matches a failed/interrupted run instead, warn the user and fall back to the last completed run.
6. Load the last completed run's state: `last_verdict` (from `review-verdict`), `last_plan_path` (from `plan-path`), `last_run_id` (from `run-id`), `last_review_path` (from `review-path`).
7. Set `plan_folder` from the state file.
8. Override `USER_PROMPT` with `original-user-prompt` from state file if `$1` was not provided or is empty.

#### Step R2: Classify User Input (if provided)

If `USER_INPUT_ON_RESUME` ($5) is provided:

1. **Read the last review report** (from `last_review_path`) -- only the **Executive Summary** and **Recommended Next Steps** sections to save tokens. Use `Read` with targeted line ranges or `Grep` to extract just those sections.

2. **Classify the user input** by analyzing it against the review findings:
   - Does the input describe a **condition to verify** against the outputs?
     - Examples: "the sum should equal Y", "compare output to reference file Z", "check that the total matches 1500"
     - Classify as: `"review-condition"`
   - Does the input describe a **correction to an assumption** made during planning or execution?
     - Examples: "field A maps to field B, not C", "the date format is DD/MM/YYYY not MM/DD/YYYY", "actually the source data is in section 2 not section 1"
     - Classify as: `"assumption-change"`
   - **If ambiguous**: default to `"review-condition"` (less destructive -- a review does not change plans; if the review comes back with the same issues, the next standard iteration will address them anyway).

3. **Log the classification**: Record the classification result and reasoning in the state file by adding a new iteration entry with `user-input: <USER_INPUT_ON_RESUME>` and `user-input-classification: <classification>`.

4. Proceed to **Step R3** based on the classification.

If no `USER_INPUT_ON_RESUME` is provided, skip to **Step R3 (no user input)**.

#### Step R3: Route Based on Classification

**If classified as `"review-condition"`**:

1. Spawn a review subagent to re-run `/review_run` against the **last completed run**, passing the user input as `USER_CONDITION`:

```
Agent(
  subagent_type: "general-purpose",
  description: "review-resume-with-condition",
  prompt: "Execute the skill /review_run with arguments:
    $1 = <plan_folder>
    $2 = <last_completed_run_id>
    $3 = <USER_INPUT_ON_RESUME>
  After the skill completes, report back:
    1. The overall verdict (PASS, PARTIAL, or FAIL)
    2. The path to the review report
    3. A 2-3 sentence summary of the findings
    4. The list of unsatisfied intent-ids (comma-separated, or 'none')
  Do NOT include the full review report."
)
```

2. Extract verdict, review_path, review_summary, unsatisfied_intent_ids.
3. Update the state file with the review results.
4. If the new verdict is `PASS` -> go to **Completion**.
5. If `PARTIAL` or `FAIL` -> go to **Step 5** (Loop Decision) to continue the standard loop.

**If classified as `"assumption-change"`**:

1. Spawn a replan subagent to run `/replan_changing_assumption`:

```
Agent(
  subagent_type: "general-purpose",
  description: "replan-assumption-change",
  prompt: "Execute the skill /replan_changing_assumption with arguments:
    $1 = <USER_INPUT_ON_RESUME>
    $2 = <plan_folder>
    $3 = <last_completed_run_id>
    $4 = <STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT or empty>
  After the skill completes, report back:
    1. The full path to the output plan .md file
    2. The sub-iteration number (e.g., 2.1)
  Do NOT summarize the replan contents -- just return the path and sub-iteration number."
)
```

2. Extract `replan_plan_path` and `sub_iteration_number` from the subagent's response.
3. Add a new iteration entry to the state file with:
   - `iteration-number`: the sub-iteration number (e.g., "2.1")
   - `type`: "replan"
   - `replan-trigger`: the user input
   - `plan-path`: the replan output plan path
   - Other fields null/pending
4. Report: `[Iteration <sub_iteration_number>] Replan: created at <replan_plan_path>`
5. Continue to **Step 3** (Run) with `plan_path` set to the replan's output plan path.
6. After Run -> Review -> **Step 5** (Loop Decision). If the review fails and another standard iteration is needed, use the next whole number (per instruction 12).

**If no user input provided on resume**:

1. Determine the next whole iteration number (per instruction 12).
2. Build inputs for the next Plan phase from the last completed run's data:
   - `USER_PROMPT` = `original-user-prompt` from state file
   - `SOP` = `sop-document` from state file
   - `ITERATION_NUMBER` = next whole number
   - `PREVIOUS_RUN_REPORT` = `last_review_path`
   - `PREVIOUS_PLANNING_FILE` = `last_plan_path`
3. Continue the standard loop from **Step 2** (Plan) with iteration arguments.

---

### Completion

1. Update state file: set `current-status` to `"passed"` if the final verdict was PASS, or `"stopped-by-user"` if the user chose to stop.
2. Write the final state to disk.
3. Generate the appropriate report (see Report to User section below).

## Report to User

### During Loop (one-line progress after each phase)

```
[Iteration <N>] Plan: created at <plan_path>
[Iteration <N>] Run: completed with run ID <run_id>
[Iteration <N>] Review: <VERDICT> -- <1-sentence summary>
```

If looping to next iteration:
```
[Iteration <N>] Review: <VERDICT> -- <summary>
  Starting iteration <N+1>...
```

### On Completion (PASS)

```
Plan -> Run -> Review Loop Complete

Iterations: <total count>
Final Verdict: PASS
Plan Folder: run_outputs/<plan-folder>/

## Iteration History
| # | Type | Verdict | Summary |
|---|------|---------|---------|
| 1 | standard | FAIL | Missing output files, incorrect data mapping |
| 2 | standard | PARTIAL | Data structures corrected, validation checks still failing |
| 2.1 | replan | PARTIAL | Format corrected, still missing summary output |
| 3 | standard | PASS | All intents satisfied |

Final Run: run-<run-id>
Final Review: <review-path>
State File: run_outputs/<plan-folder>/orchestrator-state.yaml
```

### On Stale-Intent Checkpoint (ASK_USER_AFTER_N_STALE_ITERATIONS triggered)

```
Plan -> Run -> Review Loop -- No progress on unsatisfied intents for <stale_count> consecutive iterations

Total iterations completed: <count>
Stale iterations (same intents unsatisfied): <stale_count>
Last Verdict: <verdict>
Unsatisfied Intents (unchanged across last <stale_count> iterations): <list>

## Iteration History
| # | Type | Verdict | Summary |
|---|------|---------|---------|
| ... | ... | ... | ... |

Options:
1. Continue looping (next iteration: <N+1>)
2. Provide guidance (condition to verify or assumption to change)
3. Stop the loop
```

Use `AskUserQuestion` to present these options and wait for the user's response. If the user provides guidance (option 2), classify and route it using the same logic as `USER_INPUT_ON_RESUME`.

### On Stopped by User

```
Plan -> Run -> Review Loop -- Stopped by User

Iterations completed: <count>
Last Verdict: <verdict>

## Iteration History
| # | Type | Verdict | Summary |
|---|------|---------|---------|
| ... | ... | ... | ... |

To resume later:
/generic_loop_orchestrator "<original prompt>" "<sop>" "<plan-folder>" "<last-run-id>" "<optional: guidance>"
```

## Constraints

- **Token efficiency is paramount**: The orchestrator MUST delegate all Plan/Run/Review/Replan execution to subagents via the `Agent` tool. It should never accumulate the full content of plans, runs, or reviews in its own context. It only tracks paths, IDs, verdicts, and short summaries.
- **State file is source of truth**: Always read/write `orchestrator-state.yaml`. Never rely on folder scanning for iteration state.
- **Preserve original prompt**: The original `USER_PROMPT` must be passed through to every `/plan_execution` call unchanged. Iteration context comes from the other arguments, not by modifying the prompt.
- **Non-destructive**: Never overwrite previous iteration artifacts. All commands already handle this via their suffix conventions. The orchestrator adds only `orchestrator-state.yaml`, which is updated in-place (this is acceptable as it is the orchestrator's own state, not a pipeline artifact).
- **Subagent isolation**: Each subagent gets a fresh context. Pass only the minimal information needed (paths, IDs, arguments). Do NOT pass the orchestrator's accumulated state or history to subagents.
- **Resume-safe**: The orchestrator can be killed and resumed at any point. The state file captures enough information to continue from the last completed phase.
- **Respect existing conventions**: All iteration numbering, file naming, and folder structure conventions from the existing commands must be followed exactly. The orchestrator adds no new naming conventions -- it uses what the commands produce.
- **User input classification must be logged**: When the orchestrator classifies user input, the classification and reasoning must be recorded in the state file for auditability.
- **Orchestrator never acts on guidance directly**: All user input (from resume, checkpoints, or stuck-loop prompts) must be routed through either `/review_run` (as `USER_CONDITION`) or `/replan_changing_assumption` (as `USER_PROMPT_TO_MODIFY_ASSUMPTION`). The orchestrator is a coordinator only -- it classifies and delegates, it does not interpret user guidance to modify plans, runs, or reviews itself.
- **Guidance always targets the last completed run**: When routing user guidance, the orchestrator must always target the last iteration whose `run-status` is `"completed"`. If the loop was interrupted mid-run or a run subagent failed, that incomplete run must be skipped -- its outputs are unreliable. The orchestrator scans the state file's iterations list in reverse to find the correct target.
