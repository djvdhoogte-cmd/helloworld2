package com.metasync.engine;

import java.time.Duration;
import java.time.Instant;

public record SyncResult(
        String sourceName,
        String sourceTable,
        String targetTable,
        boolean success,
        long rowsProcessed,
        Instant startedAt,
        Instant finishedAt,
        String errorMessage) {

    public Duration duration() {
        return Duration.between(startedAt, finishedAt);
    }

    public static SyncResult success(String sourceName, String sourceTable, String targetTable, long rowsProcessed,
            Instant startedAt, Instant finishedAt) {
        return new SyncResult(sourceName, sourceTable, targetTable, true, rowsProcessed, startedAt, finishedAt, null);
    }

    public static SyncResult failure(String sourceName, String sourceTable, String targetTable,
            Instant startedAt, Instant finishedAt, String errorMessage) {
        return new SyncResult(sourceName, sourceTable, targetTable, false, 0, startedAt, finishedAt, errorMessage);
    }
}
