# App Gatekeeping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the product behind invited, enabled accounts while keeping a public marketing page and allowing admins to disable accounts immediately.

**Architecture:** Add a database-backed `user_access` layer, enforce it in auth bootstrap and route guards, split the public marketing route from gated product routes, and add admin controls for account enable/disable. Immediate lockout is enforced client-side on session bootstrap and subsequent protected loads by treating missing or disabled access rows as an auth failure.

**Tech Stack:** React, React Router, TanStack Query, Vitest, Supabase Auth, Supabase Postgres, RLS

---
