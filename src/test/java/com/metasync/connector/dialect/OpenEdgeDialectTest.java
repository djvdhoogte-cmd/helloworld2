package com.metasync.connector.dialect;

import org.junit.jupiter.api.Test;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OpenEdgeDialectTest {

    private final OpenEdgeDialect dialect = new OpenEdgeDialect();

    @Test
    void normalizesBitColumnToBoolean() throws Exception {
        ResultSet rs = mock(ResultSet.class);
        ResultSetMetaData meta = mock(ResultSetMetaData.class);
        when(meta.getColumnType(1)).thenReturn(Types.BIT);
        when(rs.getBoolean(1)).thenReturn(true);
        when(rs.wasNull()).thenReturn(false);

        Object value = dialect.readValue(rs, meta, 1);

        assertInstanceOf(Boolean.class, value);
        assertEquals(true, value);
    }

    @Test
    void fallsBackToDefaultHandlingForOtherTypes() throws Exception {
        ResultSet rs = mock(ResultSet.class);
        ResultSetMetaData meta = mock(ResultSetMetaData.class);
        when(meta.getColumnType(1)).thenReturn(Types.VARCHAR);
        when(rs.getObject(1)).thenReturn("item-42");
        when(rs.wasNull()).thenReturn(false);

        assertEquals("item-42", dialect.readValue(rs, meta, 1));
    }
}
