package com.metasync.connector.dialect;

import com.metasync.config.SourceType;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;

/**
 * Oracle's NUMBER type is reported through JDBC as DECIMAL/NUMERIC with no fixed scale, even for
 * values that are really integers (e.g. primary keys declared as {@code NUMBER(10)}). Collapsing
 * whole-valued, reasonably-sized results down to a Long keeps the JSON payload in the meta
 * database from being littered with values like {@code 42.0} for what is conceptually an integer.
 */
public class OracleDialect implements SourceDialect {

    @Override
    public SourceType type() {
        return SourceType.ORACLE;
    }

    @Override
    public Object readValue(ResultSet rs, ResultSetMetaData meta, int columnIndex) throws SQLException {
        int sqlType = meta.getColumnType(columnIndex);
        if (sqlType == Types.NUMERIC || sqlType == Types.DECIMAL) {
            BigDecimal value = rs.getBigDecimal(columnIndex);
            if (rs.wasNull() || value == null) {
                return null;
            }
            if (value.scale() <= 0) {
                try {
                    return value.longValueExact();
                } catch (ArithmeticException tooLargeForLong) {
                    return value;
                }
            }
            return value;
        }
        return SourceDialect.super.readValue(rs, meta, columnIndex);
    }
}
