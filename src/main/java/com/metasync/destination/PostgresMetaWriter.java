package com.metasync.destination;

import com.metasync.config.DeleteStrategy;
import com.metasync.config.PromotedColumn;
import com.metasync.config.TableMapping;
import com.metasync.engine.SyncResult;
import com.metasync.engine.TransformedRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Owns the PostgreSQL "meta database": the unified tables mapped data is upserted into, plus a
 * small amount of control-plane state (incremental watermarks, sync run history) needed to make
 * scheduled batch syncs resumable and observable.
 */
public class PostgresMetaWriter {

    private static final Logger log = LoggerFactory.getLogger(PostgresMetaWriter.class);

    private final DataSource dataSource;
    private final String schema;

    public PostgresMetaWriter(DataSource dataSource, String schema) {
        this.dataSource = dataSource;
        this.schema = IdentifierValidator.validateIdentifier(schema, "destination.schema");
    }

    public void ensureControlTablesExist() {
        String ddl = """
                CREATE SCHEMA IF NOT EXISTS %1$s;

                CREATE TABLE IF NOT EXISTS %1$s.sync_state (
                    source_name     TEXT NOT NULL,
                    table_name      TEXT NOT NULL,
                    last_watermark  TEXT,
                    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL,
                    PRIMARY KEY (source_name, table_name)
                );

                CREATE TABLE IF NOT EXISTS %1$s.sync_runs (
                    id              BIGSERIAL PRIMARY KEY,
                    source_name     TEXT NOT NULL,
                    source_table    TEXT NOT NULL,
                    target_table    TEXT NOT NULL,
                    started_at      TIMESTAMP WITH TIME ZONE NOT NULL,
                    finished_at     TIMESTAMP WITH TIME ZONE NOT NULL,
                    success         BOOLEAN NOT NULL,
                    rows_processed  BIGINT NOT NULL,
                    error_message   TEXT
                );
                """.formatted(schema);
        execute(ddl);
        // Added after the initial release; migrated in separately so upgrades don't need a fresh schema.
        execute("ALTER TABLE %1$s.sync_runs ADD COLUMN IF NOT EXISTS rows_deleted BIGINT NOT NULL DEFAULT 0"
                .formatted(schema));
        execute("ALTER TABLE %1$s.sync_runs ADD COLUMN IF NOT EXISTS run_type TEXT NOT NULL DEFAULT 'SYNC'"
                .formatted(schema));
    }

    public void ensureTargetTable(TableMapping mapping) {
        String targetTable = IdentifierValidator.validateIdentifier(mapping.getTargetTable(), "targetTable");

        String ddl = """
                CREATE TABLE IF NOT EXISTS %1$s.%2$s (
                    _source_system  TEXT NOT NULL,
                    _source_table   TEXT NOT NULL,
                    _source_pk      TEXT NOT NULL,
                    _synced_at      TIMESTAMP WITH TIME ZONE NOT NULL,
                    _deleted_at     TIMESTAMP WITH TIME ZONE,
                    data            JSONB NOT NULL,
                    PRIMARY KEY (_source_system, _source_table, _source_pk)
                );
                CREATE INDEX IF NOT EXISTS %2$s_synced_at_idx ON %1$s.%2$s (_synced_at);
                """.formatted(schema, targetTable);
        execute(ddl);
        // Added after the initial release; migrated in separately so upgrades don't need to drop the table.
        execute("ALTER TABLE %1$s.%2$s ADD COLUMN IF NOT EXISTS _deleted_at TIMESTAMP WITH TIME ZONE"
                .formatted(schema, targetTable));
        // A plain (non-partial) index: Postgres's partial-index syntax ("... WHERE _deleted_at IS
        // NULL") isn't portable to every JDBC target this DDL runs against in tests, and a B-tree
        // index over these three columns still serves the exact WHERE clause reconcileDeletes uses.
        execute("CREATE INDEX IF NOT EXISTS %2$s_active_idx ON %1$s.%2$s (_source_system, _source_table, _deleted_at)"
                .formatted(schema, targetTable));
        // _source_pk is only unique WITHIN one source table, so a 2-column (_source_system, _source_pk)
        // primary key lets two different source tables feeding the same target collide on matching PK
        // values. Upgrades an older table created with that narrower key; a no-op once already widened.
        // Run as a single statement (not through execute(), which splits on ';' and would shred this
        // plpgsql body) since schema/targetTable are already-validated identifiers, safely interpolated
        // directly, while the constraint name - genuinely dynamic, read back from the catalog - is
        // quoted at runtime via quote_ident() rather than string-concatenated. Plpgsql DO blocks and
        // information_schema.key_column_usage aren't portable, so this only runs against real Postgres
        // (test doubles like H2 exercise the DDL shape above, not this catalog-introspecting migration).
        if (isRealPostgres()) {
            executeRaw("""
                DO $$
                DECLARE
                    old_constraint TEXT;
                BEGIN
                    SELECT tc.constraint_name INTO old_constraint
                    FROM information_schema.table_constraints tc
                    WHERE tc.table_schema = '%1$s' AND tc.table_name = '%2$s' AND tc.constraint_type = 'PRIMARY KEY'
                      AND NOT EXISTS (
                          SELECT 1 FROM information_schema.key_column_usage kcu
                          WHERE kcu.constraint_schema = tc.constraint_schema
                            AND kcu.constraint_name = tc.constraint_name
                            AND kcu.column_name = '_source_table'
                      );
                    IF old_constraint IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE %1$s.%2$s DROP CONSTRAINT ' || quote_ident(old_constraint);
                        EXECUTE 'ALTER TABLE %1$s.%2$s ADD PRIMARY KEY (_source_system, _source_table, _source_pk)';
                    END IF;
                END $$;
                """.formatted(schema, targetTable));
        }

        for (PromotedColumn promoted : mapping.getPromotedColumns()) {
            String field = IdentifierValidator.validateIdentifier(promoted.getField(),
                    "promotedColumns.field for " + mapping.getTargetTable());
            String sqlType = IdentifierValidator.validateSqlType(promoted.getSqlType(),
                    "promotedColumns[" + field + "] on " + mapping.getTargetTable());
            execute("ALTER TABLE %1$s.%2$s ADD COLUMN IF NOT EXISTS %3$s %4$s"
                    .formatted(schema, targetTable, field, sqlType));
        }
    }

    public Optional<String> getWatermark(String sourceName, String targetTable) {
        String sql = "SELECT last_watermark FROM %1$s.sync_state WHERE source_name = ? AND table_name = ?"
                .formatted(schema);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sourceName);
            ps.setString(2, targetTable);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.ofNullable(rs.getString(1)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new RuntimeException("failed to read watermark for " + sourceName + "/" + targetTable, e);
        }
    }

    public void updateWatermark(String sourceName, String targetTable, String watermark) {
        String sql = """
                INSERT INTO %1$s.sync_state (source_name, table_name, last_watermark, updated_at)
                VALUES (?, ?, ?, now())
                ON CONFLICT (source_name, table_name)
                DO UPDATE SET last_watermark = EXCLUDED.last_watermark, updated_at = EXCLUDED.updated_at
                """.formatted(schema);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sourceName);
            ps.setString(2, targetTable);
            ps.setString(3, watermark);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("failed to persist watermark for " + sourceName + "/" + targetTable, e);
        }
    }

    /** Upserts a batch of already-transformed rows, keyed by (source_system, source_table, source_pk). */
    public void upsertBatch(TableMapping mapping, List<TransformedRow> rows) {
        if (rows.isEmpty()) {
            return;
        }
        String targetTable = IdentifierValidator.validateIdentifier(mapping.getTargetTable(), "targetTable");
        List<PromotedColumn> promotedColumns = mapping.getPromotedColumns();

        List<String> insertColumns = new ArrayList<>(List.of("_source_system", "_source_table", "_source_pk",
                "_synced_at", "data"));
        List<String> valuePlaceholders = new ArrayList<>(List.of("?", "?", "?", "?", "?::jsonb"));
        for (PromotedColumn promoted : promotedColumns) {
            String field = IdentifierValidator.validateIdentifier(promoted.getField(), "promotedColumns.field");
            insertColumns.add(field);
            valuePlaceholders.add("?");
        }

        // Clearing _deleted_at here matters: a row a previous delete-reconciliation pass marked
        // gone should come back to "active" the moment the source produces it again.
        StringBuilder updateClause = new StringBuilder(
                "_synced_at = EXCLUDED._synced_at, _deleted_at = NULL, data = EXCLUDED.data");
        for (PromotedColumn promoted : promotedColumns) {
            updateClause.append(", ").append(promoted.getField()).append(" = EXCLUDED.").append(promoted.getField());
        }

        String sql = ("INSERT INTO %1$s.%2$s (%3$s) VALUES (%4$s) "
                + "ON CONFLICT (_source_system, _source_table, _source_pk) DO UPDATE SET %5$s")
                .formatted(schema, targetTable, String.join(", ", insertColumns),
                        String.join(", ", valuePlaceholders), updateClause);

        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                for (TransformedRow row : rows) {
                    int idx = 1;
                    ps.setString(idx++, row.sourceSystem());
                    ps.setString(idx++, row.sourceTable());
                    ps.setString(idx++, row.sourcePk());
                    ps.setTimestamp(idx++, Timestamp.from(row.syncedAt()));
                    ps.setString(idx++, row.dataJson());
                    for (PromotedColumn promoted : promotedColumns) {
                        ps.setObject(idx++, row.promotedValues().get(promoted.getField()));
                    }
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new RuntimeException("failed to upsert batch into " + targetTable, e);
        }
        log.debug("upserted {} row(s) into {}.{}", rows.size(), schema, targetTable);
    }

    /**
     * Marks (SOFT) or removes (HARD) rows in {@code mapping.getTargetTable()} that came from
     * {@code sourceSystem}/{@code mapping.getSourceTable()} but whose primary key is no longer in
     * {@code currentSourcePks}. Scoped to this exact (source_system, source_table) pair so it never
     * touches rows a *different* mapping contributed into the same target table.
     *
     * @return the number of rows marked/removed
     */
    public long reconcileDeletes(TableMapping mapping, String sourceSystem, Set<String> currentSourcePks,
            DeleteStrategy strategy) {
        String targetTable = IdentifierValidator.validateIdentifier(mapping.getTargetTable(), "targetTable");

        Set<String> staleKeys = new HashSet<>();
        String selectSql = ("SELECT _source_pk FROM %1$s.%2$s "
                + "WHERE _source_system = ? AND _source_table = ? AND _deleted_at IS NULL").formatted(schema,
                targetTable);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(selectSql)) {
            ps.setString(1, sourceSystem);
            ps.setString(2, mapping.getSourceTable());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    staleKeys.add(rs.getString(1));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("failed to read active primary keys for " + targetTable, e);
        }
        staleKeys.removeAll(currentSourcePks);
        if (staleKeys.isEmpty()) {
            return 0;
        }

        String verb = strategy == DeleteStrategy.HARD
                ? "DELETE FROM %1$s.%2$s"
                : "UPDATE %1$s.%2$s SET _deleted_at = now()";
        String sql = (verb + " WHERE _source_system = ? AND _source_table = ? AND _source_pk = ANY(?)")
                .formatted(schema, targetTable);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sourceSystem);
            ps.setString(2, mapping.getSourceTable());
            Array pkArray = conn.createArrayOf("text", staleKeys.toArray());
            ps.setArray(3, pkArray);
            int affected = ps.executeUpdate();
            log.info("delete reconciliation ({}) affected {} row(s) in {}.{}", strategy, affected, schema,
                    targetTable);
            return affected;
        } catch (SQLException e) {
            throw new RuntimeException("failed to reconcile deletes for " + targetTable, e);
        }
    }

    public void recordSyncRun(SyncResult result) {
        String sql = """
                INSERT INTO %1$s.sync_runs
                    (source_name, source_table, target_table, started_at, finished_at, success, rows_processed,
                     rows_deleted, run_type, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """.formatted(schema);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, result.sourceName());
            ps.setString(2, result.sourceTable());
            ps.setString(3, result.targetTable());
            ps.setTimestamp(4, Timestamp.from(result.startedAt()));
            ps.setTimestamp(5, Timestamp.from(result.finishedAt()));
            ps.setBoolean(6, result.success());
            ps.setLong(7, result.rowsProcessed());
            ps.setLong(8, result.rowsDeleted());
            ps.setString(9, result.runType());
            ps.setString(10, result.errorMessage());
            ps.executeUpdate();
        } catch (SQLException e) {
            log.error("failed to record sync run for {}/{}", result.sourceName(), result.sourceTable(), e);
        }
    }

    private boolean isRealPostgres() {
        try (Connection conn = dataSource.getConnection()) {
            return "PostgreSQL".equals(conn.getMetaData().getDatabaseProductName());
        } catch (SQLException e) {
            return false;
        }
    }

    private void execute(String sql) {
        try (Connection conn = dataSource.getConnection(); var statement = conn.createStatement()) {
            for (String stmt : sql.split(";")) {
                String trimmed = stmt.trim();
                if (!trimmed.isEmpty()) {
                    statement.execute(trimmed);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("failed to execute DDL: " + sql, e);
        }
    }

    /** Like {@link #execute}, but runs {@code sql} as a single statement rather than splitting on ';'
     * - required for a plpgsql DO block, whose body legitimately contains its own semicolons. */
    private void executeRaw(String sql) {
        try (Connection conn = dataSource.getConnection(); var statement = conn.createStatement()) {
            statement.execute(sql);
        } catch (SQLException e) {
            throw new RuntimeException("failed to execute DDL: " + sql, e);
        }
    }
}
