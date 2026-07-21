# System Prompts

> Virtual Humans SDK — Prompt Architecture  
> Version: 1.0.0  
> Status: FROZEN (stable)

## Purpose

The `system/` folder defines HOW a Virtual Human thinks. These prompts are permanent and always have the highest priority.

## Rules

- System prompts are permanent.
- System prompts always have the highest priority.
- Behavior modules and templates must never contradict these prompts.

## Files

- `00_SYSTEM.md`
- `01_IDENTITY.md`
- `02_REASONING.md`
- `03_COMMUNICATION.md`
- `04_BEHAVIOR.md`
- `05_MARKETING.md`
- `06_SOCIAL_MEDIA.md`
- `07_VIDEO.md`
- `08_PROJECTS.md`
- `09_RUNTIME.md`

## Note

This layer is frozen. New system layers must be added as versioned additions, never by renaming or reordering the existing files.
