package com.metasync.connector;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * Watermark columns are typically either a monotonically increasing numeric id/sequence or a
 * last-modified timestamp. Persisted watermarks are stored as plain strings (see
 * PostgresMetaWriter's sync_state table); this converts back to a typed value suitable for
 * binding into a JDBC PreparedStatement against the original source column, trying the most
 * common shapes in order.
 */
public final class WatermarkCodec {

    private WatermarkCodec() {
    }

    public static String encode(Object value) {
        if (value == null) {
            return null;
        }
        return value.toString();
    }

    public static Object decode(String stored) {
        if (stored == null) {
            return null;
        }
        try {
            return Long.parseLong(stored);
        } catch (NumberFormatException ignored) {
            // not an integer
        }
        try {
            return new BigDecimal(stored);
        } catch (NumberFormatException ignored) {
            // not a plain decimal
        }
        try {
            return Timestamp.valueOf(stored);
        } catch (IllegalArgumentException ignored) {
            // not a "yyyy-MM-dd HH:mm:ss[.fffffffff]" timestamp
        }
        return stored;
    }
}
