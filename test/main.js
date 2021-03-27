document.addEventListener("DOMContentLoaded", function (event) {
  var store = new mar10.PersistentObject("test", {
    store: sessionStorage,
    attachForm: "#form1",
    statusElement: "span.persisto-status",
    // Local test with `wsgidav --config test/wsgidav.yaml`
    // Then launch `http://127.0.0.1:8081/test/index.html`
    remote: "http://127.0.0.1:8081/test/fixtures/store.json",
    debugLevel: 2,
    defaults: {
      title: "foo",
      details: "bar\nbaz",
      isFavorite: true,
      status: "active",
      attributes: ["opt3"],
      color: "blue",
      tags: ["lame", "hot"],
    },
    change: function () {
      console.log("persisto.change", arguments);
    },
    commit: function () {
      console.log("persisto.commit", arguments);
    },
    error: function () {
      console.log("persisto.error", arguments, this);
    },
    push: function () {
      console.log("persisto.push", arguments);
    },
    save: function () {
      console.log("persisto.save");
      document.querySelector("#stats").textContent =
        "" + this.commitCount + " commits.";
    },
    status: function (status) {
      console.log("persisto.status: " + status);
    },
  });

  store.ready
    .then((value) => {
      console.log(store + ":  is initialized.");
      // document.querySelector("#form1").addEventListener("submit", function (e) {
      //   store.readFromForm("#form1");
      //   e.preventDefault();
      // });
      // store.writeToForm("#form1");
    })
    .catch((reason) => {
      console.log(store + ": init failed.");
    });
});
