const util = require("util");

class TrackedPromise {
  constructor(innerPromise, name) {
    this._innerPromise = innerPromise;
    this._name = name;
    this._id = globalCounter++;
    globalPendingCount++;
    globalPendingErrors[this._id] = new Error("Pending " + this._name);
    let inner = this._innerPromise;
    while (inner._innerPromise) inner = inner._innerPromise;
    inner.then(result => {
      return new Promise((resolve, reject) => {
        this.untrack();
        resolve(result);
      });
    });
  }

  then(onResolve, onReject) {
    return new TrackedPromise(
      this._innerPromise.then(onResolve, onReject),
      this._name + ".then(" + onResolve.toString() + ")"
    );
  }

  untrack() {
    delete globalPendingErrors[this._id];
    globalPendingCount--;
    if (globalPendingCount === 0) {
      globalWaiters.forEach(resolve => resolve());
    }
  }

  static createProxy(target) {
    const proxy = {};
    methodsOf(target).forEach(methodName => {
      proxy[methodName] = TrackedPromise.wrapMethod(target, methodName);
    });
    return proxy;
  }

  static wrapMethod(target, property) {
    return (...args) => {
      const result = target[property].call(target, ...args);
      if (typeof result == "object" && typeof result.then == "function") {
        const inspectedArgs = args.map(arg => util.inspect(arg)).join(", ");
        const name =
          target.constructor.name + "." + property + "(" + inspectedArgs + ")";
        return new TrackedPromise(result, name);
      }
      return result;
    };
  }

  static waitForPendingPromisesToFinish(waitMilliseconds = 500) {
    if (globalPendingCount === 0) {
      return Promise.resolve();
    }
    const giveUpError = new Error();
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        giveUpError.message =
          "Gave up waiting for:\n" +
          Object.values(globalPendingErrors)
            .map(e => e.message + "\n" + cleanStack(e.stack))
            .join("\n");
        reject(giveUpError);
      }, waitMilliseconds);
      globalWaiters.push(resolve);
    });
  }

  static assertNoPendingPromises() {
    const stacks = Object.values(globalPendingErrors).map(e =>
      cleanStack(e.stack)
    );
    if (stacks.length > 0)
      throw new Error("Pending promises:\n" + stacks.join("\n"));
  }

  static assertNoPendingPromisesAfter(fn) {
    return async function(...args) {
      const result = fn.call(this, ...args);
      if (typeof result === "object" && typeof result.then === "function") {
        return result.then(() => TrackedPromise.assertNoPendingPromises());
      } else {
        return TrackedPromise.assertNoPendingPromises();
      }
    };
  }
}

let globalCounter = 0;
let globalPendingCount = 0;
const globalPendingErrors = {};
const globalWaiters = [];

function methodsOf(obj) {
  if (obj === window) return ["fetch"];
  return Object.getOwnPropertyNames(obj.constructor.prototype).filter(
    prop => prop !== "constructor" && typeof obj[prop] === "function"
  );
}

function cleanStack(stack) {
  return stack
    .split("\n")
    .slice(1)
    .filter(line => line.indexOf(__filename) == -1)
    .join("\n");
}

module.exports = TrackedPromise;
