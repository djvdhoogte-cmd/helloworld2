package com.metasync.destination;

import com.metasync.config.PromotedColumn;
import com.metasync.config.TableMapping;
import com.metasync.engine.SyncResult;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises PostgresMetaWriter's DDL and control-table logic against an in-memory H2 database
 * running in PostgreSQL-compatibility mode (JSONB columns and {@code ::cast} syntax both work
 * under H2's PostgreSQL mode). H2 does not implement {@code ON CONFLICT}, so the upsert/watermark
 * write paths that rely on it are not covered here - see docs for running those against a real
 * Postgres instance.
 */
class PostgresMetaWriterTest {

    private JdbcDataSource dataSource;
    private PostgresMetaWriter writer;

    @BeforeEach
    void setUp() {
        dataSource = new JdbcDataSource();
        // A unique DB name per test keeps them isolated from each other.
        dataSource.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        writer = new PostgresMetaWriter(dataSource, "public");
    }

    @Test
    void ensureControlTablesExistIsIdempotent() throws Exception {
        writer.ensureControlTablesExist();
        writer.ensureControlTablesExist();

        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            st.execute("SELECT count(*) FROM public.sync_state");
            st.execute("SELECT count(*) FROM public.sync_runs");
        }
    }

    @Test
    void ensureTargetTableCreatesBaseColumnsAndPromotedColumns() throws Exception {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("SCOTT.ORDERS");
        mapping.setTargetTable("orders");
        mapping.setPrimaryKeyColumns(List.of("order_id"));
        PromotedColumn status = new PromotedColumn();
        status.setField("status");
        status.setSqlType("TEXT");
        mapping.setPromotedColumns(List.of(status));

        writer.ensureTargetTable(mapping);
        writer.ensureTargetTable(mapping); // idempotent

        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT _source_system, _source_table, _source_pk, _synced_at, data, "
                     + "status FROM public.orders")) {
            assertEquals(6, rs.getMetaData().getColumnCount());
        }
    }

    @Test
    void ensureTargetTableRejectsInvalidPromotedColumnType() {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("x");
        mapping.setTargetTable("y");
        mapping.setPrimaryKeyColumns(List.of("id"));
        PromotedColumn bad = new PromotedColumn();
        bad.setField("id");
        bad.setSqlType("TEXT); DROP TABLE y; --");
        mapping.setPromotedColumns(List.of(bad));

        assertThrows(IllegalArgumentException.class, () -> writer.ensureTargetTable(mapping));
    }

    @Test
    void getWatermarkReturnsEmptyWhenNoStateRecorded() {
        writer.ensureControlTablesExist();
        Optional<String> watermark = writer.getWatermark("orders-oracle", "orders");
        assertTrue(watermark.isEmpty());
    }

    @Test
    void getWatermarkReadsPersistedValue() throws Exception {
        writer.ensureControlTablesExist();
        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            st.execute("INSERT INTO public.sync_state (source_name, table_name, last_watermark, updated_at) "
                    + "VALUES ('orders-oracle', 'orders', '2026-01-01 00:00:00.0', now())");
        }

        Optional<String> watermark = writer.getWatermark("orders-oracle", "orders");
        assertEquals(Optional.of("2026-01-01 00:00:00.0"), watermark);
    }

    @Test
    void recordSyncRunInsertsSuccessAndFailureRows() throws Exception {
        writer.ensureControlTablesExist();
        Instant start = Instant.now();
        Instant end = start.plusSeconds(1);

        writer.recordSyncRun(SyncResult.success("orders-oracle", "SCOTT.ORDERS", "orders", 10, start, end));
        writer.recordSyncRun(SyncResult.failure("orders-oracle", "SCOTT.ORDERS", "orders", start, end, "boom"));

        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT success, rows_processed, error_message FROM public.sync_runs "
                     + "ORDER BY id")) {
            assertTrue(rs.next());
            assertTrue(rs.getBoolean(1));
            assertEquals(10, rs.getLong(2));

            assertTrue(rs.next());
            assertTrue(!rs.getBoolean(1));
            assertEquals("boom", rs.getString(3));
        }
    }
}
