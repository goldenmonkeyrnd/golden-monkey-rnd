---
title: "I use AI. I check its work."
eyebrow: "Agentic engineering · Bounded static evidence"
description: "A real CivicAtlas Sentinel checks local imported function references and static reachability to required validation, with intentionally broken examples."
lead: "Agents can explore solutions quickly. Engineering judgment turns that exploration into something we can trust enough to ship."
walkthrough: true
---
## Start with a real failure

In a long-running Python project, I found broken connections between code that an agent believed existed and code that actually existed: mismatched names, stale references and missing links across a changing codebase.

I identified the problem. An agent proposed abstract syntax tree analysis. I directed the work, reviewed the results and asked the agent to introduce a deliberately malformed reference. Watching the check fail on that known-bad example gave us evidence that it detected the intended failure.

## Make the evidence inspectable

The fresh Sentinel in [CivicAtlas](https://github.com/goldenmonkeyrnd/civicatlas) applies this approach to the real data pipeline. It checks two specific properties:

1. Supported local imported function references resolve to existing definitions.
2. A statically supported call path connects the production entry point to the required pipeline validator.

The fixtures include working code, a malformed reference, disconnected validation, a reference that exists only in a test, and a dynamic construct the checker cannot resolve. Unsupported constructs produce an **unresolved** result; they do not receive a silent pass.

## A useful limit is part of the result

Static reachability does not prove that validation runs on every execution path or that a function’s behavior is correct. The checker handles a defined subset of Python. Data validation, tests and deployment checks provide separate evidence for the application’s other properties.

I did not systematically measure false positives in the original project. The current demonstration uses explicit fixtures to make its supported behavior and limitations visible.

The recorded walkthrough below shows actual commands and results. Reproduction commands and fixture source are in the [public repository](https://github.com/goldenmonkeyrnd/civicatlas).
