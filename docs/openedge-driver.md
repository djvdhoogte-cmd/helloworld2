# Installing the Progress OpenEdge JDBC driver

Progress does not publish the OpenEdge JDBC driver to Maven Central - it's licensed software that
ships with your OpenEdge client or DataServer installation, so this project cannot depend on it
directly. You install it once into a local (or company-internal) Maven repository, then enable a
dependency declaration that's commented out in `pom.xml`.

## 1. Locate the driver jar

On a machine with the OpenEdge client, Progress DataServer, or ODBC/JDBC driver package
installed, look under the OpenEdge install directory (commonly referred to as `$DLC`):

```
$DLC/java/openedge.jar     # OpenEdge SQL/JDBC driver, OpenEdge 11.x and later
```

The exact jar name/location can vary by OpenEdge version and platform - consult your OpenEdge
DataServer / SQL access documentation if `openedge.jar` isn't present.

## 2. Install it into your Maven repository

```bash
mvn install:install-file \
  -Dfile=/path/to/openedge.jar \
  -DgroupId=com.progress \
  -DartifactId=openedge-jdbc \
  -Dversion=11.7 \
  -Dpackaging=jar
```

Adjust `-Dversion` to match your OpenEdge release. If you have a shared/company Maven repository
(Nexus, Artifactory, etc.), deploy it there instead of your local `~/.m2` so every machine running
this tool can resolve it without a manual install step.

## 3. Enable the dependency

Uncomment the `com.progress:openedge-jdbc` dependency block in `pom.xml` (matching the version you
installed), then rebuild:

```bash
mvn -q package
```

## 4. Driver class and JDBC URL

The OpenEdge JDBC driver class is typically `com.ddtek.jdbc.openedge.OpenEdgeDriver` (DataDirect-based
driver) or `progress.sql.jdbc.JdbcProgressDriver` on older releases; modern JDBC drivers register
themselves automatically via `META-INF/services`, so you generally don't need to load the class by
name. A typical JDBC URL looks like:

```
jdbc:datadirect:openedge://<host>:<port>;databaseName=<db-name>
```

Confirm the exact driver class and URL format against the version of OpenEdge you're connecting
to - Progress has shipped a few different JDBC driver generations over the years.
