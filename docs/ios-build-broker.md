# iOS build broker

The local iOS build broker lets a cplt agent request source-bound Simulator
verification without giving that agent direct Xcode, Simulator, or Maestro
access. The user starts the foreground broker outside cplt. Agents interact only
through `scripts/request-ios-smoke.py` as described in `AGENTS.md`.

## Supported flows

The broker supports these standalone flows:

- `restore-success`
- `damaged-backup`
- `picker-cancellation`
- `restore-failure`
- `newer-backup`
- `rollback-failure`
- `storage-failure`
- `share-cancellation`

`select-backup-file` is an internal helper and cannot be requested directly.
Cross-platform Android/iOS round trips are intentionally excluded because they
exchange artifacts between runtimes; the existing GitHub Actions workflows own
those tests.

The broker owns a reviewed copy of every executable Maestro graph. A Trene flow
with the same name does not replace or modify that copy. This prevents a source
change in this repository from turning an allowlisted request into arbitrary
host execution.

## Adding or changing a flow

A new Trene YAML file is not automatically available through the broker. Update
both repositories deliberately:

1. Confirm the flow is standalone. It must not require a caller-selected path,
   command, argument, environment variable, simulator, bundle ID, secret,
   network permission, or cross-platform artifact exchange. Design a separate
   bounded protocol before supporting such input.
2. Add or change the Trene graph under `.maestro/ios/` and verify it through the
   normal native CI path.
3. Copy the reviewed graph into the broker's `flows/` directory. Copy every
   included helper too. Includes must remain inside that directory, and script
   or shell commands are forbidden.
4. Add a new public name to `FLOW_NAMES` in the broker's
   `flow_validation.py`. Never generate the allowlist by scanning this
   repository.
5. Review `scripts/run-ios-smoke.sh` for fixed setup and post-flow checks used by
   the flow. Implement both as fixed profiles in the broker's `smoke_worker.py`.
   Fixture names, fault-marker filenames and contents, app identity, and other
   setup values must be selected by the broker, not supplied in request data.
6. Add protocol, graph-validation, setup, postcondition, and injection-resistance tests in the
   broker. The broker-owned graph must pass recursive validation and snapshot
   validation.
7. Run the full broker test suite, then regenerate this repository's client from
   a normal host terminal:

   ```sh
   /Users/kjetil/code/privat/ios-build-broker/broker.py init-repo "$PWD"
   ```

8. Update the supported-flow list in `AGENTS.md` and this document.
9. Build the current source once if needed, then run the new flow repeatedly
   from a normal host terminal:

   ```sh
   /Users/kjetil/code/privat/ios-build-broker/broker.py verify-build "$PWD"
   /Users/kjetil/code/privat/ios-build-broker/broker.py verify-smoke "$PWD" --flow FLOW_NAME
   ```

10. Confirm a fresh broker-owned simulator is removed after every request. Only
    then should agents rely on the new flow.

When a Trene flow changes, repeat the review, broker-copy, validation, and host
