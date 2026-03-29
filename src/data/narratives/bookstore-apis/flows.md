## Local Test Execution {#flow.test-execution}

A **QA Engineer** kicks off `mvn clean test`. Maven Surefire reads the suite definition in **Test Runner Config** and discovers **Test Suites** -- BookTests and AuthorTests.

Each test class loads the base URL on first access. **Config Loader** reads `config.properties` from the classpath in a static initializer block, returning `https://fakerestapi.azurewebsites.net/`. If that file is missing, the class refuses to load -- fail-fast, no silent null.

**Test Suites** call **Test Data Reader** through TestNG's `@DataProvider` mechanism. The reader has two paths: `readData` deserializes classpath JSON into typed `Book[]` or `Author[]` POJOs, while `readInvalidData` reads filesystem JSON into raw `List<Map>` -- intentionally untyped so the malformed payloads pass through without Jackson rejecting them.

With data in hand, each test constructs a URL and calls **HTTP Client**. RestAssuredUtils wraps RestAssured's fluent API into five static methods -- one per HTTP verb. The call hits **FakeRestAPI** on Azure, and the response comes back for assertion.

TestNG's `assertEquals` checks status codes and body fields. Each step is wrapped in `Allure.step()` calls, so the report shows exactly what happened at each phase -- not just pass or fail, but the story of each request.

## CI Pipeline Execution {#flow.ci-execution}

A push lands on any branch and **GitHub Actions** wakes up. The workflow checks out the code and provisions JDK 21 (Zulu distribution) on an ubuntu-latest runner.

**CI Pipeline** runs `mvn clean install`, which compiles the test code and hands off to Surefire. Every test in **Test Suites** executes -- the same flow as local execution, but unattended. The POM sets `testFailureIgnore=true`, so even if tests fail the build continues. That is deliberate: the point is to always produce a report, not to gate on green.

After tests finish, the pipeline generates an Allure report. It fetches the previous report history from the gh-pages branch (with `continue-on-error`, because that branch may not exist yet on a fresh repo), merges in the new results, and publishes the combined HTML report to **GitHub Pages**. The team gets trend lines, step-level detail, and `@Issue` annotations -- all without opening an IDE.
