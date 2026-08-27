package com.metasync.connector.dialect;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OracleDialectTest {

    private final OracleDialect dialect = new OracleDialect();

    @Test
    void collapsesWholeValuedNumberToLong() throws Exception {
        ResultSet rs = mock(ResultSet.class);
        ResultSetMetaData meta = mock(ResultSetMetaData.class);
        when(meta.getColumnType(1)).thenReturn(Types.NUMERIC);
        when(rs.getBigDecimal(1)).thenReturn(new BigDecimal("42"));
        when(rs.wasNull()).thenReturn(false);

        Object value = dialect.readValue(rs, meta, 1);

        assertInstanceOf(Long.class, value);
        assertEquals(42L, value);
    }

    @Test
    void keepsDecimalNumberAsBigDecimal() throws Exception {
        ResultSet rs = mock(ResultSet.class);
        ResultSetMetaData meta = mock(ResultSetMetaData.class);
        when(meta.getColumnType(1)).thenReturn(Types.NUMERIC);
        when(rs.getBigDecimal(1)).thenReturn(new BigDecimal("19.99"));
        when(rs.wasNull()).thenReturn(false);

        Object value = dialect.readValue(rs, meta, 1);

        assertInstanceOf(BigDecimal.class, value);
        assertEquals(new BigDecimal("19.99"), value);
    }

    @Test
    void returnsNullWhenColumnIsNull() throws Exception {
        ResultSet rs = mock(ResultSet.class);
        ResultSetMetaData meta = mock(ResultSetMetaData.class);
        when(meta.getColumnType(1)).thenReturn(Types.NUMERIC);
        when(rs.getBigDecimal(1)).thenReturn(null);
        when(rs.wasNull()).thenReturn(true);

        assertEquals(null, dialect.readValue(rs, meta, 1));
    }
}
