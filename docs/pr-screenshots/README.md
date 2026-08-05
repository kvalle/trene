# Pull request screenshots

Pull requests with user-visible changes must include before and after
screenshots. The implementing agent decides which screens are affected and
captures every screen needed to review the visible result.

Store screenshots in an issue-specific directory:

```text
docs/pr-screenshots/<issue-number>/before-<screen>.png
docs/pr-screenshots/<issue-number>/after-<screen>.png
```

Capture each pair with the same device, viewport, theme, data, and navigation
state. The before image must show the current `origin/main`; the after image
must show the pull request branch. Use descriptive, stable screen names and
commit the images on the branch.

Embed the image pairs in the pull request description alongside a concise
summary of what changed and why. Arrange each before image next to, or directly
above, its corresponding after image and label both clearly.
