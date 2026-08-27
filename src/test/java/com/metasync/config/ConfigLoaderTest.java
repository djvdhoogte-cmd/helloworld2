package com.metasync.config;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConfigLoaderTest {

    private static final String YAML = """
            destination:
              jdbcUrl: jdbc:postgresql://${META_DB_HOST}:5432/metadb
              username: meta_user
              password: ${META_DB_PASSWORD}
              schema: ${META_DB_SCHEMA:public}

            sources:
              - name: orders-oracle
                type: ORACLE
                jdbcUrl: jdbc:oracle:thin:@//oracle-host:1521/ORCLPDB1
                username: app_user
                password: secret
                schedule:
                  cron: "*/15 * * * *"
                tables:
                  - sourceTable: SCOTT.ORDERS
                    targetTable: orders
                    primaryKeyColumns: [ORDER_ID]
                    watermarkColumn: LAST_MODIFIED
                    columnMapping:
                      ORDER_ID: order_id
                      STATUS: status
                    promotedColumns:
                      - field: status
                        sqlType: TEXT
              - name: inventory-openedge
                type: OPENEDGE
                jdbcUrl: jdbc:datadirect:openedge://oe-host:2510;databaseName=sports2000
                username: oeuser
                password: secret
                schedule:
                  intervalSeconds: 900
                tables:
                  - sourceTable: PUB.Item
                    targetTable: inventory_items
                    primaryKeyColumns: [ItemNum]
            """;

    @Test
    void resolvesEnvVarPlaceholdersAndParsesSources() {
        ConfigLoader loader = new ConfigLoader(name -> switch (name) {
            case "META_DB_HOST" -> "meta.internal";
            case "META_DB_PASSWORD" -> "s3cret";
            default -> null;
        });

        AppConfig config = loader.loadFromString(YAML);

        assertEquals("jdbc:postgresql://meta.internal:5432/metadb", config.getDestination().getJdbcUrl());
        assertEquals("s3cret", config.getDestination().getPassword());
        assertEquals("public", config.getDestination().getSchema());

        assertEquals(2, config.getSources().size());
        SourceConfig oracle = config.getSources().get(0);
        assertEquals(SourceType.ORACLE, oracle.getType());
        assertTrue(oracle.getSchedule().isCronBased());
        assertEquals(1, oracle.getTables().size());
        TableMapping ordersMapping = oracle.getTables().get(0);
        assertTrue(ordersMapping.isIncremental());
        assertEquals(Map.of("ORDER_ID", "order_id", "STATUS", "status"), ordersMapping.getColumnMapping());
        assertEquals(1, ordersMapping.getPromotedColumns().size());

        SourceConfig openEdge = config.getSources().get(1);
        assertEquals(SourceType.OPENEDGE, openEdge.getType());
        assertEquals(900L, openEdge.getSchedule().getIntervalSeconds());
        assertTrue(!openEdge.getTables().get(0).isIncremental());
    }

    @Test
    void missingEnvVarWithoutDefaultFailsFast() {
        ConfigLoader loader = new ConfigLoader(name -> null);
        assertThrows(IllegalArgumentException.class, () -> loader.loadFromString(YAML));
    }

    @Test
    void invalidConfigFailsValidation() {
        ConfigLoader loader = new ConfigLoader(name -> "x");
        String badYaml = """
                destination:
                  jdbcUrl: jdbc:postgresql://x:5432/metadb
                sources: []
                """;
        assertThrows(IllegalArgumentException.class, () -> loader.loadFromString(badYaml));
    }
}
