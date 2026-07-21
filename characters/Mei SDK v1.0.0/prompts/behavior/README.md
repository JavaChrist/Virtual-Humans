# Behavior Modules

> Virtual Humans SDK — Prompt Architecture  
> Version: 1.0.0  
> Status: FROZEN (stable)

## Purpose

The `behavior/` folder defines HOW a Virtual Human works in different professional contexts. Behavior modules are dynamically activated by the Behavior Engine.

## Rules

- No behavior module may contradict the System prompts.
- System prompts always have the highest priority.
- A behavior module may never redefine the identity of the Virtual Human.

## Module structure

Each module folder contains:

- `prompt.md`: the context-specific prompt.
- `rules.md`: the constraints for the context.
- `manifest.json`: the module metadata.

## Modules

Professional · Creative · Teacher · Presentation · Marketing · Sales · Director · Interview · Support · Crisis

## Note

This layer is frozen. New behavior modules must be added as versioned additions, never by renaming or restructuring the existing ones.
