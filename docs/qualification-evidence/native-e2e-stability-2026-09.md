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

## Result

Qualification failed. Repeated runs exposed harness failures after the preceding
stabilization tickets had each passed their individual CI run:

- Run [33814172730](https://github.com/kvalle/trene/actions/runs/33814172730):
  the iOS recovery shard timed out starting a new XCTest driver after readiness.
- Run [33847614094](https://github.com/kvalle/trene/actions/runs/33847614094):
  iOS bulk text entry delivered only `U` from `Utdatert`.
- Run [33851797560](https://github.com/kvalle/trene/actions/runs/33851797560):
  the native picker exposed duplicate `Cancel` nodes and remained open.
- Run [33855868149](https://github.com/kvalle/trene/actions/runs/33855868149):
  iOS bulk text entry dropped characters, and Android Maestro instrumentation
  failed during driver reinstallation before the final smoke journey started.
- Run [33867391018](https://github.com/kvalle/trene/actions/runs/33867391018):
  iOS text entry still dropped characters when sent one command at a time.

The controlled negative run [33814097073](https://github.com/kvalle/trene/actions/runs/33814097073)
correctly failed its deliberate standalone assertion. Local Android qualification
and all eight iOS broker flows passed individually, but the required repeated
complete CI stability was not demonstrated. Experimental fixes made during the
qualification were removed from this branch because they did not remain stable
under repetition.
