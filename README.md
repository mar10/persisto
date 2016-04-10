# persisto

> Persistent objects for Javascript.


*persisto* features

  - Persist Javascript objects (`{...}`) or arrays (`[...]`) to 
    [`localStorage` / `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).<br>
    Use the `get()`/`set()` API for direct (even nested) access, hiding the need
    to convert from/to JSON.
  - Cache access to
    [`localStorage` / `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
    (deferred writing appears to be 10-15 times faster)
  - Convert HTML form input elements into a Javascript object and vice versa
  - Optionally synchronize the data with a remote endpoint


![sample](architecture.png?raw=true)


Requirements:

  - jQuery
  - Tested with Safari 9


## Usage

```js
var store = PersistentObject("mySettings");
```

`store` now contains the data that was stored in `localStorage.mySettings` if 
present. Otherwise, `store` is initialized to `{}`.

We can access data using `set`, `get`, `remove`, `reset`:

```js
store.set("owner", {name: "joe", age: 42});
store.set("owner.role", "manager");
store.get("owner.age");  // -> 42
store.remove("owner.age");
// -> store now holds {owner: {name: "joe", role: "manager"}}
```

Every *modifying* operation triggers a deferred commit, so that shortly afterwards
the data is serialized to JSON and written to `localStorage.mySettings`.

Optionally, we may specify an endpoint URL that is used to synchronize the data
with a web server using HTTP REST requests (GET and PUT):

```js
var store = PersistentObject("mySettings", {
				remote: "persist/settings"
			});
```

The data flows like so

| Script         |           | localStorage       |         |  Web Server  |
| -------------- |:---------:| ------------------ |:-------:| ------------ |
| { foo: "bar" } | commit -><br><- update | `'{"foo": "bar"}'` | push -><br><-pull |  PUT<br>GET         |


## Synchronize Data with HTML Forms

Form input elements can be synchronized with a `PersistentObject` by using two
API calls.
Example:

```js
// Define a 
var settingsStore = PersistentObject("mySettings", {
        init: {
          nickname: "anonymous",
          theme: "default"
          }
      });

// Initialize form elements with current data
settingsStore.writeToForm("#settingsForm");

// Allow to edit settings
$("#settingsForm").submit(function(e){
  // ... maybe some validations here ...
  settingsStore.readFromForm(this);
  e.preventDefault();
});
```

Supported elements are `&lt;input>` (type text, checkbox, or radio), `&lt;textarea>`,
and `&lt;select>` (single and multivalue).
By convention, the html form **must use element names that match the data properties**.<br>
Note also that only fields are synchronized, that already existed in the storage
data.

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


## Pros and Cons

- Any `PersistentObject` instance is stored as one monolythic JSON string.<br>
  *Persisto* deferres and collates these updates, but modifying a single 
  property of a large data object still comes with some overhead.<br>
  Splitting data into several `PersistentObject`s may remedy the problem.<br>
  But if your data model is more like a table with hundredth's of rows, a 
  responsive database backend may be a better choice.

- Asynchounus operations and potential conflicts


# HOWTOs

### Arrays

Arrays are only a special form of plain Javascript objects, so we can store and
access them like this:

```js
var store = PersistentObject("mySettings", {
				init: ["a", "b", "c"]
			});
store.set("[1]", "b2");
```


### Performance and direct access 

In general, performance penalty of `set()` and `get()` calls should be 
neglectable, compared to the resulting synchronization times, but in some cases 
direct access of the internal data object may be preferred.<br>
In this case modifications must be signalled by a call to `setDirty()`.

```js
store._data.owner = {name: "joe", age: 42});
store._data.owner.role = "manager";
delete store._data.owner.age;
store.setDirty();  // trigger commit
```


# API Reference

### Options

**(TODO)**

```js
{
    remote: null,          // URL for GET/PUT, ajax options, or callback
    init: {},              // default value if no data is found in localStorage
    commitDelay: 500,      // commit changes after 0.5 seconds of inactivity
    maxCommitDelay: 3000,  // commit changes max. 3 seconds after first change
    pushDelay: 5000,       // push commits after 5 seconds of inactivity
    maxPushDelay: 30000,   // push commits max. 30 seconds after first change
    debug: 2,              // 0:quiet, 1:normal, 2:verbose
    storage: window.localStorage,
}
```


### Events

**(TODO)**

```js
{
    change: $.noop,
    commit: $.noop,
    conflict: $.noop,
    error: $.noop,
    pull: $.noop,
    push: $.noop,
    update: $.noop
}
```


### Methods

**(TODO)**
