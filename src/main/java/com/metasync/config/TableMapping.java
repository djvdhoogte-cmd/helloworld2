package com.metasync.config;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class TableMapping {

    private String sourceTable;
    private String targetTable;
    private List<String> primaryKeyColumns;
    private String watermarkColumn;
    private String whereClause;
    private int fetchSize = 500;

    /** source column name (case-insensitive) -> unified field name used as a key in the target's JSONB data. */
    private Map<String, String> columnMapping = new LinkedHashMap<>();

    /** If true, source columns not present in columnMapping are still copied into data, keyed by their own name. */
    private boolean includeUnmappedColumns = true;

    private List<PromotedColumn> promotedColumns = List.of();

    public String getSourceTable() {
        return sourceTable;
    }

    public void setSourceTable(String sourceTable) {
        this.sourceTable = sourceTable;
    }

    public String getTargetTable() {
        return targetTable;
    }

    public void setTargetTable(String targetTable) {
        this.targetTable = targetTable;
    }

    public List<String> getPrimaryKeyColumns() {
        return primaryKeyColumns;
    }

    public void setPrimaryKeyColumns(List<String> primaryKeyColumns) {
        this.primaryKeyColumns = primaryKeyColumns;
    }

    public String getWatermarkColumn() {
        return watermarkColumn;
    }

    public void setWatermarkColumn(String watermarkColumn) {
        this.watermarkColumn = watermarkColumn;
    }

    public boolean isIncremental() {
        return watermarkColumn != null && !watermarkColumn.isBlank();
    }

    public String getWhereClause() {
        return whereClause;
    }

    public void setWhereClause(String whereClause) {
        this.whereClause = whereClause;
    }

    public int getFetchSize() {
        return fetchSize;
    }

    public void setFetchSize(int fetchSize) {
        this.fetchSize = fetchSize;
    }

    public Map<String, String> getColumnMapping() {
        return columnMapping;
    }

    public void setColumnMapping(Map<String, String> columnMapping) {
        this.columnMapping = columnMapping;
    }

    public boolean isIncludeUnmappedColumns() {
        return includeUnmappedColumns;
    }

    public void setIncludeUnmappedColumns(boolean includeUnmappedColumns) {
        this.includeUnmappedColumns = includeUnmappedColumns;
    }

    public List<PromotedColumn> getPromotedColumns() {
        return promotedColumns;
    }

    public void setPromotedColumns(List<PromotedColumn> promotedColumns) {
        this.promotedColumns = promotedColumns;
    }

    public void validate(String context) {
        if (sourceTable == null || sourceTable.isBlank()) {
            throw new IllegalArgumentException("sourceTable is required for table mapping " + context);
        }
        if (targetTable == null || targetTable.isBlank()) {
            throw new IllegalArgumentException("targetTable is required for table mapping " + context);
        }
        if (primaryKeyColumns == null || primaryKeyColumns.isEmpty()) {
            throw new IllegalArgumentException("primaryKeyColumns is required for table mapping " + context);
        }
        if (fetchSize <= 0) {
            throw new IllegalArgumentException("fetchSize must be positive for table mapping " + context);
        }
    }
}
