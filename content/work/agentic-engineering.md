---
title: "I use AI. I check its work."
eyebrow: "Agentic engineering · Bounded static evidence"
description: "Edit Python and contracts in the Sentinels browser lab, inspect structural connections and data handoffs, and repair deliberate failures."
lead: "Agents can explore solutions quickly. Engineering judgment turns that exploration into something we can trust enough to ship."
walkthrough: true
sentinels_lab: true
---
## Start with a real failure

In a long-running Python project, I found broken connections between code that an agent believed existed and code that actually existed: mismatched names, stale references and missing links across a changing codebase.

I identified the problem. An agent proposed abstract syntax tree analysis. I directed the work, reviewed the results and asked the agent to introduce a deliberately malformed reference. Watching the check fail on that known-bad example gave us evidence that it detected the intended failure.

## Make the evidence inspectable

[Sentinels](https://github.com/goldenmonkeyrnd/sentinels) makes those checks a separate, reusable tool. Its integration contracts ask concrete questions:

1. Does a declared production entry connect to the required function or method?
2. Does a producer’s result reach the named consumer argument or payload field?
3. Do produced fields, exports or a JSON artifact agree with the declared shape?

{{< sentinels-coverage >}}
A fourth family checks coverage policy: does every declaration in a named source directory have a compatible contract, or an explicit reason for treating it as internal? Its inventory exposes unclassified additions and stale ledger entries. An internal classification records a decision; it does not prove the code behaves correctly.
{{< /sentinels-coverage >}}

The editable lab below uses a synthetic county-publication workflow. Disconnect its validator, discard its calculation or rename a published field. Run the analyzer, follow its witness to the source, then repair the defect. The examples include class methods, Prefect scheduling and Typer registration. You can change the contract too, and download the complete input bundle and report to reproduce the result locally.

{{< sentinels-coverage >}}
The coverage story adds a public function without classifying it. The existing validator contract still passes, while the coverage check fails. Add an appropriate requirement or document its internal role, then inspect the updated inventory.
{{< /sentinels-coverage >}}

The browser and CLI use the same Python wheel. Reports name inspected files, hashes, supported assumptions, source locations and unresolved reasons. CivicAtlas adopts the released CLI for its actual validator connection, manifest handoff and published snapshot shape; its data-validation and byte-reproduction checks remain separate.

## A useful limit is part of the result

Static reachability does not prove that validation runs on every execution path or that a function’s behavior is correct. A registered command or scheduled task is structural evidence, not observed successful execution. The lab includes a fixed runtime counterexample to make that distinction visible.

Supported contracts return **PASS** or **FAIL**. Relevant ambiguity returns **UNRESOLVED**; invalid inputs return **ERROR**. Dynamic dispatch and unsupported serialization never receive a reassuring result by assumption. A report can show a definite violation alongside uncertainty.

I did not systematically measure false positives in the original project. The current demonstration uses explicit fixtures to make its supported behavior and limitations visible.

Sentinels is AGPL-3.0-only. The [direct lab](/labs/sentinels/) shows the latest verified stable release adopted by this site. Its exact source, release, license, CLI wheel and downloads are linked beside the workspace. Released assets remain pinned together, so an open analysis session keeps the version it started with. Its scope is documented in the repository so the claim can stay as precise as the check.

The original recording remains below as historical evidence of the earlier CivicAtlas checker. The interactive lab produces a fresh result from your edits.
