package com.metasync.connector;

import com.metasync.config.SourceConfig;
import com.metasync.config.TableMapping;
import com.metasync.connector.dialect.DialectFactory;
import com.metasync.connector.dialect.SourceDialect;
import com.metasync.engine.RowTransformer;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

public class JdbcSourceConnector implements SourceConnector {

    private static final Logger log = LoggerFactory.getLogger(JdbcSourceConnector.class);

    private final SourceConfig sourceConfig;
    private final SourceDialect dialect;
    private final HikariDataSource dataSource;

    public JdbcSourceConnector(SourceConfig sourceConfig) {
        this.sourceConfig = sourceConfig;
        this.dialect = DialectFactory.forType(sourceConfig.getType());

        HikariConfig hikariConfig = new HikariConfig();
        hikariConfig.setJdbcUrl(sourceConfig.getJdbcUrl());
        hikariConfig.setUsername(sourceConfig.getUsername());
        hikariConfig.setPassword(sourceConfig.getPassword());
        hikariConfig.setPoolName("meta-sync-source-" + sourceConfig.getName());
        hikariConfig.setMaximumPoolSize(3);
        hikariConfig.setReadOnly(true);
        sourceConfig.getProperties().forEach(hikariConfig::addDataSourceProperty);
        this.dataSource = new HikariDataSource(hikariConfig);
    }

    @Override
    public String sourceName() {
        return sourceConfig.getName();
    }

    @Override
    public String extract(TableMapping mapping, String sinceWatermark, Consumer<ExtractedRow> rowHandler)
            throws Exception {
        boolean incremental = mapping.isIncremental();
        boolean bindWatermark = incremental && sinceWatermark != null;
        String sql = buildSelectSql(mapping, bindWatermark);
        log.debug("[{}] extracting {} -> {}: {}", sourceConfig.getName(), mapping.getSourceTable(),
                mapping.getTargetTable(), sql);

        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY,
                    ResultSet.CONCUR_READ_ONLY)) {
                dialect.configureForStreaming(ps, mapping.getFetchSize());
                if (bindWatermark) {
                    ps.setObject(1, WatermarkCodec.decode(sinceWatermark));
                }

                Object maxWatermark = null;
                long rowCount = 0;
                try (ResultSet rs = ps.executeQuery()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    int columnCount = meta.getColumnCount();
                    String[] columnNames = new String[columnCount];
                    for (int i = 1; i <= columnCount; i++) {
                        columnNames[i - 1] = meta.getColumnLabel(i).toLowerCase();
                    }
                    String watermarkKey = incremental ? mapping.getWatermarkColumn().toLowerCase() : null;

                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>(columnCount * 2);
                        for (int i = 1; i <= columnCount; i++) {
                            row.put(columnNames[i - 1], dialect.readValue(rs, meta, i));
                        }
                        rowHandler.accept(new ExtractedRow(row));
                        rowCount++;
                        if (watermarkKey != null) {
                            Object wm = row.get(watermarkKey);
                            if (wm != null) {
                                maxWatermark = wm;
                            }
                        }
                    }
                }
                conn.commit();
                log.info("[{}] read {} row(s) from {}", sourceConfig.getName(), rowCount, mapping.getSourceTable());
                return incremental ? WatermarkCodec.encode(maxWatermark) : null;
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        }
    }

    @Override
    public Set<String> fetchAllPrimaryKeys(TableMapping mapping) throws Exception {
        String sql = buildPrimaryKeySql(mapping);
        log.debug("[{}] fetching primary keys for {}: {}", sourceConfig.getName(), mapping.getSourceTable(), sql);

        Set<String> primaryKeys = new HashSet<>();
        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(sql, ResultSet.TYPE_FORWARD_ONLY,
                    ResultSet.CONCUR_READ_ONLY)) {
                dialect.configureForStreaming(ps, mapping.getFetchSize());
                try (ResultSet rs = ps.executeQuery()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    int columnCount = meta.getColumnCount();
                    String[] columnNames = new String[columnCount];
                    for (int i = 1; i <= columnCount; i++) {
                        columnNames[i - 1] = meta.getColumnLabel(i).toLowerCase();
                    }
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>(columnCount * 2);
                        for (int i = 1; i <= columnCount; i++) {
                            row.put(columnNames[i - 1], dialect.readValue(rs, meta, i));
                        }
                        primaryKeys.add(
                                RowTransformer.buildSourcePrimaryKey(new ExtractedRow(row), mapping.getPrimaryKeyColumns()));
                    }
                }
                conn.commit();
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        }
        log.info("[{}] fetched {} primary key(s) from {}", sourceConfig.getName(), primaryKeys.size(),
                mapping.getSourceTable());
        return primaryKeys;
    }

    private String buildPrimaryKeySql(TableMapping mapping) {
        String columns = String.join(", ", mapping.getPrimaryKeyColumns());
        StringBuilder sql = new StringBuilder("SELECT ").append(columns).append(" FROM ")
                .append(mapping.getSourceTable());
        if (mapping.getWhereClause() != null && !mapping.getWhereClause().isBlank()) {
            sql.append(" WHERE (").append(mapping.getWhereClause()).append(")");
        }
        return sql.toString();
    }

    private String buildSelectSql(TableMapping mapping, boolean bindWatermark) {
        String columns = mapping.isIncludeUnmappedColumns() ? "*" : explicitColumnList(mapping);
        StringBuilder sql = new StringBuilder("SELECT ")
                .append(columns)
                .append(" FROM ")
                .append(mapping.getSourceTable());

        List<String> conditions = new ArrayList<>();
        if (bindWatermark) {
            conditions.add(mapping.getWatermarkColumn() + " > ?");
        }
        if (mapping.getWhereClause() != null && !mapping.getWhereClause().isBlank()) {
            conditions.add("(" + mapping.getWhereClause() + ")");
        }
        if (!conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", conditions));
        }
        if (mapping.isIncremental()) {
            sql.append(" ORDER BY ").append(mapping.getWatermarkColumn()).append(" ASC");
        }
        return sql.toString();
    }

    private String explicitColumnList(TableMapping mapping) {
        Set<String> columns = new LinkedHashSet<>(mapping.getPrimaryKeyColumns());
        columns.addAll(mapping.getColumnMapping().keySet());
        if (mapping.isIncremental()) {
            columns.add(mapping.getWatermarkColumn());
        }
        return String.join(", ", columns);
    }

    @Override
    public void close() {
        dataSource.close();
    }
}
