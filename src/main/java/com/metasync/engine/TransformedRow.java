package com.metasync.engine;

import java.time.Instant;
import java.util.Map;

/**
 * A source row after mapping into the unified shape ready to be upserted into the meta database:
 * a stable provenance key ({@code sourceSystem} + {@code sourcePk}), the full unified payload as
 * JSON (goes into the {@code data} JSONB column), and any fields promoted to real typed columns.
 */
public record TransformedRow(
        String sourceSystem,
        String sourceTable,
        String sourcePk,
        String dataJson,
        Map<String, Object> promotedValues,
        Instant syncedAt) {
}
