# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`meta-db-sync`: a scheduled batch sync tool (Java 17, Maven) that pulls data from multiple
heterogeneous database sources (Progress OpenEdge 11+, Oracle 19c, or any generic JDBC source) and
maps it into a single unified PostgreSQL "meta database". See `README.md` for the full pitch,
config reference, and ASCII architecture diagram.

## Commands

```bash
mvn -q package        # build; produces target/meta-db-sync.jar (shaded/fat jar) via maven-shade-plugin
mvn -q test            # run all unit tests
mvn -q test -Dtest=RowTransformerTest          # run a single test class
mvn -q test -Dtest=RowTransformerTest#methodName  # run a single test method
```

Run the built jar:

```bash
java -jar target/meta-db-sync.jar --config config/example-sync.yaml --once   # run all mappings once and exit
java -jar target/meta-db-sync.jar --config config/example-sync.yaml           # run continuously on configured schedules
java -jar target/meta-db-sync.jar --config config/example-sync.yaml --once --source orders-oracle  # restrict to one source
```

`config/example-sync.yaml` supports `${ENV_VAR}` / `${ENV_VAR:default}` placeholders resolved
against the environment before parsing (see `ConfigLoader`), so a real run needs the referenced
env vars exported (destination DB creds, source DB creds) — see README's "Configure" section.

One integration test (`PostgresMetaWriterIntegrationTest`) is skipped unless
`META_SYNC_IT_JDBC_URL` (and optionally `META_SYNC_IT_USER`/`META_SYNC_IT_PASSWORD`) point at a
real PostgreSQL instance — the rest of the suite runs against H2 or with no DB at all.

## Architecture

Package layout under `src/main/java/com/metasync/`:

- `config/` — YAML config model (`AppConfig`, `SourceConfig`, `TableMapping`, `PromotedColumn`,
  `ScheduleConfig`) + `ConfigLoader` (env-var substitution, then Jackson YAML parsing, then
  `AppConfig.validate()`).
- `connector/` — JDBC extraction. `JdbcSourceConnector` streams rows from a source table
  (forward-only `ResultSet`, per-source HikariCP pool, read-only) via a `Consumer<ExtractedRow>`
  callback so rows are never fully materialized in memory; it also builds the `SELECT` (optionally
  filtered by `watermarkColumn > ?` and/or a config-supplied `whereClause`) and tracks the max
  watermark seen.
  - `dialect/` — per-vendor type normalization behind `SourceDialect`, selected by
    `DialectFactory.forType(SourceType)`. `OracleDialect` and `OpenEdgeDialect` implement
    vendor-specific `readValue`/streaming setup; `GenericDialect` is the JDBC-standard fallback.
- `engine/` — `SyncEngine.runOnce(connector, mapping)` is the orchestrator for one (source, table
  mapping) sync: ensure target table exists → read watermark (if incremental) → extract in
  batches of `BATCH_SIZE=500`, transforming each row via `RowTransformer` and upserting each full
  batch → persist new watermark → record a `SyncResult` via `writer.recordSyncRun`, success or
  failure. `RowTransformer` maps source columns to target JSON fields per `columnMapping`,
  optionally folds in unmapped source columns (`includeUnmappedColumns`), and builds the composite
  `_source_pk` string by joining `primaryKeyColumns` with an ASCII unit-separator character.
- `destination/` — `PostgresMetaWriter` owns all DDL/DML against the Postgres meta database: creates
  control tables (`sync_state` for watermarks, `sync_runs` for run history) and per-mapping target
  tables (fixed columns `_source_system`, `_source_table`, `_source_pk`, `_synced_at`, `data JSONB`,
  plus any `promotedColumns`), and does batched `INSERT ... ON CONFLICT (_source_system,
  _source_pk) DO UPDATE` upserts. Because table/column/type identifiers come from config and must
  be interpolated directly into SQL text (JDBC can't parameterize identifiers), every identifier
  and SQL type is passed through `IdentifierValidator` (regex allowlist + a fixed set of allowed
  base SQL types) before being used in DDL/DML — never add string-built SQL here without going
  through it.
- `scheduler/` — `SyncScheduler` runs each (source, table mapping) job on its own cron
  (`cron-utils`, UNIX 5-field) or fixed-interval (`intervalSeconds`) schedule via a
  `ScheduledExecutorService`; cron jobs manually reschedule themselves after each run based on
  `ExecutionTime.nextExecution`.
- `cli/` — `MetaSyncCli` (picocli) is the entry point: loads config, builds the destination
  HikariCP pool and one `JdbcSourceConnector` per source, then either runs every mapping once
  (`--once`) or hands off to `SyncScheduler` and blocks until SIGTERM/Ctrl+C.

### Data flow

Extraction and transformation are strictly separated: `JdbcSourceConnector` only knows JDBC/SQL,
`RowTransformer` only knows how to turn an `ExtractedRow` + `TableMapping` into a `TransformedRow`,
and `PostgresMetaWriter` only knows Postgres DDL/DML. `SyncEngine` is the only class that wires all
three together for a given sync.

### Adding a new source type

Documented in the README's "Adding a new source type" section: add a `SourceType` enum value, add
its JDBC driver as a Maven dependency, implement `SourceDialect` for it under `connector/dialect/`
and register it in `DialectFactory`. `JdbcSourceConnector` and `SyncEngine` are already
driver-agnostic and need no changes.

### Testing notes

Unit tests cover config parsing/validation, row transformation, and dialect type normalization
without a database. `PostgresMetaWriterTest` exercises `PostgresMetaWriter`'s DDL and control-table
logic against an in-memory H2 database in PostgreSQL-compatibility mode — but H2 doesn't implement
`ON CONFLICT`, so the batched-upsert and watermark-write paths aren't covered there; those are
covered only by `PostgresMetaWriterIntegrationTest` against a real Postgres (see Commands above).
