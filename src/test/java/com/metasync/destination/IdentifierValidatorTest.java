package com.metasync.destination;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IdentifierValidatorTest {

    @Test
    void acceptsSimpleIdentifiers() {
        assertEquals("orders", IdentifierValidator.validateIdentifier("orders", "table"));
        assertEquals("_source_pk", IdentifierValidator.validateIdentifier("_source_pk", "column"));
    }

    @Test
    void rejectsIdentifiersThatCouldBreakOutOfDdl() {
        assertThrows(IllegalArgumentException.class,
                () -> IdentifierValidator.validateIdentifier("orders; DROP TABLE x --", "table"));
        assertThrows(IllegalArgumentException.class, () -> IdentifierValidator.validateIdentifier("1orders", "table"));
        assertThrows(IllegalArgumentException.class, () -> IdentifierValidator.validateIdentifier(null, "table"));
    }

    @Test
    void acceptsAllowedSqlTypesIncludingParameterized() {
        assertEquals("BIGINT", IdentifierValidator.validateSqlType("BIGINT", "ctx"));
        assertEquals("NUMERIC(10,2)", IdentifierValidator.validateSqlType("NUMERIC(10,2)", "ctx"));
        assertEquals("timestamptz", IdentifierValidator.validateSqlType("timestamptz", "ctx"));
    }

    @Test
    void rejectsUnknownOrMaliciousSqlTypes() {
        assertThrows(IllegalArgumentException.class,
                () -> IdentifierValidator.validateSqlType("TEXT); DROP TABLE x; --", "ctx"));
        assertThrows(IllegalArgumentException.class, () -> IdentifierValidator.validateSqlType("NOT_A_TYPE", "ctx"));
    }
}
