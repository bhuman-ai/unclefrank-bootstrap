# Project.md — Product PRD & Business Logic

## Purpose

This document represents the live Product Requirements Document (PRD) for the project. It defines the business goals, user personas, UX flows, features, and current production state.

## Structure

- **Business Goals & Logic**

  - Define the overarching goals and business logic that this product serves.

- **User Personas & Journeys**

  - Detailed breakdown of target users.
  - Key user flows and their touchpoints.

- **Feature List (Production State)**

  - Master list of current live features.
  - Linked to relevant Tasks.md for recent additions.

- **API Integrations & DB Structures**

  - Current external APIs in use.
  - Overview of database schemas in production.

## Draft Workflow

- Any Draft changes must pass a full **Dependency-Analyzer validation** against Interface.md and Technical.md.
- Cross-document coherence is mandatory before proceeding to Task breakdown.
- Any changes initiate a **Project.md Draft**.
- The Draft is co-edited with the LLM, validating logic, UX, and technical coherence.
- Once fully validated and reviewed by humans, it’s merged back into the main Project.md.

## Constraints & Design Philosophies

- UX Consistency Guidelines.
- Design principles.
- Platform-specific constraints.

## Contextual Linking

Tasks.md and Checkpoints.md automatically reference this document for:

- User Personas
- UX Flows
- API Specifications
- DB Schema References

## Versioning & Rollbacks

- All changes to Project.md Drafts are version-controlled.
- Rollbacks to previous Project.md states can be triggered if inconsistencies or critical errors are detected.

## Draft Governance

- There can only be **one active Draft** at any given time.
- The Draft remains until all associated tasks are marked complete and approved by a human.

## Example:

```
Feature: Settings Module
Personas: Linked to §User Personas → Admin Users
Flow: Linked to §UX Flows → Settings Navigation
API: Linked to §APIs → /settings endpoint
```

## Agent Responsibilities

- The **Project-Drafter Agent** guides all Draft edits, ensuring alignment with Claude.md principles and maintaining document integrity.

## Merge Policy

- Only upon human-approved completion of all related tasks does the Draft merge into the Production Project.md.
- Auto-merges are managed by the Merge-Controller Agent post-approval.

