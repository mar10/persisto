# persisto
[![GitHub version](https://img.shields.io/github/release/mar10/persisto.svg)](https://github.com/mar10/persisto/releases/latest)
[![Build Status](https://travis-ci.org/mar10/persisto.svg?branch=master)](https://travis-ci.org/mar10/persisto)
[![npm](https://img.shields.io/npm/dm/persisto.svg)](https://www.npmjs.com/package/persisto)
[![jsDelivr](https://data.jsdelivr.com/v1/package/npm/persisto/badge)](https://www.jsdelivr.com/package/npm/persisto)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Released with: grunt-yabs](https://img.shields.io/badge/released%20with-grunt--yabs-yellowgreen)](https://github.com/mar10/grunt-yabs)
[![StackOverflow: persisto](https://img.shields.io/badge/StackOverflow-persisto-blue.svg)](https://stackoverflow.com/questions/tagged/persisto)

> Persistent JavaScript objects and web forms using Web Storage.

**Features**

  1. Persist JavaScript objects (`{...}`) to
     [`localStorage` / `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).<br>
     Use the `get()`/`set()` API for direct (even nested) access, avoiding the
     need to convert from/to JSON.
  2. Cache access to
     [`localStorage` / `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
     (deferred writing appears to be 10-15 times faster).
  3. Make JavaScript objects editable in HTML forms.<br>
     A simple naming convention maps data properties to form elements.<br>
     Listen for input change events and automatically store data.
  4. Optionally synchronize the data with a remote endpoint.


[API Documentation](https://mar10.github.io/persisto/)

Overview:

![sample](https://rawgit.com/mar10/persisto/no-jquery-ts/assets/architecture.png?raw=true)


Requirements:

  - <strike>jQuery</strike> not required since v2.0
  - Recent major browser (Internet Explorer is **not** supported!)

Requirements for version 1.x:

  - jQuery
  - IE 8+ or any recent major browser


## Usage

[Download the latest persisto.js](https://github.com/mar10/persisto/releases)
or include directly from CDN: [![](https://data.jsdelivr.com/v1/package/npm/persisto/badge)](https://www.jsdelivr.com/package/npm/persisto) or
[UNPKG](https://unpkg.com/persisto@latest/dist/persisto.min.js):

```html
<script src="//cdn.jsdelivr.net/npm/persisto@1/dist/persisto.min.js"></script>
```

then instantiate a `PersistentObject`:

```js
let store = mar10.PersistentObject("mySettings", {
      defaults: {
        theme: "default"
        }
    });
```

`store` now contains the data that was stored in `localStorage.mySettings` if
present. Otherwise, `store` is initialized to the default values that we
passed with the `.defaults` option.

We can access data using `set`, `get`, `remove`, `reset`:

```js
store.get("theme");  // -> 'default'
store.set("owner", {name: "joe", age: 42});
store.set("owner.role", "manager");
store.get("owner.age");  // -> 42
store.remove("owner.age");
// -> store now holds {theme: "default", owner: {name: "joe", role: "manager"}}
```

Every *modifying* operation triggers a deferred commit, so that shortly afterwards
the data is serialized to JSON and written to `localStorage.mySettings`.

**More:**

  * Try the [online example](http://plnkr.co/edit/qcDmvN?p=preview).
  * Run the [unit tests](https://rawgit.com/mar10/persisto/master/test/unit/test-core.html).


## Synchronize Data with HTML Forms

Form input elements can be synchronized with a `PersistentObject` by using two
API calls.
Example:

```js
// Maintain client's preferences and define some defaults:
let settingsStore = mar10.PersistentObject("mySettings", {
        defaults: {
          nickname: "anonymous",
          theme: "default"
          }
      });

// Initialize form elements with current data
settingsStore.writeToForm("#settingsForm");

// Allow users to edit and save settings:
$("#settingsForm").submit(function(event){
  // ... maybe some validations here ...
  settingsStore.readFromForm(this);
  event.preventDefault();
});
```

Supported elements are `<input>` (type text, checkbox, or radio), `<textarea>`,
and `<select>` (single and multivalue).
By convention, the html form **must use element names that match the data properties**.<br>

```html
<form id="settingsForm" action="">
  <label>Nickname:<input name="nickname" type="text" value="" /></label><br>
  <label>Theme:
    <fieldset>
      <label> <input name="theme" type="radio" value="default" /> Standard </label><br>
      <label> <input name="theme" type="radio" value="light" /> Light </label><br>
      <label> <input name="theme" type="radio" value="dark" /> Dark </label>
    </fieldset>
  </label>
  <button type="Submit">Submit</button>
</form>
```

Note also that only fields are synchronized, that already existed in the storage
data. Use the `addNew` option if *all* form fields should be evaluated and create
new properties in the store object:

```js
settingsStore.readFromForm(this, {
  addNew: true
});
```


## Pros and Cons

- Any `PersistentObject` instance is stored as one monolythic JSON string.<br>
  *Persisto* deferres and collates these updates, but modifying a single
  property of a large data object still comes with some overhead.<br>
  Splitting data into several `PersistentObject`s may remedy the problem.<br>
  But if your data model is more like a table with hundredth's of rows, a
  responsive database backend may be a better choice.

- Asynchronous operations bear the risk of potential conflicts.
  There is currently no builtin support for resolving those.


# HOWTOs

### Storing Arrays

Arrays are only a special form of plain JavaScript objects, so we can store and
access them as top level type like this:

```js
let store = mar10.PersistentObject("mySettings", {
				defaults: ["a", "b", "c"]
			});
store.get("[0]");  // 'a'
store.set("[1]", "b2");
```

However if we use child properties, it is even easier:

```js
let store = mar10.PersistentObject("mySettings", {
        defaults: {
          values: ["a", "b", "c"]
        }
      });
store.get("values")[0];  // 'a'
store.get("values[0]");  // 'a'
S.each(store.get("values"), function(idx, obj) { ... });

store.set("values[1]", "b2");
```


### Performance and Direct Access

In general, performance costs of `set()` and `get()` calls should be
neglectable, compared to the resulting synchronization times, but in some cases
direct access of the internal data object may be preferred.<br>
In this case modifications must be signalled by a call to `setDirty()`.

```js
store._data.owner = { name: "joe", age: 42 };
store._data.owner.role = "manager";
delete store._data.owner.age;
store.setDirty();  // schedule a commit
```


### Asynchronous Operation

By default, changed values will be commited to webStorage after a small delay
(see `.commitDelay` option). This allows to collate sequences of multiple changes
into one single write command.

However there are situations, where this is not desirable:

```js
store.set("foo", "bar");

// Page reload would prevent the delayed commit from happen, so we force
// synchronization:
store.commit();

location.reload();
```

An alternative would be to disable delay completely by setting `commitDelay: 0`.


### Synchronize with Remote Endpoints

Optionally, we may specify an endpoint URL that is used to synchronize the data
with a web server using HTTP REST requests (GET and PUT):

```js
let store = mar10.PersistentObject("mySettings", {
        remote: "persist/settings"
      });

$.when(
  // Page must be loaded
  $.ready,
  // PersistentObject must be pulled
  store.ready

).done(function(){
  // Page was loaded and and store has pulled the data from the remote endpoint...
  initPage();

}).fail(function(){
  console.error("Error loading persistent objects", arguments);
});
```


# API Reference

### Options and Events

The following options are available:

https://mar10.github.io/persisto/interfaces/persistooptions.html

### Methods

Following a list of available methods:

https://mar10.github.io/persisto/classes/persistentobject.html
