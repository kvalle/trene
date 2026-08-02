# Active workout layout prototype

Throwaway UI prototype for [Prototype the active workout layout](https://github.com/kvalle/trene/issues/23).

It explores two refinements of the expandable-card direction:

- `A1`: completed and suggested sets remain interleaved; completed rows collapse into compact receipts
- `A2`: completed sets are grouped in a compact section above a separate workspace for suggested sets

Run from the repository root:

```sh
python3 -m http.server 4173 --directory prototypes/active-workout-layout
```

Open <http://localhost:4173/?variant=A1>. Use the floating arrows, keyboard left/right arrows, or change `variant` to `A1` or `A2` in the URL.

State is intentionally in memory. Cards can be closed without opening another. Suggested sets can be edited, confirmed or removed; completed sets can be unconfirmed. Adding sets, system light/dark mode, narrow screens and text scaling are available for evaluating the layouts. This is not production code.
