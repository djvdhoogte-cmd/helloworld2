package com.metasync.config;

public enum DeleteStrategy {
    /** Rows missing from the source are kept but stamped with {@code _deleted_at}, preserving history. */
    SOFT,
    /** Rows missing from the source are removed from the target table outright. */
    HARD
}
