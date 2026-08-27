package com.metasync.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Loads an {@link AppConfig} from a YAML file, resolving {@code ${ENV_VAR}} and
 * {@code ${ENV_VAR:default}} placeholders against environment variables before parsing,
 * so secrets (passwords, hostnames) never need to be hardcoded in the config file.
 */
public final class ConfigLoader {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([A-Za-z0-9_]+)(:([^}]*))?}");

    private final Function<String, String> envLookup;

    public ConfigLoader() {
        this(System::getenv);
    }

    /** Visible for testing, so env-var resolution can be stubbed without touching the real environment. */
    public ConfigLoader(Function<String, String> envLookup) {
        this.envLookup = envLookup;
    }

    public AppConfig load(Path configFile) {
        String raw;
        try {
            raw = Files.readString(configFile);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to read config file: " + configFile, e);
        }
        return loadFromString(raw);
    }

    public AppConfig loadFromString(String yaml) {
        String resolved = resolvePlaceholders(yaml);
        ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
        AppConfig config;
        try {
            config = mapper.readValue(resolved, AppConfig.class);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to parse config YAML", e);
        }
        config.validate();
        return config;
    }

    String resolvePlaceholders(String input) {
        Matcher matcher = PLACEHOLDER.matcher(input);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1);
            String defaultValue = matcher.group(3);
            String value = envLookup.apply(varName);
            if (value == null) {
                if (defaultValue != null) {
                    value = defaultValue;
                } else {
                    throw new IllegalArgumentException(
                            "environment variable '" + varName + "' referenced in config is not set");
                }
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);
        return result.toString();
    }
}
