package com.metasync.engine;

import com.metasync.config.TableMapping;
import com.metasync.connector.SourceConnector;
import com.metasync.destination.PostgresMetaWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Orchestrates a single (source, table mapping) sync: extract, transform, batch-upsert, track watermark. */
public class SyncEngine {

    private static final Logger log = LoggerFactory.getLogger(SyncEngine.class);
    private static final int BATCH_SIZE = 500;

    private final PostgresMetaWriter writer;

    public SyncEngine(PostgresMetaWriter writer) {
        this.writer = writer;
    }

    public SyncResult runOnce(SourceConnector connector, TableMapping mapping) {
        Instant startedAt = Instant.now();
        String sourceName = connector.sourceName();
        long[] rowCount = {0};

        try {
            writer.ensureTargetTable(mapping);

            String sinceWatermark = mapping.isIncremental()
                    ? writer.getWatermark(sourceName, mapping.getTargetTable()).orElse(null)
                    : null;

            List<TransformedRow> batch = new ArrayList<>(BATCH_SIZE);
            String maxWatermark = connector.extract(mapping, sinceWatermark, row -> {
                batch.add(RowTransformer.transform(row, mapping, sourceName));
                rowCount[0]++;
                if (batch.size() >= BATCH_SIZE) {
                    writer.upsertBatch(mapping, new ArrayList<>(batch));
                    batch.clear();
                }
            });
            if (!batch.isEmpty()) {
                writer.upsertBatch(mapping, batch);
            }

            if (mapping.isIncremental() && maxWatermark != null) {
                writer.updateWatermark(sourceName, mapping.getTargetTable(), maxWatermark);
            }

            Instant finishedAt = Instant.now();
            SyncResult result = SyncResult.success(sourceName, mapping.getSourceTable(), mapping.getTargetTable(),
                    rowCount[0], startedAt, finishedAt);
            writer.recordSyncRun(result);
            log.info("[{}] synced {} -> {}: {} row(s) in {}", sourceName, mapping.getSourceTable(),
                    mapping.getTargetTable(), rowCount[0], result.duration());
            return result;
        } catch (Exception e) {
            Instant finishedAt = Instant.now();
            SyncResult result = SyncResult.failure(sourceName, mapping.getSourceTable(), mapping.getTargetTable(),
                    startedAt, finishedAt, describeError(e));
            writer.recordSyncRun(result);
            log.error("[{}] sync failed for {} -> {}", sourceName, mapping.getSourceTable(),
                    mapping.getTargetTable(), e);
            return result;
        }
    }

    private static String describeError(Exception e) {
        String message = e.getMessage();
        return message != null ? message : e.getClass().getSimpleName();
    }
}
