# iOS build broker

The local iOS build broker lets a cplt agent request source-bound Simulator
verification without giving that agent direct Xcode, Simulator, or Maestro
access. The user starts the foreground broker outside cplt with the `trene`
project profile. Agents interact only through `scripts/request-ios-smoke.py` as
described in `AGENTS.md`.

## Host operation

Run broker commands from a normal host terminal. Every command must select the
Trene profile explicitly:

```sh
/Users/kjetil/code/privat/ios-build-broker/broker.py init-repo "$PWD" --profile trene
/Users/kjetil/code/privat/ios-build-broker/broker.py verify-build "$PWD" --profile trene
/Users/kjetil/code/privat/ios-build-broker/broker.py verify-smoke "$PWD" --profile trene --flow FLOW_NAME
/Users/kjetil/code/privat/ios-build-broker/broker.py serve "$PWD" --profile trene
```

`init-repo` regenerates Trene's request client. The generated client accepts a
heartbeat only when its protocol version, broker session, canonical Trene
repository, and profile ID are valid. This prevents a client from submitting to
a stale broker, another broker session, another checkout, or another project
profile.

Build-cache entries and flow snapshots are namespaced by profile. Cached
artifacts use the project-neutral names `App.app` and `fixtures/`.

## Flow trust boundary

Trene owns the Maestro YAML under `.maestro/e2e/ios/`; the broker does not keep a
second copy under `flows/`. A request contains a strict flow slug, which the
broker resolves beneath the fixed flow root configured by the `trene` profile.

Before execution, the broker strictly validates the complete include graph,
copies it into a private profile- and request-namespaced snapshot, validates the
snapshot again, and executes only from that snapshot. The requested source
identity binds the run to the current Git `HEAD` and all tracked and non-ignored
worktree files.

## Supported flows

The generated client currently permits these standalone flows:

- `restore-success`
- `damaged-backup`
- `picker-cancellation`
- `restore-failure`
- `newer-backup`
- `rollback-failure`
- `storage-failure`
- `share-cancellation`

`select-backup-file` may be included by another flow but cannot be requested
directly. `cross-platform-round-trip` remains excluded because it exchanges
artifacts between runtimes; the existing GitHub Actions workflows own that
test.

## Adding or changing a flow

An ordinary standalone flow becomes requestable without a broker implementation
change when it uses the supported Maestro subset, existing fixtures, and the
profile's default setup:

1. Add or change the graph under `.maestro/e2e/ios/`. Keep its complete include
   graph beneath the configured flow root.
2. Verify the flow through the normal native CI path and review that it stays
   within the existing broker profile's trust boundary.
3. Regenerate `scripts/request-ios-smoke.py` from a normal host terminal:

   ```sh
   /Users/kjetil/code/privat/ios-build-broker/broker.py init-repo "$PWD" --profile trene
   ```

4. Update the supported-flow list in `AGENTS.md` and this document when the
   public set changes.
5. Verify the build and flow from a normal host terminal:

   ```sh
   /Users/kjetil/code/privat/ios-build-broker/broker.py verify-build "$PWD" --profile trene
   /Users/kjetil/code/privat/ios-build-broker/broker.py verify-smoke "$PWD" --profile trene --flow FLOW_NAME
   ```

6. Start the profile-bound broker from a normal host terminal and leave it
   running:

   ```sh
   /Users/kjetil/code/privat/ios-build-broker/broker.py serve "$PWD" --profile trene
   ```

   Then confirm from the Trene agent session that the generated client
   recognizes its heartbeat:

   ```sh
   python3 scripts/request-ios-smoke.py --broker-status
   ```

A flow that needs new fixtures, fault modes, filesystem mutations,
postconditions, secrets, network permissions, host operations, caller-selected
values, or cross-platform artifact exchange is not an ordinary flow addition.
It requires a reviewed change to the broker's `trene` profile, including the
appropriate validation and injection-resistance tests, before regenerating the
client. Confirm that each request uses a disposable simulator and that the
simulator is removed afterward before agents rely on the flow.
