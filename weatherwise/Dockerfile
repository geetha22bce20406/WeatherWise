# --- Stage 1: Build ---
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

# Copy dependency configuration first to leverage Docker layer caching
COPY pom.xml .

# Download dependencies in Batch Mode (-B suppresses progress log spam)
RUN mvn dependency:go-offline -B

# Copy source code and build application binary
COPY src ./src
RUN mvn package -DskipTests -B

# --- Stage 2: Runtime ---
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy built JAR from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose app port and run
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
