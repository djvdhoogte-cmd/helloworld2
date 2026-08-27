package com.metasync.config;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class SourceConfig {

    private String name;
    private SourceType type;
    private String jdbcUrl;
    private String username;
    private String password;
    private Map<String, String> properties = new LinkedHashMap<>();
    private ScheduleConfig schedule;
    private List<TableMapping> tables;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public SourceType getType() {
        return type;
    }

    public void setType(SourceType type) {
        this.type = type;
    }

    public String getJdbcUrl() {
        return jdbcUrl;
    }

    public void setJdbcUrl(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Map<String, String> getProperties() {
        return properties;
    }

    public void setProperties(Map<String, String> properties) {
        this.properties = properties;
    }

    public ScheduleConfig getSchedule() {
        return schedule;
    }

    public void setSchedule(ScheduleConfig schedule) {
        this.schedule = schedule;
    }

    public List<TableMapping> getTables() {
        return tables;
    }

    public void setTables(List<TableMapping> tables) {
        this.tables = tables;
    }

    public void validate() {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("source name is required");
        }
        if (type == null) {
            throw new IllegalArgumentException("source type is required for source '" + name + "'");
        }
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            throw new IllegalArgumentException("jdbcUrl is required for source '" + name + "'");
        }
        if (schedule == null) {
            throw new IllegalArgumentException("schedule is required for source '" + name + "'");
        }
        schedule.validate("source '" + name + "'");
        if (tables == null || tables.isEmpty()) {
            throw new IllegalArgumentException("at least one table mapping is required for source '" + name + "'");
        }
        for (int i = 0; i < tables.size(); i++) {
            tables.get(i).validate("source '" + name + "' index " + i);
        }
    }
}
