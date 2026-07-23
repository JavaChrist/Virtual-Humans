# Prompts

> Virtual Humans SDK — Prompt Architecture  
> Version: 1.0.0  
> Status: FROZEN (stable)

This is the official Prompt Architecture of the Virtual Humans SDK v1.0.0. It is frozen: future versions may extend it, but must never redesign it, rename its folders or move its files.

## Structure

- `system/`: defines HOW a Virtual Human thinks. Permanent, highest priority.
- `behavior/`: defines HOW a Virtual Human works in different professional contexts. Dynamically activated by the Behavior Engine.
- `templates/`: reusable prompt templates for content generation. Selected by the Prompt Engine according to the requested task.

## Priority rules

1. System prompts always have the highest priority.
2. No behavior module may contradict the System prompts.
3. No template may redefine the identity of the Virtual Human.

## Design principles

Single Responsibility · Composable · Provider Agnostic · LLM Agnostic · Future Proof · Scalable · Modular · Production Ready

## Evolution rule

Future improvements must be introduced only through versioned additions, never by restructuring the existing architecture.
