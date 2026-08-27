package com.metasync.config;

public class DestinationConfig {

    private String jdbcUrl;
    private String username;
    private String password;
    private String schema = "public";

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

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    public void validate() {
        if (jdbcUrl == null || jdbcUrl.isBlank()) {
            throw new IllegalArgumentException("destination.jdbcUrl is required");
        }
        if (schema == null || schema.isBlank()) {
            throw new IllegalArgumentException("destination.schema must not be blank");
        }
    }
}
