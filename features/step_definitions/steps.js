const { Given, When, Then, setDefinitionFunctionWrapper } = require("cucumber");
const assert = require("assert");
const TrackedPromise = require("../../tracked-promise");

setDefinitionFunctionWrapper(TrackedPromise.assertNoPendingPromisesOnReturn);

Given("there is a donut in the database", async function() {
  this._database = TrackedPromise.createProxy(new Database());
  await this._database.createDonut("Sprinkled");
});

When("I visit the home page", async function() {
  this._serverApp = new ServerApp({ database: this._database });
  const port = await this._serverApp.listen();
  this._browserApp = TrackedPromise.createProxy(
    new BrowserApp({
      serverUrl: `http://localhost:${port}`,
      fetcher: TrackedPromise.createProxy(global)
    })
  );
  await this._browserApp.mount();
});

Then("I should see the donut", async function() {
  assert(document.body.innerHTML.indexOf("Sprinkled") > -1);
  assert(document.body.innerHTML.indexOf("Glazed") == -1);
});

When("I add a donut", async function() {
  document.body.querySelector("#add-donut-button").click();
  await TrackedPromise.waitForPendingPromisesToFinish();
});

Then("I should see two donuts", async function() {
  assert(document.body.innerHTML.indexOf("Sprinkled") > -1);
  assert(document.body.innerHTML.indexOf("Glazed") > -1);
});

// App code...

const http = require("http");
const express = require("express");

class ServerApp {
  constructor({ database }) {
    this._database = database;
  }

  listen() {
    const app = express();
    app.get("/donuts.json", (req, res) => {
      this._database.fetchAllTheDonuts().then(donuts => res.json({ donuts }));
    });
    app.post("/donuts", (req, res) => {
      this._database
        .createDonut("Glazed")
        .then(() => res.json({ result: "yum!" }));
    });
    const server = http.createServer(app);
    return new Promise((resolve, reject) => {
      server.listen(0, err => {
        if (err) return reject(err);
        resolve(server.address().port);
      });
    });
  }
}

class Database {
  constructor() {
    this._donuts = [];
  }

  async createDonut(donut) {
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        this._donuts.push(donut);
        resolve();
      }, 2);
    });
  }

  async fetchAllTheDonuts() {
    return await new Promise((resolve, reject) => {
      setTimeout(() => resolve(this._donuts), 2);
    });
  }
}

class BrowserApp {
  constructor({ serverUrl, fetcher }) {
    this._serverUrl = serverUrl;
    this._fetcher = fetcher;
  }

  mount() {
    document.body.innerHTML =
      '<div id="donuts"></div><button id="add-donut-button">Add a donut</button>';
    document
      .querySelector("#add-donut-button")
      .addEventListener("click", () => {
        this.addDonutToServer();
      });
    return this.fetchAllTheDonutsFromTheServer();
  }

  fetchAllTheDonutsFromTheServer() {
    return this._fetcher
      .fetch(this._serverUrl + "/donuts.json")
      .then(response => response.json())
      .then(json => {
        document.querySelector("#donuts").innerHTML = json.donuts.join(", ");
      });
  }

  addDonutToServer() {
    return this._fetcher
      .fetch(this._serverUrl + "/donuts", { method: "POST" })
      .then(() => this.fetchAllTheDonutsFromTheServer());
  }
}
