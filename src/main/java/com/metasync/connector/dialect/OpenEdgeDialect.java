package com.metasync.connector.dialect;

import com.metasync.config.SourceType;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;

/**
 * Progress OpenEdge JDBC drivers (e.g. the DataDirect-based driver Progress ships with the
 * DataServer) commonly surface OpenEdge LOGICAL fields as SQL BIT/CHAR rather than a clean
 * boolean, and DECIMAL fields default to a fixed scale that can misrepresent whole numbers the
 * same way Oracle's NUMBER does. Both are normalized here so downstream JSON looks the same
 * regardless of which legacy system the row came from.
 */
public class OpenEdgeDialect implements SourceDialect {

    @Override
    public SourceType type() {
        return SourceType.OPENEDGE;
    }

    @Override
    public Object readValue(ResultSet rs, ResultSetMetaData meta, int columnIndex) throws SQLException {
        int sqlType = meta.getColumnType(columnIndex);
        if (sqlType == Types.BIT || sqlType == Types.BOOLEAN) {
            boolean value = rs.getBoolean(columnIndex);
            return rs.wasNull() ? null : value;
        }
        return SourceDialect.super.readValue(rs, meta, columnIndex);
    }
}
