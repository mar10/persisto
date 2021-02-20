var store = new mar10.PersistentObject("test", {
  // remote: "service/settings.json",
  store: sessionStorage,
  defaults: {
    title: "foo",
    details: "bar\nbaz",
    isFavorite: true,
    status: "active",
    attributes: ["opt3"],
    color: "blue",
    tags: ["lame", "hot"],
  }
});
document.addEventListener("DOMContentLoaded", function(event) {
  document.querySelector("#form1").addEventListener("submit", function(e){
    store.readFromForm("#form1");
    e.preventDefault();
  });
  store.writeToForm("#form1");
});
