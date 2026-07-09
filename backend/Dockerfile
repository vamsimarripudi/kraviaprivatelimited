FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY .mvn ./.mvn
COPY mvnw mvnw.cmd ./
COPY pom.xml .
COPY src ./src
RUN chmod +x ./mvnw && ./mvnw clean verify

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN addgroup --system kravia && adduser --system --ingroup kravia kravia
COPY --from=build /workspace/target/companyos-0.1.0.jar /app/companyos.jar
RUN mkdir -p /app/storage/private-documents && chown -R kravia:kravia /app
USER kravia
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/companyos.jar"]
