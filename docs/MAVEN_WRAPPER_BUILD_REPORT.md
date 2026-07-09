# Maven Wrapper Build Report

Date: July 9, 2026

## Summary

The backend no longer depends on a globally installed Maven executable. Maven Wrapper-compatible scripts are now included under `backend`, and CI/build documentation uses the backend wrapper.

## Maven Wrapper Status

Maven Wrapper did not previously exist under `backend`.

Added wrapper files:

- `backend/mvnw`
- `backend/mvnw.cmd`
- `backend/.mvn/wrapper/maven-wrapper.properties`

The wrapper downloads Apache Maven 3.9.9 into `backend/.mvn/wrapper/dists/` when needed. That local distribution cache is ignored by git.

## BOM Verification

UTF-8 BOM verification was completed for Java source files under `backend/src/main/java/com/kravia/companyos`.

Result:

- `BOM_COUNT=0`
- `BAD_PACKAGE_START_COUNT=0`

Every checked Java file starts directly with `package com.kravia.companyos...`.

## CI Status

GitHub Actions now uses:

- Java 21 through `actions/setup-java@v4`
- Maven dependency caching with `cache: maven`
- `./mvnw clean verify` from the `backend` working directory

## Local Verification

Wrapper smoke test completed successfully:

```bash
./mvnw -v
```

Observed result:

- Apache Maven 3.9.9 bootstrapped from `backend/.mvn/wrapper/dists`
- No global Maven installation was required

Full backend verification was not executed locally because this Codex environment has Java 17, while the backend targets Java 21. Run the full backend verification in a Java 21 environment:

```bash
cd backend
./mvnw clean verify
```

## Remaining Blockers

- Local Codex Java runtime is Java 17, not Java 21.
- The repository is prepared for Java 21 environments and CI to build through Maven Wrapper without global Maven.
