---
description: Reviews a completed run and verifies that all intents from the original user prompt were satisfied by the run results
argument-hint: [plan-folder] [run-id] [user-condition]
model: opus
---

# Review Run

Given a `PLAN_FOLDER` and a `RUN_ID` (and optionally a `USER_CONDITION`), review a completed run to verify that all intents from the original user prompt were satisfied by the run results. The review independently examines actual output files rather than blindly trusting execution-time tracking data. If a `USER_CONDITION` is provided, it is also verified against the run outputs. Follow the `Instructions` and work through the `Workflow` to complete the review. The command produces a detailed review report and a user-facing summary.

## Variables

PLAN_FOLDER: $1
RUN_ID: $2
USER_CONDITION(optional): $3
TEAM_NAME: run-review

- `PLAN_FOLDER` -- The name of the plan folder inside `run_outputs/` (e.g., `caixa-diario-novembro`). The run folder is resolved at `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/`.
- `RUN_ID` -- The run identifier (e.g., `cmw4kbxq`, `20260226-102921-tke6`). Used together with `PLAN_FOLDER` to locate the run folder at `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/`.
- `USER_CONDITION` -- Optional natural-language condition the user wants verified against the run outputs. Can reference file paths, column names, values, or any verifiable assertion about the run results.

## Team of Agents

Use `TeamCreate` with `team_name: TEAM_NAME` to create the run-review team before starting the workflow. All teammates are spawned via the `Task` tool with the `team_name` parameter set to `TEAM_NAME` and coordinated through the shared task list (`TaskCreate`, `TaskUpdate`, `TaskList`) and direct messaging (`SendMessage`).

### review-lead (You -- the orchestrator)
- **Role**: Team lead. Orchestrates the entire review workflow, loads all planning and execution artifacts, coordinates the intent reviewer and condition evaluator, synthesizes teammate outputs, resolves conflicting assessments, writes the final review report, and shuts down the team when done.
- **Responsibilities**: Locates the run folder, reads all artifacts, catalogs output files, spawns and coordinates teammates, cross-references findings, determines overall verdict, produces the final review markdown and user-facing summary.
- **Tools used**: `TeamCreate`, `TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, and skills (`xlsx`, `pdf`, `docx`, `pptx`)

### intent-reviewer
- **Role**: Intent fulfillment specialist. Independently examines each intent against the actual run outputs to produce an honest, evidence-based assessment of fulfillment. Must NOT simply trust the `intent-tracking.yaml` statuses -- must independently verify by examining actual output files, logs, and run summaries. Should be skeptical -- look for missing deliverables, partial coverage, or quality gaps.
- **subagent_type**: `build-agent`
- **Spawned at**: Step 3 (Spawn intent-reviewer)
- **Input**: `user-prompt.md`, `intent-registry.yaml`, `intent-tracking.yaml` (for reference, not as ground truth), the plan document, paths to all files in `run-result/` and `output/`
- **Output**: Message to review-lead with per-intent verdicts (`SATISFIED`, `PARTIALLY-SATISFIED`, `NOT-SATISFIED`, `INCONCLUSIVE`), evidence citations, and gap descriptions
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> reads all input artifacts and examines actual output files -> forms independent verdicts per intent -> marks task completed via `TaskUpdate(status: "completed")` -> sends per-intent findings to review-lead via `SendMessage` -> receives `shutdown_request`

### condition-evaluator (conditional -- only spawned if USER_CONDITION is provided)
- **Role**: Condition verification specialist. Parses the user's natural-language condition and executes the verification against run outputs. Must use appropriate skills to read and analyze files (e.g., `xlsx` skill for spreadsheet comparisons, `docx` skill for document comparisons). Must provide quantitative evidence where possible (row counts, value comparisons, diff summaries).
- **subagent_type**: `build-agent`
- **Spawned at**: Step 4 (Spawn condition-evaluator, in parallel with step 3)
- **Input**: `USER_CONDITION` text, paths to all run output files, relevant skills
- **Output**: Message to review-lead with condition verdict (`CONDITION-MET`, `CONDITION-NOT-MET`, `CONDITION-INCONCLUSIVE`), evidence, and details
- **Lifecycle**: Spawned -> assigned task via `TaskUpdate` -> parses condition -> reads and analyzes relevant files using skills -> determines verdict with quantitative evidence -> marks task completed via `TaskUpdate(status: "completed")` -> sends findings to review-lead via `SendMessage` -> receives `shutdown_request`
- <if no USER_CONDITION provided> Skip this agent entirely. Do not spawn the condition-evaluator teammate.</if>

## Instructions

- IMPORTANT: If no `PLAN_FOLDER` or `RUN_ID` is provided, stop and ask the user to provide them.
- **Input Validation**: Validate that `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/` exists. If the plan folder or run folder is not found, stop and ask the user to provide the correct values.
- **Independent Judgment**: The intent-reviewer must NOT simply trust the `intent-tracking.yaml` statuses. It must form its own verdict by examining actual output files. The tracker was written during execution and may be biased or overly optimistic.
- **Evidence-based**: Every verdict (intent or condition) must cite specific evidence -- file names, values, row counts, or observable facts. No verdicts without evidence.
- **Skills for File Analysis**: Use `xlsx`, `pdf`, `docx`, `pptx` skills as needed to read and analyze output files. Don't skip file inspection because the format is complex.
- **Analysis Only**: This command does NOT modify any run outputs, plans, or tracking files. It is read-only and produces only the review report in the `run-review/` directory.
- **No Execution**: This command only reviews. It does not re-run plan steps, fix issues, or modify outputs.
- **Team Coordination**: Use the same `TeamCreate`/`TaskCreate`/`TaskUpdate`/`SendMessage` pattern as `plan_spreadsheet_execution.md`. All teammates described in `## Team of Agents` are spawned via the `Task` tool with `team_name: TEAM_NAME` and coordinated through the shared task list and `SendMessage`.
- **Graceful Degradation**: If tracking YAMLs don't exist (older runs without tracking), the review should still work by comparing the plan's objectives against the actual output files. Report that tracking data was unavailable.
- **Team Setup**: Before starting the workflow, create the review team using `TeamCreate` with `team_name: TEAM_NAME` (value: `run-review`).
- **Team Shutdown**: After step 7 (Shutdown Team), send `SendMessage` of type `shutdown_request` to each active teammate (`intent-reviewer`, `condition-evaluator` if spawned). Wait for all teammates to acknowledge shutdown. Finally, call `TeamDelete` to clean up the team resources.

## Workflow

before starting:
- Activate venv in run_outputs/
- Create the review team: call `TeamCreate` with `team_name: TEAM_NAME` (value: `run-review`). This creates the shared task list at `~/.claude/tasks/TEAM_NAME/`.

1. **Locate Run** -- Verify that the directory `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/` exists. If the plan folder or run folder is not found, stop and ask the user to provide the correct `PLAN_FOLDER` and `RUN_ID`.

2. **Load Artifacts** -- Read all planning and execution artifacts from the resolved paths:
    1. Read `run_outputs/<PLAN_FOLDER>/user-prompt.md` (the original user request).
    2. Discover and read the plan `.md` file (glob for `run_outputs/<PLAN_FOLDER>/*.md` excluding `user-prompt.md` and any files inside subdirectories).
    3. Read `run_outputs/<PLAN_FOLDER>/intents/intent-registry.yaml` (what intents were identified). If it does not exist, note that tracking data is unavailable and proceed with plan objectives only.
    4. Read `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/tracking/intent-tracking.yaml` (execution-time intent tracking). If it does not exist, note unavailability.
    5. Read `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/tracking/user-assumptions-validation.yaml` (user assumption validation). If it does not exist, note unavailability.
    6. Read `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/tracking/agent-execution-assumptions.yaml` (agent execution assumptions). If it does not exist, note unavailability.
    7. Read all `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-result/run-<RUN_ID>-iteration-*-nextsteps.md` files (execution summaries).
    8. Catalog all files in `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-result/`, `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/output/`, and `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/staging/` directories.

3. **Spawn intent-reviewer** -- Call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "intent-reviewer"`. Create a task with `TaskCreate` describing the intent review work and assign it to `intent-reviewer` via `TaskUpdate(owner: "intent-reviewer")`. Provide the teammate with:
    - The original `user-prompt.md` content
    - The `intent-registry.yaml` content (what intents were identified)
    - The `intent-tracking.yaml` content (execution-time tracking -- for reference only, NOT as ground truth)
    - The plan document content (what was supposed to happen)
    - Paths to all output files in `run-result/` and `output/`
    - Instruction: independently verify each intent's fulfillment by examining actual outputs. Do NOT simply trust tracker statuses. For each intent, produce a verdict (`SATISFIED`, `PARTIALLY-SATISFIED`, `NOT-SATISFIED`, `INCONCLUSIVE`) with specific evidence citations. For `PARTIALLY-SATISFIED` or `NOT-SATISFIED`, describe what is missing. For `INCONCLUSIVE`, describe what evidence is missing.
    - The teammate marks task completed via `TaskUpdate(status: "completed")` and sends per-intent findings to review-lead via `SendMessage`.

4. **Spawn condition-evaluator (if USER_CONDITION provided)** -- In parallel with step 3, call `Task` with `subagent_type: "build-agent"`, `team_name: TEAM_NAME`, `name: "condition-evaluator"`. Create a task with `TaskCreate` describing the condition verification work and assign it to `condition-evaluator` via `TaskUpdate(owner: "condition-evaluator")`. Provide the teammate with:
    - The `USER_CONDITION` text exactly as provided by the user
    - Paths to all run output files in `run-result/`, `output/`, and `staging/`
    - Instruction: parse the condition, determine what data/files need to be examined, execute the verification (read files, compare values, check structure, etc.), use skills (`xlsx`, `pdf`, `docx`, `pptx`) as needed, and report the condition as `CONDITION-MET`, `CONDITION-NOT-MET`, or `CONDITION-INCONCLUSIVE` with detailed quantitative evidence.
    - The teammate marks task completed via `TaskUpdate(status: "completed")` and sends findings to review-lead via `SendMessage`.
    - <if no USER_CONDITION provided> Skip this step entirely. Do not spawn the condition-evaluator teammate.</if>

5. **Synthesize Findings** -- After receiving results from all active teammates:
    1. Cross-reference intent-reviewer verdicts with condition-evaluator findings (if applicable).
    2. Review `user-assumptions-validation.yaml` for any `violated` or `partially-true` user assumptions and assess their impact on intent verdicts.
    3. Review `agent-execution-assumptions.yaml` for any `HIGH` risk agent assumptions that were not validated.
    4. Identify any conflicts between tracker statuses and reviewer verdicts.
    5. Determine the overall run verdict:
        - `PASS`: All intents `SATISFIED` and condition `CONDITION-MET` (if provided)
        - `PARTIAL`: Some intents `PARTIALLY-SATISFIED` or `INCONCLUSIVE`, or condition partially met
        - `FAIL`: Any intent `NOT-SATISFIED` or condition `CONDITION-NOT-MET`

6. **Generate Review Report** -- Create the `run-review/` directory at `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-review/` if it doesn't exist. Write the report to `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-review/<RUN_ID>-review.md` following the Report Format below.

7. **Shutdown Team** -- Send `SendMessage` of type `shutdown_request` to each active teammate (`intent-reviewer`, `condition-evaluator` if spawned). Wait for all teammates to acknowledge shutdown. Finally, call `TeamDelete` to clean up the team resources.

## Report Format

The review report at `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-review/<RUN_ID>-review.md` must follow this exact structure:

```markdown
# Run Review Report

**Run ID**: <RUN_ID>
**Review Date**: <ISO date>
**Plan Folder**: `run_outputs/<PLAN_FOLDER>/`
**Plan Document**: `<plan-name>.md`
**Original User Prompt**: `user-prompt.md`
**Overall Verdict**: PASS | PARTIAL | FAIL

---

## Executive Summary

<2-4 sentences summarizing the run's success or failure. Mention total intents reviewed, how many satisfied vs not, and the condition result if applicable. Be direct about gaps.>

---

## Intent Fulfillment Review

### Summary

| # | Intent ID | Intent (short) | Tracker Status | Review Verdict | Gap Description |
|---|-----------|----------------|----------------|----------------|-----------------|
| 1 | <id> | <brief description> | <from tracking yaml> | SATISFIED / PARTIALLY-SATISFIED / NOT-SATISFIED / INCONCLUSIVE | <brief gap or "—" if satisfied> |
| 2 | ... | ... | ... | ... | ... |

**Intents Satisfied**: <count> / <total>
**Intents Partially Satisfied**: <count>
**Intents Not Satisfied**: <count>
**Intents Inconclusive**: <count>

### Detailed Intent Analysis

#### Intent: <intent-id> — <verdict>

**Intent**: <full intent description from registry>
**User's Evidence**: <evidence field from registry>
**Tracker Status**: <status from intent-tracking.yaml>
**Tracker Evidence**: <evidence from intent-tracking.yaml>

**Independent Review**:
<The reviewer's own analysis of whether this intent was satisfied, based on examining actual output files, logs, and deliverables. Must cite specific files, values, or observations as evidence.>

**Verdict**: <SATISFIED | PARTIALLY-SATISFIED | NOT-SATISFIED | INCONCLUSIVE>
**Reasoning**: <Why this verdict was chosen. If different from tracker status, explain the discrepancy.>

<if NOT-SATISFIED or PARTIALLY-SATISFIED>
**What's Missing**:
- <specific gap 1>
- <specific gap 2>

**To Fully Satisfy**:
- <action needed 1>
- <action needed 2>
</if>

---

<repeat for each intent>

---

## Assumptions Review

### User Assumptions

| # | Intent ID | Assumption | Validation Status | Impact on Intents |
|---|-----------|------------|-------------------|-------------------|
| 1 | <id> | <assumption text> | confirmed / violated / partially-true / unvalidated | <which intents affected and how> |

<if any violated or partially-true>
### Violated / Partially-True Assumptions — Impact Analysis

#### <assumption text>
- **Status**: <violated / partially-true>
- **Evidence**: <what was found>
- **Affected Intents**: <list of intent-ids>
- **Impact**: <how this affects the intent verdicts>
</if>

### Agent Execution Assumptions (High Risk)

| # | Step | Assumption | Risk | Category | Validated? |
|---|------|------------|------|----------|------------|
| 1 | <step> | <assumption> | HIGH | <category> | <yes/no/unknown> |

---

<if USER_CONDITION was provided>
## User Condition Verification

**Condition**: <USER_CONDITION as provided by user>
**Verdict**: CONDITION-MET | CONDITION-NOT-MET | CONDITION-INCONCLUSIVE

### Verification Details

<Detailed description of how the condition was verified. Include:>
- **Method**: <what was checked, which files were read, which tools were used>
- **Evidence**: <specific values, counts, diffs, comparisons>
- **Result**: <quantitative result if applicable>

<if CONDITION-NOT-MET>
### Condition Failures

| # | Expected | Actual | Location | Description |
|---|----------|--------|----------|-------------|
| 1 | <expected value/state> | <actual value/state> | <file:line or file:cell> | <what went wrong> |
</if>

---
</if>

## Run Output Inventory

### Deliverables Produced

| # | File | Type | Description | Size/Rows |
|---|------|------|-------------|-----------|
| 1 | `run-result/<file>` | <xlsx/pdf/docx/csv/md> | <brief description> | <file size or row count> |

### Logs

| # | File | Description |
|---|------|-------------|
| 1 | `logs/<file>` | <brief description> |

---

## Final Verdict

**Overall**: <PASS / PARTIAL / FAIL>

**Reasoning**: <Explain the verdict. FAIL if any intent is NOT-SATISFIED or condition is NOT-MET. PARTIAL if any intents are PARTIALLY-SATISFIED or INCONCLUSIVE. PASS only if all intents are SATISFIED and condition is MET (if provided).>

### Recommended Next Steps

<if PASS>
- Run is complete. All intents satisfied.
<if USER_CONDITION provided and MET>
- User condition verified successfully.
</if>
</if>

<if PARTIAL or FAIL>
1. <specific action to address gap 1>
2. <specific action to address gap 2>
3. <specific action to address gap N>

**Suggested approach**: <replan with `/plan_spreadsheet_execution` iteration mode | manual fix | re-run specific steps | other>
</if>

---

**Review File**: `run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-review/<RUN_ID>-review.md`
```

## Constraints

- **Analysis only**: This command does NOT modify any run outputs, plans, or tracking files. It is read-only and produces only the review report.
- **Independent judgment**: The intent-reviewer must NOT simply trust the `intent-tracking.yaml` statuses. It must form its own verdict by examining actual output files. The tracker was written during execution and may be biased.
- **Evidence-based**: Every verdict (intent or condition) must cite specific evidence -- file names, values, row counts, or observable facts. No verdicts without evidence.
- **Skills for file analysis**: Use `xlsx`, `pdf`, `docx`, `pptx` skills as needed to read and analyze output files. Don't skip file inspection because the format is complex.
- **Graceful degradation**: If tracking YAMLs don't exist (older runs without tracking), the review should still work by comparing the plan's objectives against the actual output files. Report that tracking data was unavailable.
- **No execution**: This command only reviews. It does not re-run plan steps, fix issues, or modify outputs.
- **Team coordination**: Use the same `TeamCreate`/`TaskCreate`/`TaskUpdate`/`SendMessage` pattern as `plan_spreadsheet_execution.md`.

## Report to User

After writing the review report, provide this summary to the user:

```
<verdict-emoji> Run Review Complete

Run ID: <RUN_ID>
Plan: <PLAN_FOLDER>
Report: run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-review/<RUN_ID>-review.md

## Intent Fulfillment
| Intent ID | Verdict |
|-----------|---------|
| <id> | <verdict> |

Satisfied: <count>/<total> | Partial: <count> | Not Satisfied: <count> | Inconclusive: <count>

<if USER_CONDITION>
## User Condition
**Condition**: <USER_CONDITION>
**Result**: <CONDITION-MET / CONDITION-NOT-MET / CONDITION-INCONCLUSIVE>
<brief evidence summary>
</if>

**Overall Verdict**: <PASS / PARTIAL / FAIL>

<if PARTIAL or FAIL>
## Gaps to Address
1. <gap 1>
2. <gap 2>

Consider replanning with: /plan_spreadsheet_execution "<original prompt> — iteration 2: address gaps from run <RUN_ID>" <SOP if applicable> 2 run_outputs/<PLAN_FOLDER>/run-<RUN_ID>/run-review/<RUN_ID>-review.md run_outputs/<PLAN_FOLDER>/<plan-name>.md
</if>
```

Where `<verdict-emoji>` is:
- PASS: `✅`
- PARTIAL: `⚠️`
- FAIL: `❌`
