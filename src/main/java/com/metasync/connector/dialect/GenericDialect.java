package com.metasync.connector.dialect;

import com.metasync.config.SourceType;

/** Falls back entirely to the default, driver-agnostic value handling in {@link SourceDialect}. */
public class GenericDialect implements SourceDialect {

    @Override
    public SourceType type() {
        return SourceType.GENERIC;
    }
}
