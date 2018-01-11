# tracked-promise

An experimental alternative to retrying assertions.

# What then?

Keeping track of important Promises, at boundaries in the application. When they
are crated they get added to a list. When they are resolved or rejected they
get removed from that list.

When a test needs to wait for all outstanding work to be done, before asserting
about a final state, it can wait for the list of pending promises to be
finished (resolved or rejected).

# Example

```js
const TrackedPromise = require("tracked-promise");

async function exampleAsyncTest() {
  const database = TrackedPromise.createProxy(new Database());
  const serverApp = new ServerApp({ database });
  const browserApp = new BrowserApp({ serverApp });

  // may fail with 'Gave up waiting for: Pending Database.slowOperation()'
  await browserApp.triggerSlowDatabaseOperation();

  // may fail with 'Pending Database.methodThatReturnedTooEarly()'
  await TrackedPromise.waitForPendingPromisesToFinish();
}
```
