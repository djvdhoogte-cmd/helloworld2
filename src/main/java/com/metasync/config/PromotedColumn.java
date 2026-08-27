package com.metasync.config;

/**
 * A unified field (as produced by {@link TableMapping#getColumnMapping()}) that should
 * additionally be materialized as a real, typed Postgres column on the target table
 * (rather than only living inside the {@code data} JSONB blob), so it can be indexed
 * and queried efficiently.
 */
public class PromotedColumn {

    private String field;
    private String sqlType = "TEXT";

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public String getSqlType() {
        return sqlType;
    }

    public void setSqlType(String sqlType) {
        this.sqlType = sqlType;
    }
}
