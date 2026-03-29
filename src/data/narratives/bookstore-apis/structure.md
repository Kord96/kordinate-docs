## Three Boundaries {#overview}

Bookstore-APIs is a test automation framework, not an application. It operates across three boundaries: the test execution layer where **Test Suites** live and run, the support libraries that handle HTTP, data loading, configuration, and domain modeling, and the external world -- a single Azure-hosted **FakeRestAPI** plus GitHub's CI and Pages infrastructure.

The framework validates the FakeRestAPI Bookstore REST endpoints for Books and Authors using 23 data-driven CRUD tests. Every push produces an Allure report on **GitHub Pages** with step-level traceability. The stack is Java 21, RestAssured 5.5.1, TestNG 7.11.0, and Allure 2.29.1 -- all wired together by Maven.

## Test Execution {#test-execution}

**Test Suites** is the center of gravity. BookTests (11 methods) and AuthorTests (12 methods) cover every CRUD verb plus negative cases -- invalid IDs, malformed payloads, unsupported methods like PATCH. Every test method follows the arrange-act-assert pattern, with each phase wrapped in `Allure.step()` calls so the report tells the story of each request, not just pass or fail.

**Test Runner Config** defines suite composition via `testng.xml` and wires in Allure's AspectJ agent through the Maven POM. The POM uses BOM dependency management to keep RestAssured, Jackson, and Allure versions aligned. Surefire runs with `testFailureIgnore=true` -- deliberate, because the Allure report is the deliverable, not a green build.

## Support Stack {#support-libraries}

Four support libraries sit beneath the tests, each with a single job.

**HTTP Client** wraps RestAssured into five static methods -- one per HTTP verb (GET, POST, PUT, DELETE, PATCH) -- so tests never construct requests directly. It sets JSON content type on every call but configures no timeout, retry, or error handling beyond RestAssured's defaults. This is the thinnest layer in the system.

**Test Data Reader** loads JSON fixtures through two paths. `readData` deserializes classpath resources into typed `Book[]` or `Author[]` POJOs via Jackson's `ObjectMapper`. `readInvalidData` reads filesystem JSON into raw `List<Map<String, Object>>` using `TypeReference` -- intentionally untyped so that malformed payloads (strings where integers belong) pass through without Jackson rejecting them. This dual-path design is the key to genuine negative testing.

**Domain Models** are Lombok `@Data` classes mirroring the FakeRestAPI JSON schema. `Book` has id, title, description, pageCount, excerpt, and publishDate. `Author` has id, idBook, firstName, and lastName, with a constructor overload for partial initialization. Lombok generates all the boilerplate -- getters, setters, equals, hashCode, toString.

**Config Loader** reads `config.properties` once, in a static initializer block, and caches the Properties object for the lifetime of the JVM. If the file is missing, the block throws immediately -- see the Config Missing failure mode for why this fail-fast behavior is the right call.

## Data and CI {#data-ci}

**Test Data Fixtures** hold four JSON files split along two axes: entity type (books vs. authors) and validity (well-formed vs. intentionally broken). Adding a new test scenario is a JSON edit, not a code change -- the `@DataProvider` methods iterate the array automatically.

**CI Pipeline** ties the framework together. A GitHub Actions workflow runs `mvn clean install` on every push to any branch, generates an Allure report with historical trend data, and publishes it to **GitHub Pages**. The pipeline fetches the previous report history from gh-pages (with `continue-on-error` for fresh repos), merges in the new results, and deploys. The team gets trend lines, step-level detail, and `@Issue` annotations without opening an IDE.
