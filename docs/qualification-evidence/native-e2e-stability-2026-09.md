# Native E2E stability evidence, September 2026

## Scope

This qualification verifies the native E2E harness from issue #193. Focused
Android standalone runs precede repeated complete native CI runs. Complete runs
use one unchanged source revision, and failures are classified from their job
logs and uploaded diagnostics.

The final evidence records:

- Git revision and run URLs.
- Job conclusions and durations.
- Runtime versions and notable warnings from runtime metadata artifacts.
- Local Android and iOS broker outcomes.
- A controlled negative run proving that a behavioral assertion keeps CI red.

## Results

The issue #193 comments are the append-only evidence log. They record the run
URLs and results without changing the qualified Git revision after each run.
