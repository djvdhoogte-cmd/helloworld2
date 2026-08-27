package com.metasync.destination;

import com.metasync.config.PromotedColumn;
import com.metasync.config.TableMapping;
import com.metasync.engine.SyncResult;
import com.metasync.engine.TransformedRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
    }

    public void ensureTargetTable(TableMapping mapping) {
        String targetTable = IdentifierValidator.validateIdentifier(mapping.getTargetTable(), "targetTable");

        String ddl = """
                CREATE TABLE IF NOT EXISTS %1$s.%2$s (
                    _source_system  TEXT NOT NULL,
                    _source_table   TEXT NOT NULL,
                    _source_pk      TEXT NOT NULL,
                    _synced_at      TIMESTAMP WITH TIME ZONE NOT NULL,
                    data            JSONB NOT NULL,
                    PRIMARY KEY (_source_system, _source_pk)
                );
                CREATE INDEX IF NOT EXISTS %2$s_synced_at_idx ON %1$s.%2$s (_synced_at);
                """.formatted(schema, targetTable);
        execute(ddl);

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

    /** Upserts a batch of already-transformed rows, keyed by (source_system, source_pk). */
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

        StringBuilder updateClause = new StringBuilder(
                "_source_table = EXCLUDED._source_table, _synced_at = EXCLUDED._synced_at, data = EXCLUDED.data");
        for (PromotedColumn promoted : promotedColumns) {
            updateClause.append(", ").append(promoted.getField()).append(" = EXCLUDED.").append(promoted.getField());
        }

        String sql = "INSERT INTO %1$s.%2$s (%3$s) VALUES (%4$s) ON CONFLICT (_source_system, _source_pk) DO UPDATE SET %5$s"
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

    public void recordSyncRun(SyncResult result) {
        String sql = """
                INSERT INTO %1$s.sync_runs
                    (source_name, source_table, target_table, started_at, finished_at, success, rows_processed, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            ps.setString(8, result.errorMessage());
            ps.executeUpdate();
        } catch (SQLException e) {
            log.error("failed to record sync run for {}/{}", result.sourceName(), result.sourceTable(), e);
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
}
