# Active workout layout prototype

Throwaway UI prototype for [Prototype the active workout layout](https://github.com/kvalle/trene/issues/23).

It compares three structurally different ways to navigate exercises and register sets:

- `A`: expandable exercise cards in one scrolling stack
- `B`: one focused exercise with a horizontal exercise switcher
- `C`: one compact list with every exercise and set visible

Run from the repository root:

```sh
python3 -m http.server 4173 --directory prototypes/active-workout-layout
```

Open <http://localhost:4173/?variant=A>. Use the floating arrows, keyboard left/right arrows, or change `variant` to `A`, `B`, or `C` in the URL.

State is intentionally in memory. Inputs, set confirmation, adding sets, exercise switching, system light/dark mode, narrow screens and text scaling are available for evaluating the layouts. This is not production code.
