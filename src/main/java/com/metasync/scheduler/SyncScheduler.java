package com.metasync.scheduler;

import com.cronutils.model.Cron;
import com.cronutils.model.CronType;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.model.time.ExecutionTime;
import com.cronutils.parser.CronParser;
import com.metasync.config.ScheduleConfig;
import com.metasync.config.SourceConfig;
import com.metasync.config.TableMapping;
import com.metasync.connector.SourceConnector;
import com.metasync.engine.SyncEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Runs each (source, table mapping) sync - and, if enabled, its delete reconciliation - on its own configured schedule. */
public class SyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(SyncScheduler.class);

    private final SyncEngine engine;
    private final Map<String, SourceConnector> connectorsBySourceName;
    private final ScheduledExecutorService executor;
    private final CronParser cronParser =
            new CronParser(CronDefinitionBuilder.instanceDefinitionFor(CronType.UNIX));

    public SyncScheduler(SyncEngine engine, Map<String, SourceConnector> connectorsBySourceName, int threadPoolSize) {
        this.engine = engine;
        this.connectorsBySourceName = connectorsBySourceName;
        this.executor = Executors.newScheduledThreadPool(threadPoolSize, runnable -> {
            Thread thread = new Thread(runnable, "meta-sync-scheduler");
            thread.setDaemon(true);
            return thread;
        });
    }

    public void start(List<SourceConfig> sources) {
        for (SourceConfig source : sources) {
            SourceConnector connector = connectorsBySourceName.get(source.getName());
            for (TableMapping mapping : source.getTables()) {
                scheduleJob(source.getSchedule(),
                        () -> engine.runOnce(connector, mapping),
                        "sync " + source.getName() + "/" + mapping.getSourceTable() + " -> " + mapping.getTargetTable());

                if (mapping.getDeleteDetection().isEnabled()) {
                    ScheduleConfig reconcileSchedule = mapping.getDeleteDetection().getSchedule();
                    scheduleJob(reconcileSchedule != null ? reconcileSchedule : source.getSchedule(),
                            () -> engine.reconcileDeletes(connector, mapping),
                            "delete reconciliation " + source.getName() + "/" + mapping.getSourceTable() + " -> "
                                    + mapping.getTargetTable());
                }
            }
        }
    }

    private void scheduleJob(ScheduleConfig schedule, Runnable action, String description) {
        Runnable job = () -> {
            try {
                action.run();
            } catch (RuntimeException e) {
                // SyncEngine already catches and records failures internally; this is a final
                // backstop so one bad run never kills the scheduled executor's thread.
                log.error("unexpected error running scheduled job: {}", description, e);
            }
        };

        if (schedule.isCronBased()) {
            Cron cron = cronParser.parse(schedule.getCron());
            log.info("scheduling {} on cron '{}'", description, schedule.getCron());
            scheduleNextCronRun(job, ExecutionTime.forCron(cron));
        } else {
            long intervalSeconds = schedule.getIntervalSeconds();
            log.info("scheduling {} every {}s", description, intervalSeconds);
            executor.scheduleWithFixedDelay(job, 0, intervalSeconds, TimeUnit.SECONDS);
        }
    }

    private void scheduleNextCronRun(Runnable job, ExecutionTime executionTime) {
        ZonedDateTime now = ZonedDateTime.now();
        Optional<ZonedDateTime> next = executionTime.nextExecution(now);
        if (next.isEmpty()) {
            log.warn("cron expression has no future executions; not rescheduling");
            return;
        }
        long delayMillis = Math.max(0, Duration.between(now, next.get()).toMillis());
        executor.schedule(() -> {
            try {
                job.run();
            } finally {
                scheduleNextCronRun(job, executionTime);
            }
        }, delayMillis, TimeUnit.MILLISECONDS);
    }

    public void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
