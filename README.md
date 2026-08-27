# meta-db-sync

A scheduled batch sync tool that pulls data from multiple, heterogeneous database sources and
maps it into a single unified PostgreSQL "meta database". Built to handle legacy enterprise
sources - Progress OpenEdge 11+ and Oracle 19c - alongside anything else reachable over JDBC.

## How it works

```
 ┌─────────────────┐        ┌──────────────────┐        ┌───────────────────────────┐
 │ Oracle 19        │─┐      │                  │        │  PostgreSQL meta database │
 │ (SCOTT.ORDERS…)  │ │      │   SyncEngine      │        │                            │
 └─────────────────┘ ├─────▶│  extract → map →  │───────▶│  orders, customers,       │
 ┌─────────────────┐ │      │  upsert (batched)  │        │  inventory_items, …       │
 │ Progress OpenEdge│─┘      │                  │        │  + sync_state/sync_runs   │
 │ (PUB.Item…)      │        └──────────────────┘        └───────────────────────────┘
 └─────────────────┘
```

Each source table is mapped, on its own schedule, into a target table in Postgres. Every target
table gets:

- `_source_system`, `_source_table`, `_source_pk`, `_synced_at` - provenance/audit columns
- `data JSONB` - the full mapped row, so heterogeneous source schemas are captured without loss
- optional **promoted columns** - specific fields also materialized as real, typed, indexable
  Postgres columns for fast querying

Rows are upserted on `(_source_system, _source_pk)`, so re-running a sync is always safe. Table
mappings with a `watermarkColumn` (e.g. a last-modified timestamp) sync incrementally: only rows
that changed since the last successful run are pulled, and the watermark is persisted in a
`sync_state` control table. Every run - success or failure - is recorded in `sync_runs` for
observability.

## Requirements

- Java 17+
- Maven 3.6+
- A PostgreSQL instance to act as the meta database
- Network access to your source databases
- For Oracle: nothing extra - the official `ojdbc11` driver is pulled from Maven Central
- For Progress OpenEdge: the vendor JDBC driver, installed separately - see
  [`docs/openedge-driver.md`](docs/openedge-driver.md)

## Build

```bash
mvn -q package
```

This produces a single runnable jar at `target/meta-db-sync.jar` with all dependencies bundled
(via the shade plugin).

## Configure

Copy [`config/example-sync.yaml`](config/example-sync.yaml) and adjust it for your sources and
destination. The file supports `${ENV_VAR}` / `${ENV_VAR:default}` placeholders resolved from the
environment, so credentials never need to be committed:

```bash
export META_DB_HOST=localhost META_DB_USER=meta_user META_DB_PASSWORD=secret
export ORACLE_HOST=oracle.internal ORACLE_SERVICE=ORCLPDB1 ORACLE_USER=app_user ORACLE_PASSWORD=secret
export OPENEDGE_HOST=oe.internal OPENEDGE_DB=sports2000 OPENEDGE_USER=oeuser OPENEDGE_PASSWORD=secret
```

## Run

Run every configured table mapping once and exit (useful for testing a config, or for driving the
tool from an external scheduler like cron/Airflow instead of its built-in one):

```bash
java -jar target/meta-db-sync.jar --config config/example-sync.yaml --once
```

Run continuously, syncing each source/table on its own configured `cron` or `intervalSeconds`
schedule until stopped (Ctrl+C / SIGTERM):

```bash
java -jar target/meta-db-sync.jar --config config/example-sync.yaml
```

Restrict a run to specific sources:

```bash
java -jar target/meta-db-sync.jar --config config/example-sync.yaml --once --source orders-oracle
```

## Adding a new source type

1. Add a new value to `SourceType` (`src/main/java/com/metasync/config/SourceType.java`).
2. Add a Maven dependency for its JDBC driver.
3. Implement `SourceDialect` (`src/main/java/com/metasync/connector/dialect/`) for any
   vendor-specific type normalization it needs, and register it in `DialectFactory`.
4. That's it - `JdbcSourceConnector` and the sync engine are already driver-agnostic.

## Project layout

```
src/main/java/com/metasync/
  config/      YAML config model + loader (env-var substitution, validation)
  connector/   JDBC extraction: streaming, watermark handling, per-source connection pools
    dialect/   Per-database-vendor type normalization (Oracle, OpenEdge, generic JDBC)
  engine/      Row transformation (source columns -> unified JSON) + sync orchestration
  destination/ PostgreSQL meta database writer: DDL, batched upserts, watermark/run tracking
  scheduler/   Cron/interval-based scheduling of each source/table mapping
  cli/         Command-line entry point (picocli)
```

## Testing

```bash
mvn -q test
```

Unit tests cover config parsing/validation, row transformation, and dialect type normalization
without any database. `PostgresMetaWriter`'s schema DDL and control-table logic (watermark reads,
sync run history) are exercised against an in-memory H2 database running in PostgreSQL-compatibility
mode. H2 doesn't implement `ON CONFLICT`, so the batched-upsert and watermark-write paths that rely
on it aren't covered by these tests - verify those against a real PostgreSQL instance (e.g.
`--once` against a local Postgres) before relying on them in production.
