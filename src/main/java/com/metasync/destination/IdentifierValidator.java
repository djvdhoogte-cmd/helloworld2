package com.metasync.destination;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * SQL identifiers (schema/table/column names) and column types come from the sync config and are
 * interpolated directly into DDL/DML text (JDBC placeholders can't parameterize identifiers).
 * Validating them defensively here keeps a malformed or malicious config from ever reaching raw
 * SQL construction.
 */
public final class IdentifierValidator {

    private static final Pattern IDENTIFIER = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*$");
    private static final Pattern SQL_TYPE = Pattern.compile(
            "^([A-Za-z][A-Za-z ]*)(\\([0-9]+(,\\s*[0-9]+)?\\))?$");
    private static final Set<String> ALLOWED_BASE_TYPES = Set.of(
            "TEXT", "VARCHAR", "CHAR", "INTEGER", "INT", "BIGINT", "SMALLINT", "NUMERIC", "DECIMAL",
            "BOOLEAN", "TIMESTAMP", "TIMESTAMPTZ", "TIMESTAMP WITH TIME ZONE", "DATE", "TIME",
            "JSONB", "JSON", "DOUBLE PRECISION", "REAL", "UUID", "BYTEA");

    private IdentifierValidator() {
    }

    public static String validateIdentifier(String identifier, String kind) {
        if (identifier == null || !IDENTIFIER.matcher(identifier).matches()) {
            throw new IllegalArgumentException(
                    "invalid " + kind + " '" + identifier + "': must match " + IDENTIFIER.pattern());
        }
        return identifier;
    }

    public static String validateSqlType(String sqlType, String context) {
        if (sqlType == null) {
            throw new IllegalArgumentException("sqlType is required for " + context);
        }
        var matcher = SQL_TYPE.matcher(sqlType.trim());
        if (!matcher.matches() || !ALLOWED_BASE_TYPES.contains(matcher.group(1).trim().toUpperCase())) {
            throw new IllegalArgumentException(
                    "unsupported sqlType '" + sqlType + "' for " + context + "; allowed base types: "
                            + ALLOWED_BASE_TYPES);
        }
        return sqlType.trim();
    }
}
