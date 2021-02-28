var store = new mar10.PersistentObject("test", {
    store: sessionStorage,
    attachForm: "#form1",
    statusElement: "span.persisto-status",
    remote: "https://google.com",
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
    change: function() {
      console.log("persisto.change", arguments)
    },
    commit: function() {
      console.log("persisto.commit", arguments)
    },
    error: function() {
      console.log("persisto.error", arguments)
    },
    push: function() {
      console.log("persisto.push", arguments)
    },
    save: function() {
      console.log("persisto.save")
      document.querySelector("#stats").innerHTML = "" + this.commitCount + " commits"
    },
    status: function(status) {
      console.log("persisto.status: " + status)
    }
  });


document.addEventListener("DOMContentLoaded", function(event) {
  document.querySelector("#form1").addEventListener("submit", function(e){
    store.readFromForm("#form1");
    e.preventDefault();
  });
  store.writeToForm("#form1");
});
