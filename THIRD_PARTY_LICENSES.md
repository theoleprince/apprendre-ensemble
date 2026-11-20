# Composants tiers

Inventaire genere automatiquement (exigence TdR 6 : « composants tiers listés »). Regeneration :

```
cd backend && ./mvnw org.codehaus.mojo:license-maven-plugin:2.4.0:add-third-party -Dlicense.excludedScopes=test,provided
cd frontend && npx license-checker-rseidelsohn --production --csv --excludePrivatePackages
```

Code de la plateforme : **Apache-2.0** (fichier `LICENSE`). Composants a licence LGPL (JasperReports) : utilises comme bibliotheques non modifiees, compatibles avec une distribution sous Apache-2.0 et avec l'octroi de licences commerciales.

## Synthese par licence

| Licence | Composants |
|---|---|
| Apache License, Version 2.0 | 77 |
| The Apache Software License, Version 2.0 | 50 |
| Apache-2.0 | 15 |
| MIT | 12 |
| The Apache License, Version 2.0 | 9 |
| Eclipse Distribution License - v 1.0 | 5 |
| GNU Lesser General Public License | 5 |
| Apache License 2.0 | 4 |
| The MIT License | 3 |
| EPL-2.0 / LGPL-2.1-only | 2 |
| EDL 1.0 | 2 |
| EPL 2.0 / GPL2 w/ CPE | 2 |
| EDL 1.0 / EPL 2.0 / GPL2 w/ CPE | 2 |
| BSD-3-Clause | 2 |
| Eclipse Public License - v 2.0 | 2 |
| The BSD 3-Clause License (BSD3 | 1 |
| BSD 3-clause License w/nuclear disclaimer | 1 |
| Apache 2.0 | 1 |
| EPL 1.0 / MPL 2.0 | 1 |
| Apache License, version 2.0 | 1 |
| Eclipse Distribution License v. 1.0 / Eclipse Public License v. 2.0 | 1 |
| The BSD 2-Clause License | 1 |
| BSD-2-Clause / Public Domain, per Creative Commons CC0 | 1 |
| Apache License Version 2.0 | 1 |
| BSD-2-Clause | 1 |
| 0BSD | 1 |

## Detail

| Partie | Composant | Identifiant | Licence |
|---|---|---|---|
| backend (Maven) | ) Adobe XMPCore | `com.adobe.xmp:xmpcore:6.1.11` | The BSD 3-Clause License (BSD3 |
| backend (Maven) | ANTLR 4 Runtime | `org.antlr:antlr4-runtime:4.13.2` | BSD-3-Clause |
| backend (Maven) | ASM based accessors helper used by json-smart | `net.minidev:accessors-smart:2.6.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | Angus Activation Registries | `org.eclipse.angus:angus-activation:2.0.3` | EDL 1.0 |
| backend (Maven) | Angus Mail Provider | `org.eclipse.angus:angus-mail:2.0.5` | EDL 1.0 / EPL 2.0 / GPL2 w/ CPE |
| backend (Maven) | Anthropic API | `com.anthropic:anthropic-java-client-okhttp:3.9.0` | Apache-2.0 |
| backend (Maven) | Anthropic API | `com.anthropic:anthropic-java-core:3.9.0` | Apache-2.0 |
| backend (Maven) | Anthropic API | `com.anthropic:anthropic-java:3.9.0` | Apache-2.0 |
| backend (Maven) | Apache Commons BeanUtils | `org.apache.commons:commons-beanutils2:2.0.0-M2` | Apache-2.0 |
| backend (Maven) | Apache Commons Collections | `org.apache.commons:commons-collections4:4.5.0` | Apache-2.0 |
| backend (Maven) | Apache Commons IO | `commons-io:commons-io:2.17.0` | Apache-2.0 |
| backend (Maven) | Apache Commons Lang | `org.apache.commons:commons-lang3:3.20.0` | Apache-2.0 |
| backend (Maven) | Apache Commons Logging | `commons-logging:commons-logging:1.3.6` | Apache-2.0 |
| backend (Maven) | Apache Log4j API | `org.apache.logging.log4j:log4j-api:2.25.5` | Apache-2.0 |
| backend (Maven) | Apache XML Graphics Commons | `org.apache.xmlgraphics:xmlgraphics-commons:2.11` | The Apache Software License, Version 2.0 |
| backend (Maven) | AspectJ Weaver | `org.aspectj:aspectjweaver:1.9.25.1` | Eclipse Public License - v 2.0 |
| backend (Maven) | Byte Buddy (without dependencies) | `net.bytebuddy:byte-buddy:1.18.15` | Apache License, Version 2.0 |
| backend (Maven) | Checker Qual | `org.checkerframework:checker-qual:3.55.1` | The MIT License |
| backend (Maven) | ClassMate | `com.fasterxml:classmate:1.7.3` | Apache License, Version 2.0 |
| backend (Maven) | Eclipse Compiler for Java(TM) | `org.eclipse.jdt:ecj:3.21.0` | Eclipse Public License - v 2.0 |
| backend (Maven) | H2 Database Engine | `com.h2database:h2:2.4.240` | EPL 1.0 / MPL 2.0 |
| backend (Maven) | HdrHistogram | `org.hdrhistogram:HdrHistogram:2.2.2` | BSD-2-Clause / Public Domain, per Creative Commons CC0 |
| backend (Maven) | Hibernate Models | `org.hibernate.models:hibernate-models:1.1.2` | Apache License Version 2.0 |
| backend (Maven) | Hibernate ORM - hibernate-core | `org.hibernate.orm:hibernate-core:7.4.13.Final` | Apache License, Version 2.0 |
| backend (Maven) | Hibernate Validator Engine | `org.hibernate.validator:hibernate-validator:9.1.5.Final` | Apache License 2.0 |
| backend (Maven) | HikariCP | `com.zaxxer:HikariCP:7.0.2` | The Apache Software License, Version 2.0 |
| backend (Maven) | IntelliJ IDEA Annotations | `org.jetbrains:annotations:13.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | JAXB Core | `org.glassfish.jaxb:jaxb-core:4.0.9` | Eclipse Distribution License - v 1.0 |
| backend (Maven) | JAXB Runtime | `org.glassfish.jaxb:jaxb-runtime:4.0.9` | Eclipse Distribution License - v 1.0 |
| backend (Maven) | JBoss Logging 3 | `org.jboss.logging:jboss-logging:3.6.3.Final` | Apache License 2.0 |
| backend (Maven) | JCIP Annotations under Apache License | `com.github.stephenc.jcip:jcip-annotations:1.0-1` | Apache License, Version 2.0 |
| backend (Maven) | JSON Small and Fast Parser | `net.minidev:json-smart:2.6.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | JSpecify annotations | `org.jspecify:jspecify:1.0.1` | The Apache License, Version 2.0 |
| backend (Maven) | JUL to SLF4J bridge | `org.slf4j:jul-to-slf4j:2.0.20` | MIT |
| backend (Maven) | Jackson datatype: JSR310 | `com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.21.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jackson datatype: jdk8 | `com.fasterxml.jackson.datatype:jackson-datatype-jdk8:2.21.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jackson-annotations | `com.fasterxml.jackson.core:jackson-annotations:2.21` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jackson-core | `com.fasterxml.jackson.core:jackson-core:2.21.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jackson-core | `tools.jackson.core:jackson-core:3.1.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jackson-dataformat-XML | `com.fasterxml.jackson.dataformat:jackson-dataformat-xml:2.21.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jakarta Activation API | `jakarta.activation:jakarta.activation-api:2.1.4` | EDL 1.0 |
| backend (Maven) | Jakarta Annotations API | `jakarta.annotation:jakarta.annotation-api:3.0.0` | EPL 2.0 / GPL2 w/ CPE |
| backend (Maven) | Jakarta Dependency Injection | `jakarta.inject:jakarta.inject-api:2.0.1` | The Apache Software License, Version 2.0 |
| backend (Maven) | Jakarta Mail API | `jakarta.mail:jakarta.mail-api:2.1.5` | EDL 1.0 / EPL 2.0 / GPL2 w/ CPE |
| backend (Maven) | Jakarta Persistence API | `jakarta.persistence:jakarta.persistence-api:3.2.0` | Eclipse Distribution License v. 1.0 / Eclipse Public License v. 2.0 |
| backend (Maven) | Jakarta Validation API | `jakarta.validation:jakarta.validation-api:3.1.1` | Apache License 2.0 |
| backend (Maven) | Jakarta XML Binding API | `jakarta.xml.bind:jakarta.xml.bind-api:4.0.5` | Eclipse Distribution License - v 1.0 |
| backend (Maven) | JasperReports Font Extension | `net.sf.jasperreports:jasperreports-fonts:7.1.1` | GNU Lesser General Public License |
| backend (Maven) | JasperReports JDT | `net.sf.jasperreports:jasperreports-jdt:7.1.1` | GNU Lesser General Public License |
| backend (Maven) | JasperReports Library | `net.sf.jasperreports:jasperreports:7.1.1` | GNU Lesser General Public License |
| backend (Maven) | JasperReports OpenPDF Classic | `net.sf.jasperreports:jasperreports-pdf:7.1.1` | GNU Lesser General Public License |
| backend (Maven) | JasperReports PDF Core | `net.sf.jasperreports:jasperreports-pdf-core:7.1.1` | GNU Lesser General Public License |
| backend (Maven) | Java Advanced Imaging Image I/O Tools API core (standalone) | `com.github.jai-imageio:jai-imageio-core:1.4.0` | BSD 3-clause License w/nuclear disclaimer |
| backend (Maven) | Java JSON Schema Generator | `com.github.victools:jsonschema-generator:4.38.0` | The Apache License, Version 2.0 |
| backend (Maven) | Java JSON Schema Generator Module – jackson | `com.github.victools:jsonschema-module-jackson:4.38.0` | The Apache License, Version 2.0 |
| backend (Maven) | Java JSON Schema Generator Module – swagger (2.x) | `com.github.victools:jsonschema-module-swagger-2:4.38.0` | The Apache License, Version 2.0 |
| backend (Maven) | Kotlin Reflect | `org.jetbrains.kotlin:kotlin-reflect:2.3.21` | Apache-2.0 |
| backend (Maven) | Kotlin Stdlib | `org.jetbrains.kotlin:kotlin-stdlib:2.3.21` | Apache-2.0 |
| backend (Maven) | Kotlin Stdlib Common | `org.jetbrains.kotlin:kotlin-stdlib-common:1.9.10` | The Apache License, Version 2.0 |
| backend (Maven) | Kotlin Stdlib Jdk7 | `org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.3.21` | Apache-2.0 |
| backend (Maven) | Kotlin Stdlib Jdk8 | `org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.3.21` | Apache-2.0 |
| backend (Maven) | Log4j API to SLF4J Adapter | `org.apache.logging.log4j:log4j-to-slf4j:2.25.5` | Apache-2.0 |
| backend (Maven) | Logback Classic Module | `ch.qos.logback:logback-classic:1.5.38` | EPL-2.0 / LGPL-2.1-only |
| backend (Maven) | Logback Core Module | `ch.qos.logback:logback-core:1.5.38` | EPL-2.0 / LGPL-2.1-only |
| backend (Maven) | Nimbus Content Type | `com.nimbusds:content-type:2.3` | The Apache Software License, Version 2.0 |
| backend (Maven) | Nimbus JOSE+JWT | `com.nimbusds:nimbus-jose-jwt:10.9.1` | The Apache Software License, Version 2.0 |
| backend (Maven) | Nimbus LangTag | `com.nimbusds:lang-tag:1.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | OAuth 2.0 SDK with OpenID Connect and Federation extensions | `com.nimbusds:oauth2-oidc-sdk:11.38.2` | Apache License, version 2.0 |
| backend (Maven) | OpenTelemetry Java | `io.opentelemetry:opentelemetry-api:1.62.0` | The Apache License, Version 2.0 |
| backend (Maven) | OpenTelemetry Java | `io.opentelemetry:opentelemetry-common:1.62.0` | The Apache License, Version 2.0 |
| backend (Maven) | OpenTelemetry Java | `io.opentelemetry:opentelemetry-context:1.62.0` | The Apache License, Version 2.0 |
| backend (Maven) | PostgreSQL JDBC Driver | `org.postgresql:postgresql:42.7.14` | BSD-2-Clause |
| backend (Maven) | Project Lombok | `org.projectlombok:lombok:1.18.48` | The MIT License |
| backend (Maven) | Prometheus Metrics Config | `io.prometheus:prometheus-metrics-config:1.7.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | Prometheus Metrics Core | `io.prometheus:prometheus-metrics-core:1.7.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | Prometheus Metrics Exposition Formats | `io.prometheus:prometheus-metrics-exposition-formats:1.7.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | Prometheus Metrics Exposition Text Formats | `io.prometheus:prometheus-metrics-exposition-textformats:1.7.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | Prometheus Metrics Model | `io.prometheus:prometheus-metrics-model:1.7.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | Prometheus Metrics Tracer Common | `io.prometheus:prometheus-metrics-tracer-common:1.7.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | SLF4J API Module | `org.slf4j:slf4j-api:2.0.20` | MIT |
| backend (Maven) | SnakeYAML | `org.yaml:snakeyaml:2.6` | Apache License, Version 2.0 |
| backend (Maven) | Spring AOP | `org.springframework:spring-aop:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Aspects | `org.springframework:spring-aspects:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Beans | `org.springframework:spring-beans:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Context | `org.springframework:spring-context:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Context Support | `org.springframework:spring-context-support:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Core | `org.springframework:spring-core:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Data Core | `org.springframework.data:spring-data-commons:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | Spring Data JPA | `org.springframework.data:spring-data-jpa:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | Spring Expression Language (SpEL) | `org.springframework:spring-expression:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring JDBC | `org.springframework:spring-jdbc:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Object/Relational Mapping | `org.springframework:spring-orm:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Transaction | `org.springframework:spring-tx:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Web | `org.springframework:spring-web:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Spring Web MVC | `org.springframework:spring-webmvc:7.0.10` | Apache License, Version 2.0 |
| backend (Maven) | Stax2 API | `org.codehaus.woodstox:stax2-api:4.2.2` | The BSD 2-Clause License |
| backend (Maven) | TXW2 Runtime | `org.glassfish.jaxb:txw2:4.0.9` | Eclipse Distribution License - v 1.0 |
| backend (Maven) | Woodstox | `com.fasterxml.woodstox:woodstox-core:7.1.1` | The Apache License, Version 2.0 |
| backend (Maven) | XML Commons External Components XML APIs Extensions | `xml-apis:xml-apis-ext:1.3.04` | The Apache Software License, Version 2.0 |
| backend (Maven) | ZXing Core | `com.google.zxing:core:3.5.4` | The Apache Software License, Version 2.0 |
| backend (Maven) | ZXing Java SE extensions | `com.google.zxing:javase:3.5.4` | The Apache Software License, Version 2.0 |
| backend (Maven) | asm | `org.ow2.asm:asm:9.7.1` | BSD-3-Clause |
| backend (Maven) | error-prone annotations | `com.google.errorprone:error_prone_annotations:2.50.0` | Apache 2.0 |
| backend (Maven) | flyway-core | `org.flywaydb:flyway-core:12.4.0` | Apache License, Version 2.0 |
| backend (Maven) | flyway-database-postgresql | `org.flywaydb:flyway-database-postgresql:12.4.0` | Apache License, Version 2.0 |
| backend (Maven) | istack common utility code runtime | `com.sun.istack:istack-commons-runtime:4.1.2` | Eclipse Distribution License - v 1.0 |
| backend (Maven) | jackson-databind | `com.fasterxml.jackson.core:jackson-databind:2.21.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | jackson-databind | `tools.jackson.core:jackson-databind:3.1.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | jackson-module-kotlin | `com.fasterxml.jackson.module:jackson-module-kotlin:2.21.7` | The Apache Software License, Version 2.0 |
| backend (Maven) | jakarta.transaction API | `jakarta.transaction:jakarta.transaction-api:2.0.1` | EPL 2.0 / GPL2 w/ CPE |
| backend (Maven) | jcommander | `org.jcommander:jcommander:1.85` | Apache License, Version 2.0 |
| backend (Maven) | micrometer-commons | `io.micrometer:micrometer-commons:1.17.2` | The Apache Software License, Version 2.0 |
| backend (Maven) | micrometer-core | `io.micrometer:micrometer-core:1.17.2` | The Apache Software License, Version 2.0 |
| backend (Maven) | micrometer-jakarta9 | `io.micrometer:micrometer-jakarta9:1.17.2` | The Apache Software License, Version 2.0 |
| backend (Maven) | micrometer-observation | `io.micrometer:micrometer-observation:1.17.2` | The Apache Software License, Version 2.0 |
| backend (Maven) | micrometer-registry-prometheus | `io.micrometer:micrometer-registry-prometheus:1.17.2` | The Apache Software License, Version 2.0 |
| backend (Maven) | okhttp | `com.squareup.okhttp3:okhttp:4.12.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | okio | `com.squareup.okio:okio-jvm:3.6.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | okio | `com.squareup.okio:okio:3.6.0` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-anim | `org.apache.xmlgraphics:batik-anim:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-awt-util | `org.apache.xmlgraphics:batik-awt-util:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-bridge | `org.apache.xmlgraphics:batik-bridge:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-constants | `org.apache.xmlgraphics:batik-constants:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-css | `org.apache.xmlgraphics:batik-css:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-dom | `org.apache.xmlgraphics:batik-dom:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-ext | `org.apache.xmlgraphics:batik-ext:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-gvt | `org.apache.xmlgraphics:batik-gvt:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-i18n | `org.apache.xmlgraphics:batik-i18n:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-parser | `org.apache.xmlgraphics:batik-parser:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-script | `org.apache.xmlgraphics:batik-script:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-shared-resources | `org.apache.xmlgraphics:batik-shared-resources:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-svg-dom | `org.apache.xmlgraphics:batik-svg-dom:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-util | `org.apache.xmlgraphics:batik-util:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | org.apache.xmlgraphics:batik-xml | `org.apache.xmlgraphics:batik-xml:1.19` | The Apache Software License, Version 2.0 |
| backend (Maven) | spring-boot | `org.springframework.boot:spring-boot:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-actuator | `org.springframework.boot:spring-boot-actuator:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-actuator-autoconfigure | `org.springframework.boot:spring-boot-actuator-autoconfigure:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-autoconfigure | `org.springframework.boot:spring-boot-autoconfigure:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-data-commons | `org.springframework.boot:spring-boot-data-commons:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-data-jpa | `org.springframework.boot:spring-boot-data-jpa:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-flyway | `org.springframework.boot:spring-boot-flyway:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-h2console | `org.springframework.boot:spring-boot-h2console:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-health | `org.springframework.boot:spring-boot-health:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-hibernate | `org.springframework.boot:spring-boot-hibernate:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-http-converter | `org.springframework.boot:spring-boot-http-converter:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-jackson | `org.springframework.boot:spring-boot-jackson:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-jdbc | `org.springframework.boot:spring-boot-jdbc:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-jpa | `org.springframework.boot:spring-boot-jpa:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-mail | `org.springframework.boot:spring-boot-mail:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-micrometer-metrics | `org.springframework.boot:spring-boot-micrometer-metrics:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-micrometer-observation | `org.springframework.boot:spring-boot-micrometer-observation:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-persistence | `org.springframework.boot:spring-boot-persistence:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-security | `org.springframework.boot:spring-boot-security:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-security-oauth2-client | `org.springframework.boot:spring-boot-security-oauth2-client:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-security-oauth2-resource-server | `org.springframework.boot:spring-boot-security-oauth2-resource-server:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-servlet | `org.springframework.boot:spring-boot-servlet:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-sql | `org.springframework.boot:spring-boot-sql:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter | `org.springframework.boot:spring-boot-starter:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-actuator | `org.springframework.boot:spring-boot-starter-actuator:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-data-jpa | `org.springframework.boot:spring-boot-starter-data-jpa:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-flyway | `org.springframework.boot:spring-boot-starter-flyway:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-jackson | `org.springframework.boot:spring-boot-starter-jackson:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-jdbc | `org.springframework.boot:spring-boot-starter-jdbc:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-logging | `org.springframework.boot:spring-boot-starter-logging:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-mail | `org.springframework.boot:spring-boot-starter-mail:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-micrometer-metrics | `org.springframework.boot:spring-boot-starter-micrometer-metrics:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-security | `org.springframework.boot:spring-boot-starter-security:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-security-oauth2-client | `org.springframework.boot:spring-boot-starter-security-oauth2-client:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-security-oauth2-resource-server | `org.springframework.boot:spring-boot-starter-security-oauth2-resource-server:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-tomcat | `org.springframework.boot:spring-boot-starter-tomcat:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-tomcat-runtime | `org.springframework.boot:spring-boot-starter-tomcat-runtime:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-validation | `org.springframework.boot:spring-boot-starter-validation:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-starter-webmvc | `org.springframework.boot:spring-boot-starter-webmvc:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-tomcat | `org.springframework.boot:spring-boot-tomcat:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-transaction | `org.springframework.boot:spring-boot-transaction:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-validation | `org.springframework.boot:spring-boot-validation:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-web-server | `org.springframework.boot:spring-boot-web-server:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-boot-webmvc | `org.springframework.boot:spring-boot-webmvc:4.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-config | `org.springframework.security:spring-security-config:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-core | `org.springframework.security:spring-security-core:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-crypto | `org.springframework.security:spring-security-crypto:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-oauth2-client | `org.springframework.security:spring-security-oauth2-client:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-oauth2-core | `org.springframework.security:spring-security-oauth2-core:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-oauth2-jose | `org.springframework.security:spring-security-oauth2-jose:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-oauth2-resource-server | `org.springframework.security:spring-security-oauth2-resource-server:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | spring-security-web | `org.springframework.security:spring-security-web:7.1.2` | Apache License, Version 2.0 |
| backend (Maven) | standardwebhooks | `com.standardwebhooks:standardwebhooks:1.2.0` | The MIT License |
| backend (Maven) | swagger-annotations | `io.swagger.core.v3:swagger-annotations:2.2.50` | Apache License 2.0 |
| backend (Maven) | tomcat-embed-core | `org.apache.tomcat.embed:tomcat-embed-core:11.0.27` | Apache License, Version 2.0 |
| backend (Maven) | tomcat-embed-el | `org.apache.tomcat.embed:tomcat-embed-el:11.0.27` | Apache License, Version 2.0 |
| backend (Maven) | tomcat-embed-websocket | `org.apache.tomcat.embed:tomcat-embed-websocket:11.0.27` | Apache License, Version 2.0 |
| frontend (npm) | @angular/common@22.2.6 | `@angular/common@22.2.6` | MIT |
| frontend (npm) | @angular/compiler@22.2.6 | `@angular/compiler@22.2.6` | MIT |
| frontend (npm) | @angular/core@22.2.6 | `@angular/core@22.2.6` | MIT |
| frontend (npm) | @angular/forms@22.2.6 | `@angular/forms@22.2.6` | MIT |
| frontend (npm) | @angular/platform-browser@22.2.6 | `@angular/platform-browser@22.2.6` | MIT |
| frontend (npm) | @angular/router@22.2.6 | `@angular/router@22.2.6` | MIT |
| frontend (npm) | @angular/service-worker@22.2.6 | `@angular/service-worker@22.2.6` | MIT |
| frontend (npm) | @standard-schema/spec@1.1.0 | `@standard-schema/spec@1.1.0` | MIT |
| frontend (npm) | rxjs@7.8.2 | `rxjs@7.8.2` | Apache-2.0 |
| frontend (npm) | tslib@2.9.1 | `tslib@2.9.1` | 0BSD |
| frontend (npm) | zod@4.6.6 | `zod@4.6.6` | MIT |
| frontend (npm) | zone.js@0.16.3 | `zone.js@0.16.3` | MIT |
