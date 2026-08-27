package com.metasync.engine;

import com.metasync.config.PromotedColumn;
import com.metasync.config.TableMapping;
import com.metasync.connector.ExtractedRow;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RowTransformerTest {

    @Test
    void mapsColumnsAndPreservesUnmappedColumnsInData() throws Exception {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("SCOTT.ORDERS");
        mapping.setTargetTable("orders");
        mapping.setPrimaryKeyColumns(List.of("order_id"));
        mapping.setColumnMapping(Map.of("order_id", "order_id", "status", "status"));
        mapping.setIncludeUnmappedColumns(true);
        mapping.setPromotedColumns(List.of(promoted("status", "TEXT")));

        Map<String, Object> columns = new LinkedHashMap<>();
        columns.put("order_id", 42L);
        columns.put("status", "SHIPPED");
        columns.put("internal_note", "do not surface");
        ExtractedRow row = new ExtractedRow(columns);

        TransformedRow transformed = RowTransformer.transform(row, mapping, "orders-oracle");

        assertEquals("orders-oracle", transformed.sourceSystem());
        assertEquals("orders", transformed.sourceTable());
        assertEquals("42", transformed.sourcePk());
        assertEquals("SHIPPED", transformed.promotedValues().get("status"));

        Map<?, ?> data = JsonSupport.MAPPER.readValue(transformed.dataJson(), Map.class);
        assertEquals(42, ((Number) data.get("order_id")).intValue());
        assertEquals("SHIPPED", data.get("status"));
        assertEquals("do not surface", data.get("internal_note"));
    }

    @Test
    void excludesUnmappedColumnsWhenDisabled() throws Exception {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("PUB.Item");
        mapping.setTargetTable("inventory_items");
        mapping.setPrimaryKeyColumns(List.of("itemnum"));
        mapping.setColumnMapping(Map.of("itemnum", "item_num"));
        mapping.setIncludeUnmappedColumns(false);

        Map<String, Object> columns = new LinkedHashMap<>();
        columns.put("itemnum", 7L);
        columns.put("onhand", 100L);
        ExtractedRow row = new ExtractedRow(columns);

        TransformedRow transformed = RowTransformer.transform(row, mapping, "inventory-openedge");

        Map<?, ?> data = JsonSupport.MAPPER.readValue(transformed.dataJson(), Map.class);
        assertTrue(!data.containsKey("onhand"));
        assertEquals(7, ((Number) data.get("item_num")).intValue());
    }

    @Test
    void joinsCompositePrimaryKeyParts() {
        TableMapping mapping = new TableMapping();
        mapping.setSourceTable("x");
        mapping.setTargetTable("y");
        mapping.setPrimaryKeyColumns(List.of("a", "b"));
        mapping.setColumnMapping(Map.of());

        Map<String, Object> columns = new LinkedHashMap<>();
        columns.put("a", "123");
        columns.put("b", "abc");
        TransformedRow transformed = RowTransformer.transform(new ExtractedRow(columns), mapping, "src");

        assertTrue(transformed.sourcePk().contains("123"));
        assertTrue(transformed.sourcePk().contains("abc"));
        assertTrue(transformed.sourcePk().length() > "123abc".length());
    }

    private static PromotedColumn promoted(String field, String sqlType) {
        PromotedColumn column = new PromotedColumn();
        column.setField(field);
        column.setSqlType(sqlType);
        return column;
    }
}
