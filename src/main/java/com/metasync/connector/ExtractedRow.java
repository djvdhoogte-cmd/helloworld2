package com.metasync.connector;

import java.util.Map;

/** One row read from a source table, with column names lower-cased and values already normalized. */
public record ExtractedRow(Map<String, Object> columns) {

    public Object get(String columnName) {
        return columns.get(columnName.toLowerCase());
    }
}
