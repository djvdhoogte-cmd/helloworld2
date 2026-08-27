package com.metasync.connector.dialect;

import com.metasync.config.SourceType;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;

/**
 * Vendor-specific hooks for reading JDBC result set values in a normalized, JSON-serializable
 * form. Legacy/enterprise drivers (Oracle, Progress OpenEdge) expose quite a few vendor-specific
 * or ambiguous SQL types (CLOB/NCLOB, ROWID, proprietary DECIMAL/TIMESTAMP variants); this keeps
 * that handling in one place per source type instead of scattered through the extraction code.
 */
public interface SourceDialect {

    SourceType type();

    /** Applies driver-appropriate streaming hints (fetch size, direction, ...) to a statement. */
    default void configureForStreaming(Statement statement, int fetchSize) throws SQLException {
        statement.setFetchSize(fetchSize);
    }

    /**
     * Reads column {@code columnIndex} (1-based) from {@code rs} and returns a plain Java object
     * safe to JSON-serialize (String, Number, Boolean, byte[], java.time/java.sql temporal types).
     */
    default Object readValue(ResultSet rs, ResultSetMetaData meta, int columnIndex) throws SQLException {
        int sqlType = meta.getColumnType(columnIndex);
        Object value;
        switch (sqlType) {
            case Types.CLOB:
            case Types.NCLOB:
            case Types.LONGVARCHAR:
            case Types.LONGNVARCHAR:
                value = rs.getString(columnIndex);
                break;
            case Types.BLOB:
            case Types.VARBINARY:
            case Types.BINARY:
            case Types.LONGVARBINARY:
                value = rs.getBytes(columnIndex);
                break;
            case Types.TIMESTAMP:
            case Types.TIMESTAMP_WITH_TIMEZONE:
                value = rs.getTimestamp(columnIndex);
                break;
            case Types.DATE:
                value = rs.getDate(columnIndex);
                break;
            case Types.TIME:
                value = rs.getTime(columnIndex);
                break;
            case Types.DECIMAL:
            case Types.NUMERIC:
                value = rs.getBigDecimal(columnIndex);
                break;
            case Types.ROWID:
                value = rs.getRowId(columnIndex) == null ? null : rs.getRowId(columnIndex).toString();
                break;
            default:
                value = rs.getObject(columnIndex);
        }
        return rs.wasNull() ? null : value;
    }
}
