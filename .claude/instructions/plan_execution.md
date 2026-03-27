---
description: Creates a plan for executing any type of task or automation
argument-hint: [user-prompt][standard-operational-procedure][iteration-number][previous-run-report][previous-planning-file]
model: opus
---

# Plan Execution

Create a detailed execution plan based on the user's intent provided through the `USER_PROMPT` variable. Analyze the request, ultrathink through the execution approach, and save a comprehensive execution plan document to `PLAN_OUTPUT_DIRECTORY/<plan-id>/<name-of-plan>.md` that can be used as a blueprint for actual automation work. Follow the `Instructions` and work through the `Workflow` to create the plan. If arguments `ITERATION_NUMBER`, `PREVIOUS_RUN_REPORT` AND `PREVIOUS_PLANNING_FILE` are provided assume that this is a replanning to plan the next steps or how to replan the execution after a failure. In iteration mode, the command is **non-destructive**: all generated artifacts receive an `_iteration<ITERATION_NUMBER>` suffix and original files are never overwritten. Additionally, assumption changes from the previous iteration are detected by cross-referencing previous assumptions with the run report's tracking data.

## Variables

USER_PROMPT: $1
STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT: $2
ITERATION_NUMBER(optional): $3
PREVIOUS_RUN_REPORT(optional): $4
PREVIOUS_PLANNING_FILE(optional): $5
PLAN_OUTPUT_DIRECTORY: run_outputs/
DATA_FOLDER: dados/
TEAM_NAME: task-planning

## Team of Agents

Use `TeamCreate` with `team_name: TEAM_NAME` to create the planning team before starting the workflow. All teammates are spawned via the `Task` tool with the `team_name` parameter set to `TEAM_NAME` and coordinated through the shared task list (`TaskCreate`, `TaskUpdate`, `TaskList`) and direct messaging (`SendMessage`).

### planner-lead (You — the orchestrator)
- **Role**: Team lead. Orchestrates the entire planning workflow, creates the final plan document, coordinates all teammates, and synthesizes their outputs.
- **Responsibilities**: Analyzes requirements, designs execution phases, writes the final plan markdown, reviews teammate outputs, and shuts down the team when done.
- **Tools used**: `TeamCreate`, `TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`

### intent-analyst
- **Role**: Intent identification specialist. Reads the `USER_PROMPT` and extracts all distinct goals (explicit and implicit).
- **subagent_type**: `build-agent`
- **Spawned at**: Step 3.2 (in parallel with file-searcher if applicable)
- **Input**: `USER_PROMPT`, `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/` path. <if iteration mode> Also receives the previous iteration's `intent-registry` file as read-only input to carry forward entries.</if>
- **Output**: <if base run (no ITERATION_NUMBER)> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/intent-registry.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/intent-registry_iteration<ITERATION_NUMBER>.yaml` </if> — a YAML file with structured entries: `intent-id`, `intent`, `evidence`, `interpretation`, `user-assumptions`. <if iteration mode> All entries from the previous iteration are carried forward; new entries are tagged with `iteration: <ITERATION_NUMBER>`.</if>
- **Lifecycle**: Spawned → assigned task via `TaskUpdate` → completes task → sends message to planner-lead with summary → receives `shutdown_request` from planner-lead

### assumptions-tracker
- **Role**: Assumptions auditor. Monitors the planning decisions made by the planner-lead and other teammates, identifying and recording every assumption NOT directly stated in the `USER_PROMPT` or `intent-registry.yaml`.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 4.5 (after intent-registry.yaml is available)
- **Input**: `USER_PROMPT`, the current iteration's `intent-registry` file, planning outputs from each workflow step. <if iteration mode> Also receives the previous iteration's `agent-assumptions` file as read-only input to carry forward entries.</if>
- **Output**: <if base run (no ITERATION_NUMBER)> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/agent-assumptions.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/agent-assumptions_iteration<ITERATION_NUMBER>.yaml` </if> — a YAML file with entries: `intent-id`, `agent`, `step`, `assumption`. <if iteration mode> All entries from the previous iteration are carried forward; new entries are tagged with `iteration: <ITERATION_NUMBER>`.</if>
- **Lifecycle**: Spawned → assigned tracking task via `TaskUpdate` → receives messages from planner-lead after each step with step outputs → appends assumptions → marks task complete when planner-lead signals planning is done → receives `shutdown_request`

### file-searcher
- **Role**: File locator. Searches the `DATA_FOLDER` for loosely referenced files (e.g. "budget document of january in folder-1").
- **subagent_type**: `Explore`
- **model**: sonnet
- **Spawned at**: Step 3.1 (only if there are files marked with FIND)
- **Input**: List of FIND markers with the information given about each file, `DATA_FOLDER` path
- **Output**: Message to planner-lead with the resolved file paths
- **Lifecycle**: Spawned → assigned search task → completes task → sends results via `SendMessage` to planner-lead → receives `shutdown_request`

### file-explorer
- **Role**: File structure analyst. Reads files and infers important structures (data fields, records, categories, iterable variables like dates) relevant to completing the task.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 4.1 (after files are identified)
- **Input**: File paths, `USER_PROMPT`, `PLAN_OUTPUT_DIRECTORY/<plan-folder>/` path. <if iteration mode> Also receives the previous iteration's `<filename>-context` YAMLs as read-only input.</if>
- **Output**: <if base run (no ITERATION_NUMBER)> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>-context.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>-context_iteration<ITERATION_NUMBER>.yaml` </if> for each analyzed file
- **Lifecycle**: Spawned → assigned exploration tasks via `TaskUpdate` → writes context YAMLs → sends summary via `SendMessage` to planner-lead → receives `shutdown_request`

## Instructions

- IMPORTANT: If no `USER_PROMPT` is provided, stop and ask the user to provide it.
- **Non-destructive iteration mode**: When `ITERATION_NUMBER`, `PREVIOUS_RUN_REPORT`, and `PREVIOUS_PLANNING_FILE` are all provided, NEVER overwrite base (iteration 1) files or previous iteration files. All generated artifacts must use the `_iteration<ITERATION_NUMBER>` suffix appended to the filename (before the extension). This applies to: `user-prompt`, `intent-registry`, `agent-assumptions`, and all `<filename>-context` YAMLs.
- **Iteration file resolution**: When loading previous iteration artifacts in iteration mode:
    - If `ITERATION_NUMBER` is 2: load the base files (no suffix) — e.g., `intent-registry.yaml`, `agent-assumptions.yaml`, `<file>-context.yaml`.
    - If `ITERATION_NUMBER` is 3 or higher: load the `_iteration<N-1>` suffixed files — e.g., `intent-registry_iteration<N-1>.yaml`.
    - Fallback: if the expected previous iteration file is not found, search for the latest available version by scanning for `_iteration<M>` suffixed files (highest M < current ITERATION_NUMBER), falling back to the base file (no suffix).
- Carefully analyze the files provided in the USER_PROMPT involved
- When breaking down into tasks determine task type (search|crud|filtering|analysis|transformation|generation) and complexity (simple|medium|complex)
- Think deeply (ultrathink) about the best approach to execute the requested functionality or solve the problem.
- Explore the files to understand existing patterns, iterable variables, and existing data structures. Sometimes there are iterable variables in the data like dates, categories, or identifiers.
- Follow the Plan Format below to create a comprehensive execution plan
- Include all required sections and conditional sections based on task type and complexity
- Generate a descriptive, kebab-case filename based on the main topic of the plan
- Save the complete implementation plan to `PLAN_OUTPUT_DIRECTORY/<descriptive-plan-folder>/<descriptive-name>.md`. Create the folder if it doesn't exist.
- <if base run (no ITERATION_NUMBER)> Save the raw `USER_PROMPT` to `PLAN_OUTPUT_DIRECTORY/<descriptive-plan-folder>/user-prompt.md` so the original request is preserved alongside the execution plan. <else if iteration mode> Save the raw `USER_PROMPT` to `PLAN_OUTPUT_DIRECTORY/<descriptive-plan-folder>/user-prompt_iteration<ITERATION_NUMBER>.md`. Do NOT overwrite the original `user-prompt.md`.</if>
- Ensure the plan is detailed enough that another analyst could follow it to execute the solution
- If writing of automation code is necessary, include code examples or pseudo-code where appropriate to clarify complex concepts
- Consider edge cases, error handling, and scalability concerns
- IMPORTANT: when processing data, preserve all original values from data sources. Don't aggregate or summarize values unless specifically required by the task or data volume makes it necessary.
- <if arguments `ITERATION_NUMBER`, `PREVIOUS_RUN_REPORT` AND `PREVIOUS_PLANNING_FILE` are provided> Use the `PREVIOUS_PLANNING_FILE` as a basis and make a planning file for what is missing or next steps from `PREVIOUS_RUN_REPORT`. Extract the <generated-run-id> from the `PREVIOUS_RUN_REPORT` filename and output the plan to `PLAN_OUTPUT_DIRECTORY/<descriptive-plan-folder>/run-<generated-run-id>/replan-<ITERATION_NUMBER>-<descriptive-name>.md`. All other artifacts (user-prompt, intent-registry, agent-assumptions, context YAMLs) MUST use the `_iteration<ITERATION_NUMBER>` suffix as described in the non-destructive iteration mode instruction above.</if>
- **Team Setup**: Before starting the workflow, create the planning team using `TeamCreate` with `team_name: TEAM_NAME`. All teammates described in the `## Team of Agents` section are spawned via the `Task` tool with the `team_name: TEAM_NAME` parameter and coordinated through the shared task list and `SendMessage`.
- **Intent Identification (intent-analyst teammate)**: Spawn the `intent-analyst` teammate (subagent_type: `build-agent`) in parallel with step 3 file-search. Create a task with `TaskCreate` describing the intent extraction work and assign it to `intent-analyst` via `TaskUpdate`. The teammate reads the `USER_PROMPT` and produces the intent registry file: <if base run> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/intent-registry.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/intent-registry_iteration<ITERATION_NUMBER>.yaml`, carrying forward all entries from the resolved previous iteration file and tagging new entries with `iteration: <ITERATION_NUMBER>` </if>. Entries follow this schema per entry: `intent-id` (short unique identifier), `intent` (the goal), `evidence` (verbatim or paraphrased fragment from user prompt), `interpretation` (how the agent understood the intent), `user-assumptions` (list of things the user takes for granted). When complete, the teammate marks the task as completed via `TaskUpdate` and sends a summary to planner-lead via `SendMessage`.
- **Assumptions Tracking (assumptions-tracker teammate)**: Spawn the `assumptions-tracker` teammate (subagent_type: `build-agent`) after the current iteration's intent-registry file is available. Create a task with `TaskCreate` for tracking assumptions and assign it via `TaskUpdate`. Throughout the planning workflow (steps 4.5-10), the planner-lead sends a `SendMessage` to `assumptions-tracker` after each step with the step's outputs and decisions. The teammate writes to: <if base run> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/agent-assumptions.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/agent-assumptions_iteration<ITERATION_NUMBER>.yaml`, carrying forward all entries from the resolved previous iteration file and tagging new entries with `iteration: <ITERATION_NUMBER>` </if>. Every assumption made that is NOT directly stated in the `USER_PROMPT` or the intent registry is recorded. Each entry must have: `intent-id`, `agent`, `step`, `assumption`.
- **Team Shutdown**: After step 10 (Save & Report), send a `SendMessage` of type `shutdown_request` to each teammate (`intent-analyst`, `assumptions-tracker`, `file-searcher`, `file-explorer`) to gracefully terminate them. After all teammates have shut down, clean up with `TeamDelete`.
- <if arguments `ITERATION_NUMBER`, `PREVIOUS_RUN_REPORT` AND `PREVIOUS_PLANNING_FILE` are provided> Resolve previous iteration files using the **Iteration file resolution** rules above. Load the resolved `intent-registry` file from `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/` and the resolved `agent-assumptions` file from `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/`. Also load all resolved `<filename>-context` YAMLs from `PLAN_OUTPUT_DIRECTORY/<plan-folder>/`. Pass these as read-only inputs to the `intent-analyst`, `assumptions-tracker`, and `file-explorer` teammates respectively. New entries must be tagged with `iteration: <ITERATION_NUMBER>`. Output files use the `_iteration<ITERATION_NUMBER>` suffix — teammates must NEVER write to the original (unsuffixed) files.</if>

## Workflow

before starting:
- Activate venv in run_outputs/
- Create the planning team: call `TeamCreate` with `team_name: TEAM_NAME` (value: `task-planning`). This creates the shared task list at `~/.claude/tasks/TEAM_NAME/`.
<if arguments `ITERATION_NUMBER`, `PREVIOUS_RUN_REPORT` AND `PREVIOUS_PLANNING_FILE` are provided>
- Read `PREVIOUS_RUN_REPORT` and `PREVIOUS_PLANNING_FILE`. Use `PREVIOUS_PLANNING_FILE` as a basis and make the plan to execute what is left or correct a failure.
- **Resolve previous iteration files**: Apply the iteration file resolution rules to locate the correct previous versions of `intent-registry`, `agent-assumptions`, all `<filename>-context` YAMLs, and `user-prompt`. (If ITERATION_NUMBER is 2, load base files with no suffix. If 3+, load `_iteration<N-1>` files. Fallback to latest available if expected file is missing.)
- **Detect assumption changes**: Cross-reference the resolved previous `agent-assumptions` file and `intent-registry` user-assumptions against the `PREVIOUS_RUN_REPORT` tracking YAMLs (specifically `tracking/user-assumptions-validation.yaml` and `tracking/agent-execution-assumptions.yaml` inside the run folder referenced by the report). For each previous assumption:
    1. Check if the run report's tracking data shows it as `confirmed`, `violated`, `partially-true`, or `unvalidated`.
    2. Determine the status: `kept` (confirmed and still valid), `superseded` (replaced by new information), `violated` (contradicted by evidence), or `refined` (needs adjustment based on evidence).
    3. If the assumption has new evidence, formulate the revised assumption text.
    4. Output the results to `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/assumption-changes_iteration<ITERATION_NUMBER>.yaml` with this schema:
    ```yaml
    - previous-assumption: <text of the original assumption>
      intent-id: <related intent from registry>
      source: <agent-assumptions or intent-registry-user-assumptions>
      source-iteration: <which iteration the assumption originated from, e.g., "base" or "iteration2">
      status: <kept|superseded|violated|refined>
      new-assumption: <revised text, if status is superseded or refined; null if kept or violated>
      evidence: <verbatim or paraphrased evidence from run report tracking YAMLs>
    ```
    5. This `assumption-changes` file informs the rest of the planning: violated/superseded/refined assumptions should be addressed in the new plan, while kept assumptions are carried forward unchanged.
</if>
1. **Save User Prompt** - <if base run (no ITERATION_NUMBER)> Write the raw `USER_PROMPT` content to `PLAN_OUTPUT_DIRECTORY/<plan-folder>/user-prompt.md` so the original request is preserved alongside all planning artifacts. <else if iteration mode> Write the raw `USER_PROMPT` content to `PLAN_OUTPUT_DIRECTORY/<plan-folder>/user-prompt_iteration<ITERATION_NUMBER>.md`. Do NOT overwrite the original `user-prompt.md`.</if>
2. Analyze Requirements and Execution steps - THINK HARD and parse the USER_PROMPT to understand the core problem and desired outcome
3. List the files involved in the `USER_PROMPT`. Group them by input files and files to be edited or to be created. There may be loose references to files like "budget document of january in folder-1", mark it with FIND <information-given-of-the-file>
    1. <if there is files with FIND> Spawn the **file-searcher** teammate: call `Task` with `subagent_type: "Explore"`, `team_name: TEAM_NAME`, `name: "file-searcher"`. Create a task with `TaskCreate` describing the files to find and assign it to `file-searcher` via `TaskUpdate(owner: "file-searcher")`. The teammate searches `DATA_FOLDER` and sends resolved paths back via `SendMessage` to planner-lead.</if>
    2. Spawn the **intent-analyst** teammate IN PARALLEL (alongside step 3.1 if applicable): call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "intent-analyst"`. Create a task with `TaskCreate` describing the intent extraction work and assign it to `intent-analyst` via `TaskUpdate(owner: "intent-analyst")`. The teammate must:
        1. Read and analyze the `USER_PROMPT` to extract all distinct goals (explicit and implicit).
        2. For each goal, produce a YAML entry with: `intent-id` (short unique identifier), `intent` (the goal), `evidence` (verbatim or paraphrased fragment from the user prompt that evidences it), `interpretation` (how the agent understood the explicit intent so the user can verify correctness), and `user-assumptions` (list of things the user appears to take for granted, e.g. file locations, data field names, date formats, business rules not stated). <if iteration mode> Carry forward ALL entries from the resolved previous iteration's intent-registry file. Tag new entries with `iteration: <ITERATION_NUMBER>`. If `assumption-changes_iteration<ITERATION_NUMBER>.yaml` marks any user-assumptions as `violated` or `refined`, update those entries accordingly and tag them with `iteration: <ITERATION_NUMBER>` and `changed-from-iteration: <source-iteration>`.</if>
        3. Save the complete registry to: <if base run> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/intent-registry.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/intent-registry_iteration<ITERATION_NUMBER>.yaml` </if>. Create the `intents/` subdirectory if it does not exist.
        4. Mark the task as completed via `TaskUpdate(status: "completed")` and send a summary to planner-lead via `SendMessage`.
4. Explore files involved - Understand existing patterns, iterating variables such as dates, categories, identifiers, and data structures for each relevant file.
    1. Spawn the **file-explorer** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "file-explorer"`. Create tasks with `TaskCreate` for each file (or group of files) to analyze and assign them to `file-explorer` via `TaskUpdate(owner: "file-explorer")`. The teammate must:
        1. Read each file and infer important structures to complete the task relevant to the `USER_PROMPT`.
        2. Output a file with the report in yaml structure for: <if base run> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>-context.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>-context_iteration<ITERATION_NUMBER>.yaml`. Use the resolved previous iteration's context YAML as input — carry forward existing structure analysis and supplement or adjust based on new findings. Tag new or changed sections with `iteration: <ITERATION_NUMBER>`.</if>
        3. Mark each task as completed via `TaskUpdate(status: "completed")` and send a summary to planner-lead via `SendMessage`.
4.5. **Track Assumptions (spawn assumptions-tracker)** - Spawn the **assumptions-tracker** teammate: call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "assumptions-tracker"`. Create a task with `TaskCreate` for tracking assumptions and assign it to `assumptions-tracker` via `TaskUpdate(owner: "assumptions-tracker")`. The teammate's instructions:
    - Create the `assumptions/` subdirectory in `PLAN_OUTPUT_DIRECTORY/<plan-folder>/` if it does not exist.
    - Wait for messages from planner-lead (via `SendMessage`) after each planning step (steps 5-10). Each message will include the step's outputs and decisions.
    - For each message received, identify every assumption made that is NOT directly stated in the `USER_PROMPT` or the current iteration's intent-registry file, and write to: <if base run> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/agent-assumptions.yaml` <else if iteration mode> `PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/agent-assumptions_iteration<ITERATION_NUMBER>.yaml`, carrying forward all entries from the resolved previous iteration file </if> using this YAML format:
    ```yaml
    - intent-id: <which intent from the registry this assumption relates to>
      agent: <which agent made the assumption: planner-lead | file-explorer | etc.>
      step: <the workflow step number where assumption was made>
      assumption: <what was assumed>
    ```
    - After each append, mark progress and wait for the next message.
    - **Planner-lead responsibility**: After completing each step (5-10), send a `SendMessage` to `assumptions-tracker` with a summary of decisions and outputs from that step so assumptions can be tracked.
    <if arguments `ITERATION_NUMBER`, `PREVIOUS_RUN_REPORT` AND `PREVIOUS_PLANNING_FILE` are provided> Tag each new entry with `iteration: <ITERATION_NUMBER>`. Pass the resolved previous iteration's `agent-assumptions` file as read-only input. The teammate writes to the new `_iteration<ITERATION_NUMBER>` file — it must NEVER modify the previous iteration's file. If `assumption-changes_iteration<ITERATION_NUMBER>.yaml` marks any agent-assumptions as `violated` or `refined`, carry those forward with updated text and mark them with `changed-from-iteration: <source-iteration>`.</if>
5. <if `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` provided> Read the SOP (standard operational procedure) file in `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` for aditional context. Don't follow the SOP, it is for reference on relevant details if the user is doing any related activities. Think hard and use the relevant context to complement you're approach to plan the `USER_PROMPT` by leveraging context, restrictions, business rules, file content, mapping rules, explained categories, category mapping from one source to another, other files that may contain sources of information, similar activities, or activities the user may have replaced, and any relevant information to complement the planning with details that would be infered and is not specified in the `USER_PROMPT`. Also the SOP is generally heavy with printed screens, so consider the information in the images. Reference the SOP in `STANDARD_OPERATIONAL_PROCEDURE_DOCUMENT` in the planning output document for guidance while executing.</if>
6. Design The Phases of Execution - Develop technical approach including task breakdown decisions and execution strategy
7. Document Plan - Structure a comprehensive markdown document with task intent, execution steps, and logging approach to give user complete visibility of each execution step.
8. In the document plan - it should specify that for each execution it should be generated a random id, and all generated files in the run (like automation code or other needed staging files) will be stored in `PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<generated-id>/`
9. Generate Filename - Create a descriptive kebab-case filename based on the plan's main topic
10. Save & Report - Follow the `Report` section to write the plan to `PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>.md` and provide a summary of key components
11. **Shutdown Team** - Send a final `SendMessage` to `assumptions-tracker` signaling that planning is complete so it can finalize `agent-assumptions.yaml`. Then send `SendMessage` of type `shutdown_request` to each active teammate (`intent-analyst`, `assumptions-tracker`, `file-searcher` if spawned, `file-explorer`). Wait for all teammates to acknowledge shutdown. Finally, call `TeamDelete` to clean up the team resources.

## Plan Format

Follow this format when creating execution plans:

```md
# Plan: <task name>

## Task Description
<describe the task in detail based on the prompt>

## Objective
<clearly state what will be accomplished when this plan is complete and the intent of the task>

<if iteration mode>
## Iteration Metadata
- **Iteration Number**: <ITERATION_NUMBER>
- **Previous Run ID**: <run-id extracted from PREVIOUS_RUN_REPORT filename>
- **Plan Folder**: <plan-folder-name>
- **Previous Run Path**: `PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<previous-run-id>/`
</if>

<if the implementation was broken down to phases, include this section:>

## Phases
<diagram of different phases>
<description of each phase and list of relevant files for each phase>

</if>

## Relevant Files
Use these files to complete the task:

<list all files relevant to the task with bullet points explaining why. Include new output files to be created under an h3 'New Output Files' section if needed. Include staging files to be created under an h3 'Staging Files' section if needed>
<list all context documentation>
<list the user-prompt file: <if base run> user-prompt.md <else if iteration mode> user-prompt_iteration<ITERATION_NUMBER>.md (and reference the original user-prompt.md for comparison) </if> from PLAN_OUTPUT_DIRECTORY/<plan-folder>/ as the original user request preserved for reference.>
<list the intent-registry file: <if base run> intent-registry.yaml <else if iteration mode> intent-registry_iteration<ITERATION_NUMBER>.yaml </if> from PLAN_OUTPUT_DIRECTORY/<plan-folder>/intents/ and the agent-assumptions file: <if base run> agent-assumptions.yaml <else if iteration mode> agent-assumptions_iteration<ITERATION_NUMBER>.yaml </if> from PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/ as tracking documentation for this planning session. The execution agent should review these files to understand the inferred intents and recorded assumptions.>
<if iteration mode> Also list `assumption-changes_iteration<ITERATION_NUMBER>.yaml` from PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/ as the assumption change analysis from the previous run. The execution agent should be aware of which assumptions were violated or refined.</if>

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

<list step by step tasks as h3 headers with bullet points. The first task should be activating venv in run_outputs/. And then with copying the files to `PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<generated-id>/` and move to the execution tasks. Last step should validate the work with the generated logs or if given reference output file>
<if files are mentioned in task, reference the context file created in `PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>-context.yaml` for reading before executing that step></if>

### 1. <First Task Name>
- <specific action><if task has type annotation put the type of action></if>
- <specific action><if task has type annotation put the type of action></if>

### 2. <Second Task Name>
- <specific action><if task has type annotation put the type of action></if>
- <specific action><if task has type annotation put the type of action></if>

<continue with additional tasks as needed>

## Logging Strategy
<describe logging strategy and logging actions required to give complete visibility of actions to end user>
<describe where logs should be outputed in `PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<generated-id>/logs>

<if in `USER_PROMPT` is given an reference file to compare against the result of the execution>
## Acceptance Criteria
<describe copying the output files and reference files to a folder in `PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<generated-id>/<test-correctness>`>
<instruct plan to call appropriate validation commands or tools to verify correctness>
</if>

## Validation file
<list location of comparison file for validation>
<instruct to read the file and report after execution to user if file was completed>

## Output Execution Summary
<instruct after the run to output execution summary and mention the run iteration and next steps on `PLAN_OUTPUT_DIRECTORY/<plan-folder>/run-<generated-id>/run-result/run-<generated-id>-iteration-<iteration-number>-nextsteps.md>

## Notes
<optional additional context, considerations, or dependencies.>
```

## Report

After creating and saving the execution plan, provide a concise report with the following format:

```
✅ Execution Plan Created

File: PLAN_OUTPUT_DIRECTORY/<plan-folder>/<filename>.md
User Prompt: <if base run> PLAN_OUTPUT_DIRECTORY/<plan-folder>/user-prompt.md <else if iteration mode> PLAN_OUTPUT_DIRECTORY/<plan-folder>/user-prompt_iteration<ITERATION_NUMBER>.md </if>
<if iteration mode>
Iteration: <ITERATION_NUMBER>
Assumption Changes: PLAN_OUTPUT_DIRECTORY/<plan-folder>/assumptions/assumption-changes_iteration<ITERATION_NUMBER>.yaml
</if>
Topic: <brief description of what the plan covers>
Key Components:
- <main component 1>
- <main component 2>
- <main component 3>
```

Additionally, after the report above, summarise both tracking files:

```
## Intent Registry Summary (from <if base run> intents/intent-registry.yaml <else if iteration mode> intents/intent-registry_iteration<ITERATION_NUMBER>.yaml </if>)
| Intent ID | Intent | Interpretation | User Assumptions |
|-----------|--------|---------------|-----------------|
| <id> | <intent> | <interpretation> | <assumptions list> |

## Agent Assumptions Summary (from <if base run> assumptions/agent-assumptions.yaml <else if iteration mode> assumptions/agent-assumptions_iteration<ITERATION_NUMBER>.yaml </if>)
| Intent ID | Step | Assumption |
|-----------|------|------------|
| <id> | <step> | <assumption> |

<if iteration mode>
## Assumption Changes Summary (from assumptions/assumption-changes_iteration<ITERATION_NUMBER>.yaml)
| # | Previous Assumption | Source | Source Iteration | Status | New Assumption | Evidence |
|---|---------------------|--------|------------------|--------|----------------|----------|
| 1 | <previous assumption text> | <agent-assumptions or intent-registry-user-assumptions> | <base or iterationN> | <kept/superseded/violated/refined> | <new text or "—"> | <evidence from run report> |

**Kept**: <count> | **Superseded**: <count> | **Violated**: <count> | **Refined**: <count>
</if>

Review the above before executing. Correct any misinterpretations by replanning.
```
