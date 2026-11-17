# Image "un seul service" pour PaaS (Railway, Render, Fly...) : Angular servi par Spring Boot.
# (Le deploiement Docker Compose avec nginx reste disponible : docker-compose.yml)

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npx ng build --configuration production

FROM eclipse-temurin:21-jdk AS api
WORKDIR /src
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY backend/src src
COPY --from=web /web/dist/frontend/browser src/main/resources/static
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 1001 app && mkdir -p /data/media /app/data && chown -R app /data /app
COPY --from=api /src/target/formation-api-*.jar app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod \
    APP_MEDIA_DIR=/data/media \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
