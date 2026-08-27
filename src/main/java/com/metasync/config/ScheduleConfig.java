package com.metasync.config;

/**
 * Exactly one of {@code cron} or {@code intervalSeconds} should be set.
 * cron uses standard 5-field UNIX cron syntax (minute hour day-of-month month day-of-week).
 */
public class ScheduleConfig {

    private String cron;
    private Long intervalSeconds;

    public String getCron() {
        return cron;
    }

    public void setCron(String cron) {
        this.cron = cron;
    }

    public Long getIntervalSeconds() {
        return intervalSeconds;
    }

    public void setIntervalSeconds(Long intervalSeconds) {
        this.intervalSeconds = intervalSeconds;
    }

    public boolean isCronBased() {
        return cron != null && !cron.isBlank();
    }

    public void validate(String context) {
        boolean hasCron = cron != null && !cron.isBlank();
        boolean hasInterval = intervalSeconds != null;
        if (hasCron == hasInterval) {
            throw new IllegalArgumentException(
                    "schedule for " + context + " must set exactly one of 'cron' or 'intervalSeconds'");
        }
        if (hasInterval && intervalSeconds <= 0) {
            throw new IllegalArgumentException("schedule.intervalSeconds for " + context + " must be positive");
        }
    }
}
