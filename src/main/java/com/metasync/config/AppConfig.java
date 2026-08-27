package com.metasync.config;

import java.util.List;

public class AppConfig {

    private DestinationConfig destination;
    private List<SourceConfig> sources;

    public DestinationConfig getDestination() {
        return destination;
    }

    public void setDestination(DestinationConfig destination) {
        this.destination = destination;
    }

    public List<SourceConfig> getSources() {
        return sources;
    }

    public void setSources(List<SourceConfig> sources) {
        this.sources = sources;
    }

    public void validate() {
        if (destination == null) {
            throw new IllegalArgumentException("destination config is required");
        }
        destination.validate();
        if (sources == null || sources.isEmpty()) {
            throw new IllegalArgumentException("at least one source is required");
        }
        for (SourceConfig source : sources) {
            source.validate();
        }
        long distinctNames = sources.stream().map(SourceConfig::getName).distinct().count();
        if (distinctNames != sources.size()) {
            throw new IllegalArgumentException("source names must be unique");
        }
    }
}
