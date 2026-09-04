package com.metasync.config;

/**
 * Incremental (watermark-based) syncs only ever see inserted/updated rows, so they can't tell
 * when a row disappears from the source. Enabling this periodically does a full pass over just
 * the source table's primary key column(s) - much cheaper than a full row sync - and reconciles
 * away anything present in the target but no longer present in the source.
 */
public class DeleteDetectionConfig {

    private boolean enabled = false;
    private DeleteStrategy strategy = DeleteStrategy.SOFT;

    /** If unset, reconciliation runs on the same schedule as the table's regular sync. */
    private ScheduleConfig schedule;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public DeleteStrategy getStrategy() {
        return strategy;
    }

    public void setStrategy(DeleteStrategy strategy) {
        this.strategy = strategy;
    }

    public ScheduleConfig getSchedule() {
        return schedule;
    }

    public void setSchedule(ScheduleConfig schedule) {
        this.schedule = schedule;
    }

    public void validate(String context) {
        if (!enabled) {
            return;
        }
        if (strategy == null) {
            throw new IllegalArgumentException("deleteDetection.strategy is required when enabled for " + context);
        }
        if (schedule != null) {
            schedule.validate(context + " deleteDetection");
        }
    }
}
