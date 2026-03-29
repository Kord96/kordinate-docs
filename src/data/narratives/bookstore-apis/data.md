## Test Fixtures {#state.test-data}

Test fixtures are the single source of truth for what data flows into every data-driven test. Four JSON files split along two axes: entity type (books vs. authors) and validity (well-formed POJOs vs. intentionally broken payloads).

The valid files (`booksData.json`, `authorsData.json`) contain typed entities that Jackson deserializes into `Book` and `Author` POJOs via **Test Data Reader**. The invalid files (`booksInvalidData.json`, `authorsInvalidData.json`) use wrong types on purpose -- strings where integers belong -- and the reader loads them as raw `Map<String, Object>` to bypass Jackson's type checking. This dual-path approach means negative tests send genuinely malformed JSON, not Java objects that happen to have null fields.

Adding a new test scenario is a JSON edit, not a code change. The `@DataProvider` methods in **Test Suites** iterate the array automatically.

## Application Config {#state.config}

A single properties file holds the base URL for the **FakeRestAPI**. **Config Loader** reads it once, in a static initializer block, and caches it for the lifetime of the JVM. If the file is missing, the static block throws -- no test will execute with a silently null URL. See the Config Missing failure mode for the full cascade.

This is the only environment-specific value in the entire framework. Switching the suite to target a different API instance is a one-line edit in `config.properties`.

## Allure Results {#state.allure-results}

Every test method produces a JSON result file in `target/allure-results/`. These files capture the step-by-step execution trace -- each `Allure.step()` call in **Test Suites** becomes a named entry with timing data.

The results are ephemeral. They exist only between the test run and the report generation step. The CI Pipeline Execution flow consumes them to produce the final Allure HTML report on **GitHub Pages**.

## Allure Report {#state.allure-report}

The final artifact of every CI run: a static HTML site on the gh-pages branch of **GitHub Pages**. It accumulates history across runs, showing trend lines for pass rates and timing.

`@Issue` annotations from **Test Suites** surface here as linked tags, so the team can distinguish genuine regressions from known **FakeRestAPI** quirks (like DELETE returning 200 for nonexistent IDs). The report is the team's primary feedback channel -- more useful than raw Maven output because it shows the why, not just the what.
