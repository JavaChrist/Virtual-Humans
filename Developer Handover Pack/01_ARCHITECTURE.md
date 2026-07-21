# 01_ARCHITECTURE.md

> Virtual Humans SDK
>
> Official Architecture
>
> Version 1.0

---

# Purpose

This document describes the complete architecture of the Virtual Humans SDK.

Unlike PROJECT_CONTEXT, this document explains how every component is organized and how they interact.

The architecture described here is considered stable.

---

# Architecture Overview

The SDK is divided into independent systems.
Virtual Humans SDK
├── Core
├── Schema
├── Characters
├── Assets
├── Memory
├── Prompts
├── Behaviors
├── Templates
├── Videos
└── Documentation


Each folder has a single responsibility.

No folder should duplicate another one.

---

# Core

The Core contains the internal logic of the SDK.

Responsibilities:

- loading configuration
- loading characters
- pipeline orchestration
- validation
- runtime services
- utilities

Core never contains character data.

---

# Schema

Contains every shared data model.

Examples:

- Character
- Outfit
- Pose
- Expression
- Memory
- Prompt
- Video
- Workflow

Schemas define contracts.

---

# Characters

Every virtual human owns an isolated workspace.

Example:

Characters/

Mei/

Tom/

Emma/

Lucas/

Each character is self-contained.

---

# Assets

Visual resources.

Contains:

Portraits

Expressions

Poses

Outfits

Identity

Videos

Assets never contain AI logic.

---

# Memory

Persistent knowledge.

Organized into independent domains.

Identity

Character

Product

Brand

Marketing

Social

Video

Language

Relationship

Project

Runtime

Each file has one responsibility.

---

# Prompts

Prompt composition system.

Contains:

System

Behavior

Templates

Prompt Builder

Prompt modules are assembled dynamically.

---

# Behaviors

Dynamic behavior modules.

Examples:

Professional

Marketing

Sales

Teaching

Presentation

Support

Multiple modules can be combined.

---

# Templates

Reusable production templates.

Examples:

Documentation

Marketing

Video

Sales

Image

Social

Tutorial

Templates never include business logic.

---

# Videos

Video production resources.

Contains:

Scripts

Shots

Timeline

Voice

Camera

Transitions

Subtitles

Production Rules

---

# Data Flow

Every request follows the same pipeline.

Request

↓

Identity

↓

Memory

↓

Behavior

↓

Prompt Builder

↓

Template

↓

Generation

↓

Validation

↓

Output

---

# Character Isolation

Characters never share internal data.

Every character owns:

Identity

Assets

Memory

Behaviors

Prompts

Templates

Videos

This guarantees scalability.

---

# Extension Model

Adding a new character never requires changing the SDK.

Only a new character folder is required.

---

# Stability Policy

Folder organization is frozen.

Breaking architectural changes require explicit validation.