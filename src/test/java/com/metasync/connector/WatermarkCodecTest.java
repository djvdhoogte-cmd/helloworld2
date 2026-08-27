package com.metasync.connector;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Timestamp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class WatermarkCodecTest {

    @Test
    void roundTripsIntegerWatermark() {
        String encoded = WatermarkCodec.encode(12345L);
        assertEquals(12345L, WatermarkCodec.decode(encoded));
    }

    @Test
    void roundTripsDecimalWatermark() {
        String encoded = WatermarkCodec.encode(new BigDecimal("12345.67"));
        assertEquals(new BigDecimal("12345.67"), WatermarkCodec.decode(encoded));
    }

    @Test
    void roundTripsTimestampWatermark() {
        Timestamp ts = Timestamp.valueOf("2026-01-15 10:30:00");
        String encoded = WatermarkCodec.encode(ts);
        assertEquals(ts, WatermarkCodec.decode(encoded));
    }

    @Test
    void handlesNulls() {
        assertNull(WatermarkCodec.encode(null));
        assertNull(WatermarkCodec.decode(null));
    }
}
