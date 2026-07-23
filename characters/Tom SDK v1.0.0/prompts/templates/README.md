# Prompt Templates

> Virtual Humans SDK — Prompt Architecture  
> Version: 1.0.0  
> Status: FROZEN (stable)

## Purpose

The `templates/` folder contains reusable prompt templates for content generation. Templates are selected by the Prompt Engine according to the requested task.

## Rules

- No template may redefine the identity of the Virtual Human.
- Templates must comply with the System prompts and the active behavior module.

## Categories

- `video/`: video generation prompt templates.
- `image/`: image generation prompt templates.
- `social/`: social media prompt templates.
- `marketing/`: marketing prompt templates.
- `documentation/`: documentation prompt templates.
- `sales/`: sales prompt templates.

## Note

This layer is frozen. New templates or categories must be added as versioned additions, never by renaming or restructuring the existing ones.
