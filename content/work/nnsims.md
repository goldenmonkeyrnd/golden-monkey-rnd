---
title: "NNsims"
eyebrow: "Artificial life · Private prototype"
description: "A Rust artificial-life prototype exploring adaptive agents, emergent behavior, and an isometric world built in Bevy."
lead: "Can a small simulated cast develop behavior worth watching?"
---

## The idea

NNsims explores how adaptive agents develop recognizable behavior through their surroundings and interactions. Small recurrent neural controllers drive agents in a simulated world, with an isometric interface built in Rust and Bevy.

The interest is in what happens between agents: how their needs, relationships, and environment shape what they do next, and how to make that behavior legible to a player.

## Inside the prototype

The current interface supports observing a small cast, selecting and naming agents, and queuing actions involving objects or other agents. Motive and relationship displays help explain the state of the simulation. A recent-events ticker follows simulation events and the outcomes of player commands.

These controls connect to the simulation itself. They provide a way to intervene in the world and inspect the consequences while the agents continue to act.

## The engineering focus

The simulation and its presentation have separate responsibilities. That makes it possible to examine behavior without the graphical client, then expose the same simulation through the player interface.

Reproducible runs and explicit behavioral tests help check whether a change preserves the intended rules. The work includes the boundary between player commands and agent behavior: an interface action needs to reach the simulation and produce an observable result.

## Where it stands

NNsims is an early private prototype. Its simulation and interaction systems are implemented; human playtesting of the current interaction flow and development toward a complete game remain unfinished. It is not available as a public demo or download.

This page describes the project at a high level. The source code and development assets remain private.
