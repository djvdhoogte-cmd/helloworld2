package com.metasync.destination;

import com.metasync.config.PromotedColumn;
import com.metasync.config.TableMapping;
import com.metasync.engine.RowTransformer;
import com.metasync.engine.TransformedRow;
import com.metasync.connector.ExtractedRow;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Exercises the ON CONFLICT upsert and watermark-write paths that PostgresMetaWriterTest can't
 * cover under H2. Skipped unless META_SYNC_IT_JDBC_URL points at a real Postgres instance, e.g.:
 *
 * <pre>
 *   META_SYNC_IT_JDBC_URL=jdbc:postgresql://localhost:5432/metadb \
 *   META_SYNC_IT_USER=postgres META_SYNC_IT_PASSWORD= \
 *   mvn test -Dtest=PostgresMetaWriterIntegrationTest
 * </pre>
 */
@EnabledIfEnvironmentVariable(named = "META_SYNC_IT_JDBC_URL", matches = ".+")
class PostgresMetaWriterIntegrationTest {

    private HikariDataSource dataSource;
    private PostgresMetaWriter writer;
    private String schema;

    @BeforeEach
    void setUp() {
        HikariConfig hikariConfig = new HikariConfig();
        hikariConfig.setJdbcUrl(System.getenv("META_SYNC_IT_JDBC_URL"));
        hikariConfig.setUsername(System.getenv().getOrDefault("META_SYNC_IT_USER", "postgres"));
        hikariConfig.setPassword(System.getenv().getOrDefault("META_SYNC_IT_PASSWORD", ""));
        dataSource = new HikariDataSource(hikariConfig);
        schema = "it_" + UUID.randomUUID().toString().replace("-", "");
        writer = new PostgresMetaWriter(dataSource, schema);
    }

    @AfterEach
    void tearDown() throws Exception {
        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            st.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        } finally {
            dataSource.close();
        }
    }

    @Test
    void upsertInsertsThenUpdatesOnConflict() throws Exception {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("SCOTT.ORDERS");
        mapping.setTargetTable("orders");
        mapping.setPrimaryKeyColumns(List.of("order_id"));
        mapping.setColumnMapping(Map.of("order_id", "order_id", "status", "status"));
        PromotedColumn statusColumn = new PromotedColumn();
        statusColumn.setField("status");
        statusColumn.setSqlType("TEXT");
        mapping.setPromotedColumns(List.of(statusColumn));

        writer.ensureControlTablesExist();
        writer.ensureTargetTable(mapping);

        TransformedRow initial = transform(mapping, Map.of("order_id", 1L, "status", "NEW"));
        writer.upsertBatch(mapping, List.of(initial));

        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT status FROM " + schema + ".orders WHERE _source_pk = '1'")) {
            assertTrue(rs.next());
            assertEquals("NEW", rs.getString(1));
        }

        TransformedRow updated = transform(mapping, Map.of("order_id", 1L, "status", "SHIPPED"));
        writer.upsertBatch(mapping, List.of(updated));

        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT status, count(*) OVER () FROM " + schema
                     + ".orders WHERE _source_pk = '1' GROUP BY status")) {
            assertTrue(rs.next());
            assertEquals("SHIPPED", rs.getString(1));
            assertEquals(1, rs.getInt(2), "conflicting row should be updated in place, not duplicated");
        }
    }

    @Test
    void updateWatermarkUpsertsAcrossRuns() {
        writer.ensureControlTablesExist();

        assertEquals(Optional.empty(), writer.getWatermark("orders-oracle", "orders"));

        writer.updateWatermark("orders-oracle", "orders", "100");
        assertEquals(Optional.of("100"), writer.getWatermark("orders-oracle", "orders"));

        writer.updateWatermark("orders-oracle", "orders", "200");
        assertEquals(Optional.of("200"), writer.getWatermark("orders-oracle", "orders"));
    }

    private static TransformedRow transform(TableMapping mapping, Map<String, Object> columns) {
        return RowTransformer.transform(new ExtractedRow(new LinkedHashMap<>(columns)), mapping, "orders-oracle");
    }
}
