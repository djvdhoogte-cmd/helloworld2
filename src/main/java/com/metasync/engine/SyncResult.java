package com.metasync.engine;

import java.time.Duration;
import java.time.Instant;

public record SyncResult(
        String sourceName,
        String sourceTable,
        String targetTable,
        String runType,
        boolean success,
        long rowsProcessed,
        long rowsDeleted,
        Instant startedAt,
        Instant finishedAt,
        String errorMessage) {

    public static final String RUN_TYPE_SYNC = "SYNC";
    public static final String RUN_TYPE_RECONCILE = "RECONCILE";

    public Duration duration() {
        return Duration.between(startedAt, finishedAt);
    }

    public static SyncResult success(String sourceName, String sourceTable, String targetTable, long rowsProcessed,
            Instant startedAt, Instant finishedAt) {
        return new SyncResult(sourceName, sourceTable, targetTable, RUN_TYPE_SYNC, true, rowsProcessed, 0,
                startedAt, finishedAt, null);
    }

    public static SyncResult failure(String sourceName, String sourceTable, String targetTable,
            Instant startedAt, Instant finishedAt, String errorMessage) {
        return new SyncResult(sourceName, sourceTable, targetTable, RUN_TYPE_SYNC, false, 0, 0,
                startedAt, finishedAt, errorMessage);
    }

    public static SyncResult reconcileSuccess(String sourceName, String sourceTable, String targetTable,
            long rowsDeleted, Instant startedAt, Instant finishedAt) {
        return new SyncResult(sourceName, sourceTable, targetTable, RUN_TYPE_RECONCILE, true, 0, rowsDeleted,
                startedAt, finishedAt, null);
    }

    public static SyncResult reconcileFailure(String sourceName, String sourceTable, String targetTable,
            Instant startedAt, Instant finishedAt, String errorMessage) {
        return new SyncResult(sourceName, sourceTable, targetTable, RUN_TYPE_RECONCILE, false, 0, 0,
                startedAt, finishedAt, errorMessage);
    }
}
