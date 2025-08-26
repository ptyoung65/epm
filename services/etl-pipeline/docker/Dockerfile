# Multi-stage Dockerfile for AIRIS ETL Pipeline
FROM maven:3.9-eclipse-temurin-11-alpine AS build

WORKDIR /app

# Copy pom.xml first for dependency caching
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM flink:1.18.0-scala_2.12-java11

# Set environment variables
ENV FLINK_HOME=/opt/flink
ENV JAVA_OPTS="-Xmx2g -Xms1g"

# Create application directory
WORKDIR /opt/airis-etl

# Copy the built JAR from build stage
COPY --from=build /app/target/etl-pipeline-1.0.0.jar ./airis-etl-pipeline.jar

# Copy configuration files
COPY src/main/resources/application.conf ./conf/
COPY docker/entrypoint.sh ./

# Create logs directory
RUN mkdir -p logs

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Expose ports
EXPOSE 8081 9090 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set entrypoint
ENTRYPOINT ["./entrypoint.sh"]

# Default command
CMD ["standalone"]

# Labels
LABEL maintainer="AIRIS EPM Team <support@airis-epm.com>"
LABEL description="AIRIS EPM Real-time ETL Pipeline"
LABEL version="1.0.0"
LABEL service="etl-pipeline"