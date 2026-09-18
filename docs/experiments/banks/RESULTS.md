# River bank experiment results

This is the frozen headless comparison of the current canon control and two
bank variants. The underlying per-cell records are in
[`validation/`](./validation/), with one 60-game cell for each player count and
variant. Percentages in the tables are rounded; counts and resource totals are
the persisted values.

## Design

Each cell contains 60 paired games using fresh seeds, balanced diverse rosters,
rotated seats, and a 120-round cap. A timeout is reported separately from a
loss. The paired seed and roster index is shared across variants, although
changed event ordering can produce partial RNG divergence after the first
difference. Wilson intervals use the 60-game win count.

`currentCANON` is the v0.5 control. Both bank variants use the fixed bank
starting lane: north farmland and Babel, three south desert river tiles, a
mountain source, and a Beacon at that source. The Host variant changes the
host and movement rules on that fixed map. The Host + Resources variant adds
the resource partition, so the control comparison combines the fixed map,
movement, and host changes while the comparison between the two bank variants
isolates the resource change.

Host-only keeps the tile-wide economy and uses bank routing for hosts. The
Host + Resources variant additionally applies the bank resource rules: a river
placement collects from both banks once per physical tile, with foreign owners
deduplicated; an occupied bank suppresses only that bank's contribution; a
nonriver region is one land region; and a harvester building selects one bank.
The Beacon is preplaced in round 1; the first Host spawn is round 3 for two
players and round 2 for three or four players. Heaven quota and cadence are
unchanged. Combat, Tower, and aura effects remain tile-wide.

## Outcomes

| Players | Variant | Win / loss / timeout | Win rate (Wilson 95%) | Mean winning round | Mean turns, all games | Zero-host games |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 2 | currentCANON | 25 / 31 / 4 | 41.7% (30.1–54.3%) | 50.92 | 97.42 | 7 |
| 2 | bank-hosts | 33 / 15 / 12 | 55.0% (42.5–66.9%) | 53.52 | 132.92 | 0 |
| 2 | bank-hosts-resources | 33 / 16 / 11 | 55.0% (42.5–66.9%) | 64.79 | 142.03 | 0 |
| 3 | currentCANON | 17 / 41 / 2 | 28.3% (18.5–40.8%) | 49.71 | 137.42 | 1 |
| 3 | bank-hosts | 28 / 30 / 2 | 46.7% (34.6–59.1%) | 59.61 | 170.35 | 0 |
| 3 | bank-hosts-resources | 18 / 37 / 5 | 30.0% (19.9–42.5%) | 57.00 | 158.15 | 0 |
| 4 | currentCANON | 36 / 20 / 4 | 60.0% (47.4–71.4%) | 56.92 | 207.65 | 4 |
| 4 | bank-hosts | 33 / 22 / 5 | 55.0% (42.5–66.9%) | 57.67 | 244.88 | 0 |
| 4 | bank-hosts-resources | 14 / 41 / 5 | 23.3% (14.4–35.4%) | 68.14 | 256.23 | 0 |

The across-player-count win-rate spread is 31.7 percentage points for the
canon and Host + Resources cells, and 8.3 points for Host-only. Bank variants
eliminate zero-host games in this sample. Among winning games, mean total
player-turns for Host-only are 106.8, 178.1, and 229.9 for two, three, and
four players; the corresponding Host + Resources values are 129.6, 170.1,
and 271.9.

## Actions and resource access

Action shares are shares of all recorded player actions. The build-harvester
column and the first item in each action-share vector mean the
`buildHarvester` action. `H/turn` is total harvested resource units divided by
total player turns. `Want access` is aggregate satisfied resource wants divided
by aggregate wants.

| Players | Variant | Build-harvester action share | H/turn | Harvest triggers | Placement suppressed (lost-ledger / occupied) | Want access | Bank choices (by region) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2 | currentCANON | 10.8% | 1.228 | 2,609 | 1,114 (1,108 / 6) | 2,572 / 4,037 (63.7%) | — |
| 2 | bank-hosts | 8.7% | 1.429 | 4,143 | 1,252 (1,252 / 0) | 3,607 / 5,095 (70.8%) | 2,071 (0:1,305; 1:763; 2:3) |
| 2 | bank-hosts-resources | 14.4% | 1.328 | 4,086 | 1,420 (1,419 / 1) | 3,731 / 5,621 (66.4%) | 2,205 (0:1,404; 1:801) |
| 3 | currentCANON | 12.5% | 2.040 | 4,207 | 1,465 (1,461 / 4) | 2,637 / 4,172 (63.2%) | — |
| 3 | bank-hosts | 10.0% | 2.289 | 5,679 | 1,606 (1,603 / 3) | 3,088 / 4,398 (70.2%) | 3,684 (0:2,711; 1:969; 2:4) |
| 3 | bank-hosts-resources | 16.2% | 2.088 | 4,985 | 1,631 (1,631 / 0) | 3,025 / 4,536 (66.7%) | 2,728 (0:1,931; 1:797) |
| 4 | currentCANON | 11.6% | 3.150 | 7,592 | 1,873 (1,872 / 1) | 3,485 / 4,942 (70.5%) | — |
| 4 | bank-hosts | 11.1% | 3.255 | 9,114 | 2,021 (2,015 / 6) | 3,671 / 5,034 (72.9%) | 5,651 (0:4,482; 1:1,169) |
| 4 | bank-hosts-resources | 16.5% | 3.017 | 9,172 | 2,165 (2,165 / 0) | 4,169 / 5,692 (73.2%) | 6,393 (0:5,153; 1:1,224; 2:16) |

The full action-share vectors, in the order `harvest / Babel / Tower / attack /
muster / scheme / pass`, are:

| Players | Variant | Action shares |
| ---: | --- | --- |
| 2 | currentCANON | 10.8% / 11.3% / 12.8% / 36.0% / 4.1% / 12.9% / 12.1% |
| 2 | bank-hosts | 8.7% / 9.7% / 14.3% / 40.2% / 3.5% / 17.5% / 6.2% |
| 2 | bank-hosts-resources | 14.4% / 9.1% / 13.2% / 39.3% / 3.2% / 14.7% / 6.1% |
| 3 | currentCANON | 12.5% / 13.1% / 13.6% / 39.2% / 4.9% / 9.6% / 7.1% |
| 3 | bank-hosts | 10.0% / 14.9% / 13.8% / 41.2% / 4.1% / 11.8% / 4.3% |
| 3 | bank-hosts-resources | 16.2% / 12.5% / 13.4% / 39.3% / 4.4% / 9.8% / 4.4% |
| 4 | currentCANON | 11.6% / 15.6% / 12.9% / 39.4% / 4.2% / 10.5% / 5.9% |
| 4 | bank-hosts | 11.1% / 15.9% / 13.8% / 40.1% / 3.9% / 11.1% / 4.1% |
| 4 | bank-hosts-resources | 16.5% / 13.2% / 13.4% / 38.5% / 3.7% / 10.6% / 4.2% |

Bank-choice telemetry counts identified routing choices. Ordinary banked
movement is excluded, and `harvesterBankChoices` was zero in every persisted
summary. The canon has no bank-choice field.

## Resource totals

The vectors below are `food / wood / brick / metal`, summed across all games in
each cell. `Placement`, `Harvest`, and `Barter` are separate sources.

| Players | Variant | Placement | Harvest | Barter |
| ---: | --- | ---: | ---: | ---: |
| 2 | currentCANON | 3,186 / 3,126 / 3,012 / 1,883 | 2,070 / 2,007 / 1,993 / 1,109 | 192 / 757 / 298 / 687 |
| 2 | bank-hosts | 4,816 / 4,522 / 4,740 / 2,871 | 3,550 / 3,024 / 3,386 / 1,440 | 248 / 1,019 / 334 / 1,242 |
| 2 | bank-hosts-resources | 5,163 / 4,794 / 4,637 / 3,241 | 3,244 / 3,071 / 3,179 / 1,823 | 327 / 1,274 / 381 / 952 |
| 3 | currentCANON | 4,631 / 4,719 / 4,398 / 2,901 | 4,543 / 5,285 / 4,520 / 2,473 | 235 / 728 / 226 / 796 |
| 3 | bank-hosts | 6,273 / 6,147 / 5,555 / 3,831 | 7,530 / 6,923 / 5,787 / 3,155 | 248 / 789 / 307 / 1,125 |
| 3 | bank-hosts-resources | 5,770 / 5,568 / 5,047 / 3,426 | 6,042 / 5,670 / 5,302 / 2,799 | 245 / 851 / 241 / 1,030 |
| 4 | currentCANON | 7,843 / 7,916 / 7,112 / 4,879 | 12,094 / 11,620 / 9,691 / 5,839 | 240 / 955 / 314 / 1,201 |
| 4 | bank-hosts | 9,352 / 9,281 / 8,863 / 6,120 | 14,446 / 13,618 / 12,641 / 7,120 | 215 / 998 / 280 / 1,427 |
| 4 | bank-hosts-resources | 10,047 / 9,963 / 8,835 / 6,000 | 14,523 / 12,683 / 12,569 / 6,612 | 284 / 1,155 / 306 / 1,548 |

The corresponding per-player-turn vectors, in the same source and resource
order, are:

| Players | Variant | Placement | Harvest | Barter |
| ---: | --- | ---: | ---: | ---: |
| 2 | currentCANON | 0.545 / 0.535 / 0.515 / 0.322 | 0.354 / 0.343 / 0.341 / 0.190 | 0.033 / 0.130 / 0.051 / 0.118 |
| 2 | bank-hosts | 0.604 / 0.567 / 0.594 / 0.360 | 0.445 / 0.379 / 0.425 / 0.181 | 0.031 / 0.128 / 0.042 / 0.156 |
| 2 | bank-hosts-resources | 0.606 / 0.563 / 0.544 / 0.380 | 0.381 / 0.360 / 0.373 / 0.214 | 0.038 / 0.149 / 0.045 / 0.112 |
| 3 | currentCANON | 0.562 / 0.572 / 0.533 / 0.352 | 0.551 / 0.641 / 0.548 / 0.300 | 0.029 / 0.088 / 0.027 / 0.097 |
| 3 | bank-hosts | 0.614 / 0.601 / 0.543 / 0.375 | 0.737 / 0.677 / 0.566 / 0.309 | 0.024 / 0.077 / 0.030 / 0.110 |
| 3 | bank-hosts-resources | 0.608 / 0.587 / 0.532 / 0.361 | 0.637 / 0.598 / 0.559 / 0.295 | 0.026 / 0.090 / 0.025 / 0.109 |
| 4 | currentCANON | 0.630 / 0.635 / 0.571 / 0.392 | 0.971 / 0.933 / 0.778 / 0.469 | 0.019 / 0.077 / 0.025 / 0.096 |
| 4 | bank-hosts | 0.636 / 0.632 / 0.603 / 0.417 | 0.983 / 0.927 / 0.860 / 0.485 | 0.015 / 0.068 / 0.019 / 0.097 |
| 4 | bank-hosts-resources | 0.654 / 0.648 / 0.575 / 0.390 | 0.945 / 0.825 / 0.818 / 0.430 | 0.018 / 0.075 / 0.020 / 0.101 |

The Host-only runs build harvesters less often than the resource variant while
still producing more harvested units per turn than the canon control. The
resource variant builds harvesters more often and shows lower shared resource
access in the two-player cell. These observations support the hypothesis of
more harvester building and less shared income, but they do not establish a
causal explanation for every loss.

## Interpretation and limits

The Host-only result is the strongest prototype candidate: it narrows the
win-rate spread on this fixed map while keeping the resource model closer to
the control. Keep the current tile-wide resource features for the next
prototype. The banked-resource variant remains a future experiment; do not
adopt it into canon automatically. Collecting both river banks once per
physical tile is coherent, but the extra resource partition did not improve
this model's balance in these cells.

The balanced paired arms share the same roster index, but the AI's roster
response limits interpretation. In the Host-only two-player cell, games with
the Merchant roster were 1 win, 12 losses, and 11 timeouts out of 24; games
without Merchant were 32 wins, 3 losses, and 1 timeout out of 36. The AI
strategy and game length also need further work before these rates can be read
as human win probabilities.

These are headless experiment results and do not change the canon or the UI.
The p4 resource cell was completed through absolute-index shards (indices
44–59) and validated merging, preserving single-process seed and roster
semantics. Canon replay checks matched the six saved validation fixtures, and
the six frozen Host recheck games matched their authoritative records.

Reproduce the authoritative cells with:

```sh
npm run banks -- --games 60 --players all \
  --seed-prefix banks-20260918-validation \
  --variants currentCANON,bank-hosts,bank-hosts-resources \
  --roster-mode diverse --output ./tmp/banks-reproduce
```

Shard details are in the [harness README](./README.md). Final repository
validation passed 401 tests, TypeScript checking, and the production build.
