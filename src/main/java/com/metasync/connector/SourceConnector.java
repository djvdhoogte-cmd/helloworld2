package com.metasync.connector;

import com.metasync.config.TableMapping;

import java.util.Set;
import java.util.function.Consumer;

public interface SourceConnector extends AutoCloseable {

    String sourceName();

    /**
     * Streams rows for {@code mapping} to {@code rowHandler}. When {@code mapping.isIncremental()}
     * is true and {@code sinceWatermark} is non-null, only rows with a watermark strictly greater
     * than it are streamed.
     *
     * @return the maximum watermark value observed (as an opaque string, see {@link WatermarkCodec}),
     *         or {@code null} if the mapping is not incremental or no rows were read.
     */
    String extract(TableMapping mapping, String sinceWatermark, Consumer<ExtractedRow> rowHandler) throws Exception;

    /**
     * Fetches every currently-live primary key from the source table (ignoring any watermark), in
     * the same opaque {@code _source_pk} format used in the target table. Used by delete
     * reconciliation to find target rows whose source row no longer exists; much cheaper than a
     * full row extract since only the primary key column(s) are read.
     */
    Set<String> fetchAllPrimaryKeys(TableMapping mapping) throws Exception;

    @Override
    void close();
}
