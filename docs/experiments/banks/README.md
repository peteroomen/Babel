# River bank experiment harness

The completed comparison is reported in [RESULTS.md](./RESULTS.md).

Run the bounded comparison with:

```sh
npm run banks -- --games 60 --players all \
  --seed-prefix banks --variants currentCANON,bank-hosts,bank-hosts-resources \
  --roster-mode diverse --output ./tmp/banks
```

The CLI runs the current canon v0.5 control plus the two bank variants. Bank
variants use the core's fixed starting lane: north farmland and Babel, three
desert river tiles to the south, a mountain source at the end, and a Beacon at
that source. Heaven counts and cadence come from the current canon rules.

`--players` accepts `2`, `3`, `4`, a comma list, or `all`. `--roster-mode
diverse` (the default) cycles every balanced archetype combination and rotates
the seats; `fixed` keeps the historical roster. `--games` is the number of
paired seeds per variant and player count. `--variants` accepts comma separated
variant ids. `--start-index N` runs the `--games K` shard beginning at absolute
seed/roster index `N`; this preserves the results of an unsharded run and is
recorded in each cell file.

To merge shards for one cell, pass their cell JSON files in comma-separated
order (the CLI sorts by the recorded absolute index and requires a unique,
contiguous range beginning at zero):

```sh
npm run banks -- --merge-inputs ./shard0/p4-bank-hosts-resources.json,./shard1/p4-bank-hosts-resources.json \
  --output ./tmp/banks-merged
```

Each cell is persisted after every game as `pN-<variant>.json`; its summary is
also written to `summary-pN-<variant>.json`, so parallel cells do not overwrite
one another. The harness is headless and uses `playGame` with the same AI as the
application. It records optional bank choice telemetry only when event fields
identify an actual choice; ordinary banked movement is not counted as a choice.
