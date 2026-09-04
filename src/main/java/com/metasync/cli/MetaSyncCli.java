package com.metasync.cli;

import com.metasync.config.AppConfig;
import com.metasync.config.ConfigLoader;
import com.metasync.config.SourceConfig;
import com.metasync.config.TableMapping;
import com.metasync.connector.JdbcSourceConnector;
import com.metasync.connector.SourceConnector;
import com.metasync.destination.PostgresMetaWriter;
import com.metasync.engine.SyncEngine;
import com.metasync.engine.SyncResult;
import com.metasync.scheduler.SyncScheduler;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import picocli.CommandLine;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;

@Command(name = "meta-db-sync", mixinStandardHelpOptions = true, version = "1.0.0",
        description = "Synchronizes multiple heterogeneous database sources into a unified PostgreSQL meta database.")
public class MetaSyncCli implements Callable<Integer> {

    private static final Logger log = LoggerFactory.getLogger(MetaSyncCli.class);

    @Option(names = {"-c", "--config"}, required = true, description = "Path to the YAML config file")
    private File configFile;

    @Option(names = {"--once"},
            description = "Run every configured table mapping once and exit, instead of starting the scheduler")
    private boolean once;

    @Option(names = {"--source"}, description = "Only sync this source (by name); may be repeated")
    private List<String> sourceFilter = new ArrayList<>();

    public static void main(String[] args) {
        int exitCode = new CommandLine(new MetaSyncCli()).execute(args);
        System.exit(exitCode);
    }

    @Override
    public Integer call() throws Exception {
        AppConfig config = new ConfigLoader().load(configFile.toPath());
        List<SourceConfig> sources = filterSources(config.getSources());
        if (sources.isEmpty()) {
            log.error("no sources matched --source filter {}", sourceFilter);
            return 2;
        }

        HikariConfig destHikari = new HikariConfig();
        destHikari.setJdbcUrl(config.getDestination().getJdbcUrl());
        destHikari.setUsername(config.getDestination().getUsername());
        destHikari.setPassword(config.getDestination().getPassword());
        destHikari.setPoolName("meta-sync-destination");
        destHikari.setMaximumPoolSize(10);

        try (HikariDataSource destinationDataSource = new HikariDataSource(destHikari)) {
            PostgresMetaWriter writer = new PostgresMetaWriter(destinationDataSource,
                    config.getDestination().getSchema());
            writer.ensureControlTablesExist();
            SyncEngine engine = new SyncEngine(writer);

            Map<String, SourceConnector> connectors = new LinkedHashMap<>();
            for (SourceConfig source : sources) {
                connectors.put(source.getName(), new JdbcSourceConnector(source));
            }
            try {
                return once ? runOnce(engine, sources, connectors) : runScheduled(engine, sources, connectors);
            } finally {
                connectors.values().forEach(SourceConnector::close);
            }
        }
    }

    private List<SourceConfig> filterSources(List<SourceConfig> all) {
        if (sourceFilter.isEmpty()) {
            return all;
        }
        return all.stream().filter(s -> sourceFilter.contains(s.getName())).toList();
    }

    private int runOnce(SyncEngine engine, List<SourceConfig> sources, Map<String, SourceConnector> connectors) {
        boolean allSucceeded = true;
        for (SourceConfig source : sources) {
            SourceConnector connector = connectors.get(source.getName());
            for (TableMapping mapping : source.getTables()) {
                SyncResult result = engine.runOnce(connector, mapping);
                allSucceeded = allSucceeded && result.success();

                if (mapping.getDeleteDetection().isEnabled()) {
                    SyncResult reconcileResult = engine.reconcileDeletes(connector, mapping);
                    allSucceeded = allSucceeded && reconcileResult.success();
                }
            }
        }
        return allSucceeded ? 0 : 1;
    }

    private int runScheduled(SyncEngine engine, List<SourceConfig> sources, Map<String, SourceConnector> connectors)
            throws InterruptedException {
        SyncScheduler scheduler = new SyncScheduler(engine, connectors, Math.max(4, sources.size()));
        scheduler.start(sources);
        Runtime.getRuntime().addShutdownHook(new Thread(scheduler::shutdown, "meta-sync-shutdown"));
        log.info("meta-db-sync scheduler started for {} source(s); press Ctrl+C to stop", sources.size());
        new CountDownLatch(1).await();
        return 0;
    }
}
