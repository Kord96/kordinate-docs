## FakeRestAPI Goes Down {#failure.sut-unavailable}

At any hour, the Azure-hosted **FakeRestAPI** starts returning 503s or drops connections entirely. **HTTP Client** is a thin facade with no timeout, retry, or circuit breaker -- RestAssured throws a `ConnectionException` or the response comes back with an unexpected status code.

All 23 tests in **Test Suites** fail with assertion errors. But the build still passes -- `testFailureIgnore=true` in the POM means **CI Pipeline** exits 0 regardless. The Allure report on **GitHub Pages** shows a wall of red, but there is no alert. Someone has to look.

This is the framework's biggest blind spot. There is no smoke test or health-check step before the full suite. A single curl to the API's index page would distinguish "API is down" from "our tests have a bug." Until that guard exists, a 100% failure report is ambiguous.

## Test Data Missing {#failure.test-data-missing}

Someone renames `booksData.json` or introduces a trailing comma. **Test Data Reader** tries to load the fixture and Jackson throws -- either `FileNotFoundException` wrapped in a `RuntimeException`, or a `JsonParseException` from malformed syntax.

The failure hits at DataProvider initialization, before any HTTP call fires. TestNG marks every data-driven test method as failed -- that is 14 of 23 tests across both BookTests and AuthorTests. The remaining 9 tests (static ones like `getAllBooks`, `getBookById`, `patchBook`) still run normally.

Recovery is a `git checkout -- src/test/resources/data/`. A JSON linter in the pre-commit hook would catch this before it reaches CI -- see the FakeRestAPI Goes Down failure for why CI alone does not surface the difference clearly.

## Config Missing {#failure.config-missing}

**Config Loader** uses a static initializer block. If `config.properties` is not on the classpath, the block throws `RuntimeException("config.properties not found in resources folder")`. The JVM wraps this in an `ExceptionInInitializerError`.

Both `BookTests` and `AuthorTests` reference `ConfigReader.get("base.url")` as a field initializer. When ConfigReader fails to load, every test class that touches it also fails to load. Zero tests run. The Allure report is empty -- not red, empty.

This is actually well-designed. A missing config file is a broken environment, not a test failure. Fail-fast surfaces the problem immediately instead of producing 23 confusing NullPointerExceptions.

## SUT Behavior Regression {#failure.sut-behavior-regression}

**FakeRestAPI** is a third-party mock API. Its behavior drifts. Known example: DELETE with a nonexistent ID returns 200 instead of 404. PUT with an invalid ID returns the wrong status code. **Test Suites** tag these with `@Issue` annotations -- a deliberate record that the test expects standard behavior but the API deviates.

When these tests fail, the Allure report shows the `@Issue` tag so the reviewer knows this is a documented quirk, not a new bug. But if the API changes its behavior again -- fixing the quirk, or introducing a new one -- the `@Issue` annotation becomes stale.

The distinction matters: a test that fails with an `@Issue` tag is "known flaky." A test that fails without one is "investigate immediately." Keeping those tags current is a manual discipline, not an automated check.
