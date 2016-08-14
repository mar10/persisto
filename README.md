# persisto [![GitHub version](https://badge.fury.io/gh/mar10%2Fpersisto.svg)](https://github.com/mar10/persisto/releases/latest) [![Build Status](https://travis-ci.org/mar10/persisto.svg?branch=master)](https://travis-ci.org/mar10/persisto)

> Persistent Javascript objects and web forms using Web Storage.

Features

  - Persist Javascript objects (`{...}`) to 
    [`localStorage` / `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).<br>
    Use the `get()`/`set()` API for direct (even nested) access, hiding the need
    to convert from/to JSON.
  - Cache access to
    [`localStorage` / `sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
    (deferred writing appears to be 10-15 times faster) and remote backends.
  - Make Javascript objects editable in HTML forms.<br>
    Common use case: maintain persistent client settings and let users edit them.
  - Optionally synchronize the data with a remote endpoint


Overview:

![sample](doc/architecture.png?raw=true)


Requirements:

  - jQuery
  - IE 8+ or any recent major browser


## Usage

[Download the latest persisto.js](https://github.com/mar10/persisto/releases) 
or include directly [from CDN](https://www.jsdelivr.com/projects/persisto):

```html
  <script src="//cdn.jsdelivr.net/persisto/1/persisto.min.js"></script>
```

then instantiate a `PersistentObject`:

```js
var store = PersistentObject("mySettings", {
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
  * Run the [unit tests](http://rawgit.com/mar10/persisto/master/test/unit/test-core.html).


## Synchronize Data with HTML Forms

Form input elements can be synchronized with a `PersistentObject` by using two
API calls.
Example:

```js
// Maintain client's preferences and define some defaults:
var settingsStore = PersistentObject("mySettings", {
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

Arrays are only a special form of plain Javascript objects, so we can store and
access them as top level type like this:

```js
var store = PersistentObject("mySettings", {
				defaults: ["a", "b", "c"]
			});
store.get("[0]");  // 'a'
store.set("[1]", "b2");
```

However if we use child properties, it is even easier:

```js
var store = PersistentObject("mySettings", {
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
commit();

location.reload();
```

An alternative would be to disable delay completely by setting `commitDelay: 0`.


### Synchronize with Remote Endpoints

Optionally, we may specify an endpoint URL that is used to synchronize the data
with a web server using HTTP REST requests (GET and PUT):

```js
var store = PersistentObject("mySettings", {
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

### Options

The following options are available:

<dl>
<dt>commitDelay</dt>
<dd>
    Type: <code>int</code>, 
    default: <code>500</code> milliseconds<br>
    Commit changes after 0.5 seconds of inactivity.<br>
    This means, after each change, we wait 0.5 more seconds for additional changes
    to come in, before the actual commit is executed.<br>
    The total delay (first change until actual commit) is limited `maxCommitDelay`.<br>
    Set to <code>0</code> to force synchronous mode.
</dd>
<dt>debugLevel</dt>
<dd>
    Type: <code>int</code>, 
    default: <code>1</code><br>
    Verbosity level: 0:quiet, 1:normal, 2:verbose.
</dd>
<dt>defaults</dt>
<dd>
    Type: <code>object</code>, 
    default: <code>{}</code><br>
    Default value if no data is found in localStorage.
</dd>
<dt>maxCommitDelay</dt>
<dd>
    Type: <code>int</code>, 
    default: <code>3000</code> milliseconds<br>
    Commit changes max. 3 seconds after first change.
</dd>
<dt>maxPushDelay</dt>
<dd>
    Type: <code>int</code>, 
    default: <code>30000</code> milliseconds<br>
    Push commits to remote max. 30 seconds after first change.
</dd>
<dt>pushDelay</dt>
<dd>
    Type: <code>int</code>, 
    default: <code>5000</code> milliseconds<br>
    Push commits to remote after 5 seconds of inactivity. 
    Set to <code>0</code> to force synchronous mode.
</dd>
<dt>remote</dt>
<dd>
    Type: <code>string</code>, 
    default: <code>null</code><br>
    URL for GET/PUT request. Pass `null` to disable remote synchronization.
</dd>
<dt>storage</dt>
<dd>
    Type: <code>object</code>, 
    default: <code>window.localStorage</code><br>
    Instance of [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).<br>
    Possible values are `window.localStorage`, `window.sessionStorage`.<br>
    Pass `null` to disable persistence.
</dd>
</dl>


### Methods

Following a list of available methods:

<dl>
<dt>commit()</dt>
<dd>
    Write modified data to localStorage.<br>
    (Normally there is no need to call this method, since it is triggered internally
    after a short collation interval.)
</dd>
<dt>get(key)</dt>
<dd>
    Return a data property value (`key` supports dot notation).
</dd>
<dt>isDirty()</dt>
<dd>
    Return *true* if there are uncommited or unpushed modifications.
</dd>
<dt>isReady()</dt>
<dd>
    Return true if initial pull has completed.<br>
    See also the `store.ready` promise, that is resolved accordingly.
</dd>
<dt>pull()</dt>
<dd>
    Download  data from the cloud, then call `.update()`.
</dd>
<dt>push()</dt>
<dd>
    Commit, then upload data into the cloud.<br>
    (Normally there is no need to call this method, since it is triggered internally.)
</dd>
<dt>readFromForm(form, [options])</dt>
<dd>
    Read data properties from form input elements with the same name.<br>
    Supports elements of input (type: text, radio, checkbox), textarea,
    and select.<br>
    *form* may be a form selector or jQuery object. Example: `"#myForm"`.<br>
    *options* is optional and defaults to <code>{addNew: false, coerce: true, trim: true}</code>.
</dd>
<dt>remove(key)</dt>
<dd>
    Delete object property and set the `dirty` flag (`key` supports dot notation).
</dd>
<dt>reset(newData)</dt>
<dd>
    Replace data object with a new instance and set the `dirty` flag.
    *newData* is optional and defaults to <code>{}</code>.
</dd>
<dt>set(key, value)</dt>
<dd>
    Modify object property and set the `dirty` flag (`key` supports dot notation).<br>
    *value* must be [convertible to JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify).
</dd>
<dt>setDirty()</dt>
<dd>
    Flag object as *modified*, so that commit / push will be scheduled.
</dd>
<dt>update()</dt>
<dd>
    Load data from localStorage.
</dd>
<dt>writeToForm(form)</dt>
<dd>
    Write data to form elements with the same name.<br>
    *form* may be a form selector or jQuery object. Example: `"#myForm"`.
</dd>
</dl>


### Events

Events may be handled by passing a handler callback option:

```js
store = PersistentObject("mySettings", {
          [...]
          change: function(hint){
            alert("Store " + this + " was changed. Reason: " + hint);
          }
        });
```

**Note:**
Events are not yet finally implemented and subject to change!

This is what we have so far:
```js
{
    change: $.noop,
    commit: $.noop,
    conflict: $.noop,
    error: $.noop,
    pull: $.noop,
    push: $.noop,
    ready: PROMISE
    update: $.noop
}
```


<!--
Following a list of available events:

<dl>
<dt>change(hint)</dt>
<dd>
    Triggered just before the popup menu is opened.<br>
    Return <code>false</code> to prevent opening.<br>
    This is also a good place to modify the menu (i.e. hiding, disabling, or
    renaming entries, or replace the menu altogether).
</dd>
</dd>
</dl>
-->