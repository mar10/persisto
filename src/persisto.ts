/*!
 * persisto.js
 *
 * Persistent JavaScript objects and web forms using Web Storage.
 *
 * Copyright (c) 2016-2021, Martin Wendt (https://wwWendt.de).
 * Released under the MIT license.
 *
 * @version @VERSION
 * @date @DATE
 */

/*
  TODO:
  - Promise & .ready
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
  - use :scope for querySelectorAll
*/
import { each, error, extend, noop, onEvent, Deferred, MAX_INT } from "./util";
import { PersistoOptions } from "./persisto_options";

const default_debuglevel = 2; // Replaced by rollup script
const class_modified = "persisto-modified";
const class_saving = "persisto-saving";
const class_error = "persisto-error";

/**
 * A persistent plain object or array.
 *
 * See also [[PersistoOptions]].
 */
export class PersistentObject {
  version: string = "@VERSION"; // Set to semver by 'grunt release'
  protected _data: any;
  protected opts: any;
  protected storage: Storage;
  protected _checkTimer: any = null;
  readonly namespace: string;
  protected form: any;
  protected offline: undefined | boolean = undefined;
  protected phase: string | null = null;
  protected uncommittedSince = 0;
  protected unpushedSince = 0;
  protected lastUpdate = 0;
  protected lastPull = 0;
  commitCount: number = 0;
  pushCount: number = 0;
  protected lastModified: number = 0;

  // ready: Promise<any>;

  constructor(namespace: string, options: PersistoOptions) {
    let dfd = new Deferred();

    this.namespace = namespace;
    if (!namespace) {
      error("Missing required argument: namespace");
    }

    this.opts = extend(
      {
        remote: null, // URL for GET/PUT, ajax options, or callback
        defaults: {}, // default value if no data is found in localStorage
        attachForm: null, // track input changes and
        commitDelay: 500, // commit changes after 0.5 seconds of inactivity
        createParents: true, // set() creates missing intermediate parent objects for children
        maxCommitDelay: 3000, // commit changes max. 3 seconds after first change
        pushDelay: 5000, // push commits after 5 seconds of inactivity
        maxPushDelay: 30000, // push commits max. 30 seconds after first change
        storage: window.localStorage,
        debugLevel: default_debuglevel, // 0:quiet, 1:normal, 2:verbose
        // Events
        change: noop,
        update: noop,
        commit: noop,
        conflict: noop,
        error: noop,
        pull: noop,
        push: noop,
        save: noop,
      },
      options
    );
    this.storage = this.opts.storage;
    this._data = this.opts.defaults;
    // this.ready = new Promise();
    if (typeof this.opts.attachForm === "string") {
      this.form = document.querySelector(this.opts.attachForm);
    } else if (this.opts.attachForm instanceof HTMLElement) {
      this.form = this.opts.attachForm;
    }

    // _data contains the default value. Now load from persistent storage if any
    let prevValue = this.storage ? this.storage.getItem(this.namespace) : null;
    let self = this;

    // Monitor form changes
    if (this.form) {
      this.form.classList.add("persisto");
      onEvent(this.form, "input", "input,textarea", function (e: Event) {
        self.readFromForm(self.form);
      });
      onEvent(this.form, "change", "select", function (e: Event) {
        self.readFromForm(self.form);
      });
    }
    if (this.opts.remote) {
      // Try to pull, then resolve
      this.pull()
        .then(function () {
          self.debug("init from remote", self._data);
          self.offline = false;
          dfd.resolve();
        })
        .catch(function () {
          self.offline = true;
          if (prevValue == null) {
            console.warn(
              self + ": could not init from remote; falling back default.",
              arguments
            );
          } else {
            console.warn(
              self + ": could not init from remote; falling back to storage.",
              arguments
            );
            // self._data = JSON.parse(prevValue);
            self._data = extend({}, self.opts.defaults, JSON.parse(prevValue));
          }
          dfd.resolve();
        });
    } else if (prevValue != null) {
      this.update();
      // We still extend from opts.defaults, in case some fields were missing
      this._data = extend({}, this.opts.defaults, this._data);
      // this.debug("init from storage", this._data);
      dfd.resolve();
      // this.lastUpdate = stamp;
      // this.setDirty();
    } else {
      // this.debug("init to default", this._data);
      dfd.resolve();
    }
  }

  /** Trigger commit/push according to current settings. */
  protected _invalidate(hint: string, deferredCall?: boolean) {
    let self = this,
      now = Date.now(),
      prevChange = this.lastModified || now, // first change?
      nextCommit = 0,
      nextPush = 0,
      nextCheck = 0;

    if (this._checkTimer) {
      clearTimeout(this._checkTimer);
      this._checkTimer = null;
    }

    if (deferredCall) {
      this.debug("_invalidate() recursive");
    } else {
      // this.debug("_invalidate(" + hint + ")");
      this.lastModified = now;
      if (!this.uncommittedSince) {
        this.uncommittedSince = now;
      }
      if (!this.unpushedSince) {
        this.unpushedSince = now;
      }
      this.opts.change.call(this, hint);
      if (this.form) {
        this.form.classList.add(class_modified);
        this.form.classList.remove(class_error);
      }
    }
    if (this.storage) {
      // If we came here by a deferred timer (or delay is 0), commit
      // immediately
      if (
        now - prevChange >= this.opts.commitDelay ||
        now - this.uncommittedSince >= this.opts.maxCommitDelay
      ) {
        this.debug(
          "_invalidate(): force commit",
          now - prevChange >= this.opts.commitDelay,
          now - this.uncommittedSince >= this.opts.maxCommitDelay
        );
        this.commit();
      } else {
        // otherwise schedule next check
        nextCommit = Math.min(
          now + this.opts.commitDelay + 1,
          this.uncommittedSince + this.opts.maxCommitDelay + 1
        );
      }
    }

    if (this.opts.remote) {
      if (
        now - prevChange >= this.opts.pushDelay ||
        now - this.unpushedSince >= this.opts.maxPushDelay
      ) {
        this.debug(
          "_invalidate(): force push",
          now - prevChange >= this.opts.pushDelay,
          now - this.unpushedSince >= this.opts.maxPushDelay
        );
        this.push();
      } else {
        nextPush = Math.min(
          now + this.opts.pushDelay + 1,
          this.unpushedSince + this.opts.maxPushDelay + 1
        );
      }
    }
    if (nextCommit || nextPush) {
      nextCheck = Math.min(nextCommit || MAX_INT, nextPush || MAX_INT);
      // this.debug("Defer update:", nextCheck - now)
      this.debug(
        "_invalidate(" + hint + ") defer by " + (nextCheck - now) + "ms"
      );
      this._checkTimer = setTimeout(function () {
        self._checkTimer = null; // no need to call clearTimeout in the handler...
        self._invalidate.call(self, "deferred " + hint, true);
      }, nextCheck - now);
    }
  }
  /**
   * Write data to localStorage, check if conflict and trigger events.
   */
  protected _update(objData: any) {
    if (this.uncommittedSince) {
      console.warn("Updating an uncommitted object.");
      if (this.opts.conflict.call(this, objData, this._data) === false) {
        return;
      }
    }
    this._data = objData;
    this.opts.update.call(this);
    this.lastUpdate = Date.now();
  }
  /**
   * Return readable string representation for this instance.
   * @internal
   */
  toString() {
    return "PersistentObject('" + this.namespace + "')";
  }
  /* Log to console if opts.debugLevel >= 2 */
  debug(...args: any[]) {
    if (this.opts.debugLevel >= 2) {
      Array.prototype.unshift.call(args, this.toString());
      console.log.apply(console, args);
    }
  }
  /* Log to console if opts.debugLevel >= 1 */
  log(...args: any[]) {
    if (this.opts.debugLevel >= 1) {
      Array.prototype.unshift.call(args, this.toString());
      console.log.apply(console, args);
    }
  }
  /** Return *true* if there are uncommited or unpushed modifications. */
  isDirty() {
    return !!(
      (this.storage && this.uncommittedSince) ||
      (this.opts.remote && this.unpushedSince)
    );
  }
  /** Return true if initial pull has completed.
   *
   * See also the `store.ready` promise, that is resolved accordingly.
   */
  isReady() {
    error("Not implemented");
    // return this.ready.state !== "pending";
  }
  /**
   * Return a data property value (`key` supports dot notation).
   */
  get(key: string) {
    let i,
      cur = this._data,
      parts = ("" + key) // convert to string
        .replace(/\[(\w+)\]/g, ".$1") // convert indexes to properties
        .replace(/^\./, "") // strip a leading dot
        .split(".");

    // NOTE: this is slower (tested on Safari):
    // return key.split(".").reduce(function(prev, curr) {
    // 	return prev[curr];
    // }, this._data);

    for (i = 0; i < parts.length; i++) {
      cur = cur[parts[i]];
      if (cur === undefined && i < parts.length - 1) {
        error(
          this +
            ": Property '" +
            key +
            "' could not be accessed because parent '" +
            parts.slice(0, i + 1).join(".") +
            "' does not exist"
        );
      }
    }
    return cur;
  }
  /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
  protected _setOrRemove(key: string, value: any, remove?: boolean) {
    let i,
      parent,
      cur = this._data,
      parts = ("" + key) // convert to string
        .replace(/\[(\w+)\]/g, ".$1") // convert indexes to properties
        .replace(/^\./, "") // strip a leading dot
        .split("."),
      lastPart = parts.pop()!; // '!': Cannot be empty (silence linter)

    for (i = 0; i < parts.length; i++) {
      parent = cur;
      cur = parent[parts[i]];
      // Create intermediate parent objects properties if required
      if (cur === undefined) {
        if (this.opts.createParents) {
          this.debug("Creating intermediate parent '" + parts[i] + "'");
          cur = parent[parts[i]] = {};
        } else {
          error(
            this +
              ": Property '" +
              key +
              "' could not be set because parent '" +
              parts.slice(0, i + 1).join(".") +
              "' does not exist"
          );
        }
      }
    }
    if (cur[lastPart] !== value) {
      if (remove === true) {
        delete cur[lastPart];
        this._invalidate("remove");
      } else {
        cur[lastPart] = value;
        this._invalidate("set");
      }
    }
  }
  /**  Modify object property and set the `dirty` flag (`key` supports dot notation).
   *
   *value* must be [convertible to JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). */
  set(key: string, value: any) {
    return this._setOrRemove(key, value, false);
  }
  /** Delete object property and set the `dirty` flag (`key` supports dot notation). */
  remove(key: string) {
    return this._setOrRemove(key, undefined, true);
  }
  /**
   * Replace data object with a new instance and set the `dirty` flag.
   *
   * @param newData is optional and defaults to `{}`
   */
  reset(newData?: any) {
    this._data = newData || {};
    this._invalidate("reset");
  }
  /**
   * Flag object as *modified*, so that commit / push will be scheduled.
   */
  setDirty(flag?: boolean) {
    console.log("setDirty", flag);
    if (flag !== false) {
      this._invalidate("explicit");
    }
  }
  /**
   * Load data from localStorage.
   */
  update() {
    if (this.phase) {
      error(this + ": Trying to update while '" + this.phase + "' is pending.");
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(this + ".update");
    }
    let data = this.storage.getItem(this.namespace)!; // '!' marks it as 'is a string'
    data = JSON.parse(data);
    this._update(data);
    if (this.opts.debugLevel >= 2 && console.time) {
      console.timeEnd(this + ".update");
    }
  }
  /**
   * Write modified data to localStorage.
   *
    (Normally there is no need to call this method, since it is triggered internally
    after a short collation interval.)

   */
  commit() {
    let jsonData;
    if (this.phase) {
      error(this + ": Trying to commit while '" + this.phase + "' is pending.");
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(this + ".commit");
    }
    jsonData = JSON.stringify(this._data);
    this.storage.setItem(this.namespace, jsonData);
    this.uncommittedSince = 0;
    this.commitCount += 1;
    // this.lastCommit = Date.now();
    if (this.form && !this.opts.remote) {
      this.form.classList.remove(class_modified);
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.timeEnd(this + ".commit");
    }
    this.opts.commit.call(this);
    if (!this.opts.remote) {
      this.opts.save.call(this);
      this.lastModified = 0; // so next change will not force-commit
    }
    return jsonData;
  }
  /** Download  data from the cloud, then call `.update()`. */
  pull() {
    let self = this;

    if (this.phase) {
      error(this + ": Trying to pull while '" + this.phase + "' is pending.");
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(this + ".pull");
    }
    this.phase = "pull";

    return fetch(this.opts.remote, { method: "GET" })
      .then(function (response) {
        if (response.ok) {
          self.opts.pull.call(self, response);
        } else {
          error(
            "GET " +
              self.opts.remote +
              " returned " +
              response.status +
              ", " +
              response
          );
        }
        return response.json();
      })
      .then(function (data) {
        self.storage.setItem(self.namespace, JSON.stringify(data));
        self._update.call(self, data);
        self.lastPull = Date.now();
        self.opts.pull.call(self);
      })
      .catch(function () {
        console.error(arguments);
        self.opts.error.call(self, arguments);
      })
      .finally(function () {
        self.phase = null;
        if (self.opts.debugLevel >= 2 && console.time) {
          console.timeEnd(self + ".pull");
        }
      });
  }
  /** Commit, then upload data into the cloud.
   *
    (Normally there is no need to call this method, since it is triggered internally.) */
  push() {
    let jsonData;
    let self = this;

    if (this.uncommittedSince) {
      if (this.phase) {
        console.error("Resetting phase: " + this.phase);
        this.phase = null;
      }
      jsonData = this.commit();
    } else {
      jsonData = JSON.stringify(this._data);
    }
    if (this.phase) {
      error(this + ": Trying to push while '" + this.phase + "' is pending.");
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(self + ".push");
    }
    this.phase = "push";
    if (!this.opts.remote) {
      error(this + ": Missing remote option");
    }
    if (this.form) {
      this.form.classList.remove(class_error);
      this.form.classList.add(class_saving);
    }
    return fetch(this.opts.remote, {
      method: "PUT",
      body: jsonData,
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(function (response) {
        // console.log("PUT", arguments);
        // self.lastPush = Date.now();
        if (!response.ok) {
          error(
            "PUT " +
              self.opts.remote +
              " returned " +
              response.status +
              ", " +
              response
          );
        }
        self.unpushedSince = 0;
        // self.lastModified = 0;  // so next change will not force-commit
        self.pushCount += 1;
        self.opts.push.call(self, response);
        self.opts.save.call(self);
      })
      .catch(function () {
        if (self.form) {
          self.form.classList.add(class_error);
        }
        self.opts.error.call(self, arguments);
      })
      .finally(function () {
        self.phase = null;
        if (self.opts.debugLevel >= 2 && console.time) {
          console.timeEnd(self + ".push");
        }
        if (self.form) {
          self.form.classList.remove(class_saving);
        }
      });
  }
  /** Read data properties from form input elements with the same name.
   *
   * Supports elements of input (type: text, radio, checkbox), textarea,
    and select.<br>
    *form* may be a form element or selector string. Example: `"#myForm"`.<br>
    *options* is optional and defaults to <code>{addNew: false, coerce: true, trim: true}</code>.
   */
  readFromForm(form: any, options?: any) {
    let self = this;
    let opts = extend(
      {
        addNew: false,
        coerce: true, // convert single checkboxes to bool (instead value)
        trim: true,
      },
      options
    );

    if (typeof form === "string") {
      form = document.querySelector(form);
    }
    if (opts.addNew) {
      let formItems = form.querySelectorAll("[name]");
      for (let i = 0; i < formItems.length; i++) {
        let name = formItems[i].getAttribute("name");
        if (self._data[name] === undefined) {
          self.debug("readFromForm: add field '" + name + "'");
          self._data[name] = null;
        }
      }
    }

    each(this._data, function (k: string, _v: any) {
      let val,
        type,
        inputItems = form.querySelectorAll("[name='" + k + "']"),
        item = inputItems[0];

      if (!inputItems.length) {
        self.debug("readFromForm: field not found: '" + k + "'");
        return; // continue iteration
      }
      type = item.getAttribute("type");
      if (type === "radio") {
        // TODO: querySelector() may return null:
        // val = form.querySelector("[name='" + k + "']:checked").value;
        val = form[k].value;
      } else if (type === "checkbox" && inputItems.length === 1) {
        // Single checkbox is handled as bool
        val = !!item.checked;
      } else if (type === "checkbox" && inputItems.length > 1) {
        // Multi-checkbox group is handled as array of values
        val = [];
        inputItems.forEach(function (elem: any) {
          if (elem.checked) {
            val.push(elem.value);
          }
        });
      } else if (item.matches("select")) {
        if (item.multiple) {
          // Multiselect listbox
          val = [];
          Array.from(item.selectedOptions).forEach(function (elem: any) {
            val.push(elem.value);
          });
        } else {
          // sinlge select listbox
          val = item.options[item.selectedIndex].value;
        }
      } else {
        val = item.value;
        if (opts.trim && typeof val === "string") {
          val = val.trim();
        }
      }
      // console.log("readFromForm: val(" + k + "): '" + val + "'");
      self.set(k, val);
    });
    // console.log("readFromForm: '" + this + "'", this._data);
  }
  /** Write data to form elements with the same name.
   *
   * *form* may be a form selector or HTMLElement object. Example: `"#myForm"`.
   */
  writeToForm(form: any, options?: any) {
    let i,
      elem,
      match,
      self = this;

    if (typeof form === "string") {
      form = document.querySelector(form);
    }

    each(this._data, function (k: string) {
      let v = self.get(k),
        vIsArray = Array.isArray(v),
        inputItems = form.querySelectorAll("[name='" + k + "']");

      if (!inputItems.length) {
        return; // continue iteration
      }
      let item = inputItems[0],
        type = item.getAttribute("type");

      if (type === "radio") {
        inputItems.forEach(function (elem: any) {
          elem.checked = elem.value === v;
        });
      } else if (type === "checkbox") {
        if (inputItems.length === 1) {
          // single checkbox treated as bool
          item.checked = !!v;
        } else {
          // multi-checkbox group is treated as array of values
          for (i = 0; i < inputItems.length; i++) {
            elem = inputItems[i];
            match = vIsArray ? v.indexOf(elem.value) >= 0 : elem.value === v;
            elem.checked = match;
          }
        }
      } else if (item.matches("select")) {
        // listbox
        for (i = 0; i < item.options.length; i++) {
          elem = item.options[i];
          match = vIsArray ? v.indexOf(elem.value) >= 0 : elem.value === v;
          elem.selected = match;
          // if (match) {
          //   elem.setAttribute("selected", true);
          // } else {
          //   elem.removeAttribute("selected");
          // }
        }
      } else if (type === "file") {
        // #3 skip type=file
      } else {
        item.value = v;
      }
    });
  }
}

// let p = new PersistentObject("namespace", {
//   remote: null,
//   change: function () {
//     return 3;
//   },
//   conflict: (...args) => {return true}
// });

// export default PersistentObject;
