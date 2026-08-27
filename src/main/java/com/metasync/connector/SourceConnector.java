package com.metasync.connector;

import com.metasync.config.TableMapping;

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

    @Override
    void close();
}
