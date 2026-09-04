package com.metasync.connector;

import com.metasync.config.SourceConfig;
import com.metasync.config.SourceType;
import com.metasync.config.TableMapping;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Exercises JdbcSourceConnector end-to-end against a real (in-memory H2) database, using
 * SourceType.GENERIC so no vendor driver/type-normalization quirks are involved - this is testing
 * the streaming extraction, watermark filtering, and primary-key-scan SQL itself, not a dialect.
 */
class JdbcSourceConnectorTest {

    private String jdbcUrl;

    @BeforeEach
    void setUp() throws Exception {
        jdbcUrl = "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1";
        try (Connection conn = DriverManager.getConnection(jdbcUrl, "sa", "");
             Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE items (id BIGINT PRIMARY KEY, name VARCHAR(100), updated_at TIMESTAMP)");
            st.execute("INSERT INTO items VALUES (1, 'a', '2024-01-01 00:00:00')");
            st.execute("INSERT INTO items VALUES (2, 'b', '2024-01-02 00:00:00')");
        }
    }

    private SourceConnector newConnector() {
        SourceConfig config = new SourceConfig();
        config.setName("test-src");
        config.setType(SourceType.GENERIC);
        config.setJdbcUrl(jdbcUrl);
        config.setUsername("sa");
        config.setPassword("");
        return new JdbcSourceConnector(config);
    }

    private static TableMapping mapping(String watermarkColumn) {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("items");
        mapping.setTargetTable("items");
        mapping.setPrimaryKeyColumns(List.of("id"));
        mapping.setColumnMapping(Map.of());
        mapping.setWatermarkColumn(watermarkColumn);
        return mapping;
    }

    @Test
    void extractsAllRowsWhenNotIncremental() throws Exception {
        try (SourceConnector connector = newConnector()) {
            List<ExtractedRow> rows = new ArrayList<>();
            String watermark = connector.extract(mapping(null), null, rows::add);

            assertEquals(2, rows.size());
            assertNull(watermark);
        }
    }

    @Test
    void incrementalExtractOnlyReturnsRowsAfterWatermark() throws Exception {
        try (SourceConnector connector = newConnector()) {
            List<ExtractedRow> rows = new ArrayList<>();
            String watermark = connector.extract(mapping("updated_at"), "2024-01-01 12:00:00.0", rows::add);

            assertEquals(1, rows.size());
            assertEquals(2L, rows.get(0).get("id"));
            assertNotNull(watermark);
        }
    }

    @Test
    void fetchAllPrimaryKeysReturnsAKeyForEveryLiveRow() throws Exception {
        try (SourceConnector connector = newConnector()) {
            Set<String> pks = connector.fetchAllPrimaryKeys(mapping(null));

            assertEquals(Set.of("1", "2"), pks);
        }
    }
}
