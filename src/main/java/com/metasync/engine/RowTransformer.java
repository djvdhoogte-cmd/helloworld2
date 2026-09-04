package com.metasync.engine;

import com.metasync.config.PromotedColumn;
import com.metasync.config.TableMapping;
import com.metasync.connector.ExtractedRow;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class RowTransformer {

    /** Joins composite primary key parts; the ASCII unit separator won't collide with real column values. */
    private static final char PK_PART_SEPARATOR = '';

    private RowTransformer() {
    }

    public static TransformedRow transform(ExtractedRow row, TableMapping mapping, String sourceSystem) {
        Map<String, Object> data = new LinkedHashMap<>();

        Set<String> mappedSourceKeys = new LinkedHashSet<>();
        mapping.getColumnMapping().forEach((sourceColumn, targetField) -> {
            mappedSourceKeys.add(sourceColumn.toLowerCase());
            data.put(targetField, row.get(sourceColumn));
        });

        if (mapping.isIncludeUnmappedColumns()) {
            row.columns().forEach((sourceColumn, value) -> {
                if (!mappedSourceKeys.contains(sourceColumn) && !data.containsKey(sourceColumn)) {
                    data.put(sourceColumn, value);
                }
            });
        }

        String dataJson;
        try {
            dataJson = JsonSupport.MAPPER.writeValueAsString(data);
        } catch (Exception e) {
            throw new RuntimeException("failed to serialize row from " + mapping.getSourceTable() + " to JSON", e);
        }

        Map<String, Object> promotedValues = new LinkedHashMap<>();
        for (PromotedColumn promoted : mapping.getPromotedColumns()) {
            promotedValues.put(promoted.getField(), data.get(promoted.getField()));
        }

        return new TransformedRow(
                sourceSystem,
                mapping.getSourceTable(),
                buildSourcePrimaryKey(row, mapping.getPrimaryKeyColumns()),
                dataJson,
                promotedValues,
                Instant.now());
    }

    /**
     * Joins a row's primary key column values into the same opaque string used as {@code _source_pk}
     * in the target table, so a full primary-key-only scan (see delete reconciliation) produces
     * values directly comparable to what's already stored.
     */
    public static String buildSourcePrimaryKey(ExtractedRow row, List<String> primaryKeyColumns) {
        StringBuilder pk = new StringBuilder();
        for (String column : primaryKeyColumns) {
            Object value = row.get(column);
            if (pk.length() > 0) {
                pk.append(PK_PART_SEPARATOR);
            }
            pk.append(value == null ? "" : value.toString());
        }
        return pk.toString();
    }
}
