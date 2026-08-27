package com.metasync.connector.dialect;

import com.metasync.config.SourceType;

public final class DialectFactory {

    private DialectFactory() {
    }

    public static SourceDialect forType(SourceType type) {
        return switch (type) {
            case ORACLE -> new OracleDialect();
            case OPENEDGE -> new OpenEdgeDialect();
            case GENERIC -> new GenericDialect();
        };
    }
}
