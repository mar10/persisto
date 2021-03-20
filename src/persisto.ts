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

import * as util from "./util";
import { Deferred } from "./deferred";
import { PersistoOptions } from "./persisto_options";

const default_debuglevel = 2; // Replaced by rollup script

const class_prefix = "persisto-";

enum Status {
  Ok = "ok",
  Modified = "modified",
  Loading = "loading",
  Saving = "saving",
  Error = "error",
}

enum Phase {
  Idle = "",
  Push = "push",
  Pull = "pull",
}

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
  protected statusElement: any;
  protected offline: undefined | boolean = undefined;
  protected phase: Phase = Phase.Idle;
  protected status: Status = Status.Ok;
  protected uncommittedSince = 0;
  protected unpushedSince = 0;
  protected lastUpdate = 0;
  protected lastPull = 0;
  commitCount: number = 0;
  pushCount: number = 0;
  protected lastModified: number = 0;

  ready: Promise<any>;

  constructor(namespace: string, options: PersistoOptions) {
    let dfd = new Deferred();

    this.ready = dfd.promise();

    this.namespace = namespace;
    if (!namespace) {
      throw new Error("Missing required argument: namespace");
    }

    this.opts = util.extend(
      {
        remote: null, // URL for GET/PUT, ajax options, or callback
        defaults: {}, // default value if no data is found in localStorage
        attachForm: null, // track input changes and set `persisto-STATUS`
        statusElement: null, // set `persisto-STATUS` classes here
        commitDelay: 500, // commit changes after 0.5 seconds of inactivity
        createParents: true, // set() creates missing intermediate parent objects for children
        maxCommitDelay: 3000, // commit changes max. 3 seconds after first change
        pushDelay: 5000, // push commits after 5 seconds of inactivity
        maxPushDelay: 30000, // push commits max. 30 seconds after first change
        storage: window.localStorage,
        debugLevel: default_debuglevel, // 0:quiet, 1:normal, 2:verbose
        // Events
        change: util.noop,
        update: util.noop,
        commit: util.noop,
        conflict: util.noop,
        error: util.noop,
        pull: util.noop,
        push: util.noop,
        save: util.noop,
        status: util.noop,
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
    if (typeof this.opts.statusElement === "string") {
      this.statusElement = document.querySelector(this.opts.statusElement);
    } else if (this.opts.statusElement instanceof HTMLElement) {
      this.statusElement = this.opts.statusElement;
    }

    // _data contains the default value. Now load from persistent storage if any
    let prevValue = this.storage ? this.storage.getItem(this.namespace) : null;

    // Monitor form changes
    if (this.form) {
      this.form.classList.add("persisto");
      util.onEvent(this.form, "input", "input,textarea", (e: Event) => {
        this.readFromForm(this.form);
      });
      util.onEvent(this.form, "change", "select", (e: Event) => {
        this.readFromForm(this.form);
      });
      this.form.addEventListener("submit", (e: Event) => {
        this.readFromForm(this.form);
        e.preventDefault();
      });
      this.form.addEventListener("reset", (e: Event) => {
        this.readFromForm(this.form);
        e.preventDefault();
      });
    }
    if (this.opts.remote) {
      // Try to pull, then resolve
      this.pull()
        .then(() => {
          this.debug("init from remote", this._data);
          this.offline = false;
          dfd.resolve(this);
        })
        .catch((reason) => {
          this.offline = true;
          if (prevValue == null) {
            console.warn(
              this + ": could not init from remote; falling back default.",
              arguments
            );
          } else {
            console.warn(
              this + ": could not init from remote; falling back to storage.",
              arguments
            );
            // this._data = JSON.parse(prevValue);
            this._data = util.extend(
              {},
              this.opts.defaults,
              JSON.parse(prevValue)
            );
          }
          dfd.reject(reason);
        });
    } else if (prevValue != null) {
      this.update();
      // We still extend from opts.defaults, in case some fields were missing
      this._data = util.extend({}, this.opts.defaults, this._data);
      // this.debug("init from storage", this._data);
      dfd.resolve(this);
      // this.lastUpdate = stamp;
      // this.setDirty();
    } else {
      // this.debug("init to default", this._data);
      dfd.resolve(this);
    }
  }

  protected _setStatus(status: Status) {
    this.debug("status " + this.status + " => " + status);
    this.status = status;
    function _setClass(elem: any) {
      if (elem) {
        for (let s in Status) {
          s = s.toLocaleLowerCase();
          util.toggleClass(elem, class_prefix + s, status === s);
        }
      }
    }
    _setClass(this.form);
    _setClass(this.statusElement);
    this.opts.status.call(this, status);
  }

  /** Trigger commit/push according to current settings. */
  protected _invalidate(hint: string, deferredCall?: boolean) {
    let now = Date.now(),
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
      this._setStatus(Status.Modified);
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
      nextCheck = Math.min(
        nextCommit || util.MAX_INT,
        nextPush || util.MAX_INT
      );
      // this.debug("Defer update:", nextCheck - now)
      this.debug(
        "_invalidate(" + hint + ") defer by " + (nextCheck - now) + "ms"
      );
      this._checkTimer = setTimeout(() => {
        this._checkTimer = null; // no need to call clearTimeout in the handler...
        this._invalidate.call(this, "deferred " + hint, true);
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
    throw new Error("Not implemented");
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

    for (i = 0; i < parts.length; i++) {
      cur = cur[parts[i]];
      if (cur === undefined && i < parts.length - 1) {
        throw new Error(
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
          throw new Error(
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
      throw new Error(
        this + ": Trying to update while '" + this.phase + "' is pending."
      );
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
      throw new Error(
        this + ": Trying to commit while '" + this.phase + "' is pending."
      );
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(this + ".commit");
    }
    jsonData = JSON.stringify(this._data);
    this.storage.setItem(this.namespace, jsonData);
    this.uncommittedSince = 0;
    this.commitCount += 1;
    // this.lastCommit = Date.now();
    if (!this.opts.remote) {
      this._setStatus(Status.Ok);
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
    if (this.phase) {
      throw new Error(
        this + ": Trying to pull while '" + this.phase + "' is pending."
      );
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(this + ".pull");
    }
    this.phase = Phase.Pull;
    this._setStatus(Status.Loading);

    return fetch(this.opts.remote, { method: "GET" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "GET " +
              this.opts.remote +
              " returned " +
              response.status +
              ", " +
              response
          );
        }
        return response.json();
      })
      .then((data) => {
        this.storage.setItem(this.namespace, JSON.stringify(data));
        this._update(data);
        this._setStatus(Status.Ok);
        this.lastPull = Date.now();
        this.opts.pull.call(this);
      })
      .catch((reason) => {
        console.error(arguments);
        this._setStatus(Status.Error);
        this.opts.error.call(this, reason);
        throw reason; // re-throw, so caller can catch it
      })
      .finally(() => {
        this.phase = Phase.Idle;
        if (this.opts.debugLevel >= 2 && console.time) {
          console.timeEnd(this + ".pull");
        }
      });
  }
  /** Commit, then upload data into the cloud.
   *
    (Normally there is no need to call this method, since it is triggered internally.) */
  push() {
    let jsonData;

    if (this.uncommittedSince) {
      if (this.phase) {
        console.error("push(): Resetting phase " + this.phase + " => idle");
        this.phase = Phase.Idle;
      }
      jsonData = this.commit();
    } else {
      jsonData = JSON.stringify(this._data);
    }
    if (this.phase) {
      throw new Error(
        this + ": Trying to push while '" + this.phase + "' is pending."
      );
    }
    if (this.opts.debugLevel >= 2 && console.time) {
      console.time(this + ".push");
    }
    this.phase = Phase.Push;
    if (!this.opts.remote) {
      throw new Error(this + ": Missing remote option");
    }
    this._setStatus(Status.Saving);
    return fetch(this.opts.remote, {
      method: "PUT",
      body: jsonData,
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        // console.log("PUT", arguments);
        // this.lastPush = Date.now();
        if (!response.ok) {
          throw new Error(
            "PUT " +
              this.opts.remote +
              " returned " +
              response.status +
              ", " +
              response
          );
        }
        this.unpushedSince = 0;
        // this.lastModified = 0;  // so next change will not force-commit
        this.pushCount += 1;
        this._setStatus(Status.Ok);
        this.opts.push.call(this, response);
        this.opts.save.call(this);
      })
      .catch((reason) => {
        this._setStatus(Status.Error);
        this.opts.error.call(this, reason);
        throw reason; // Re-throw, so caller can catch it
      })
      .finally(() => {
        this.phase = Phase.Idle;
        if (this.opts.debugLevel >= 2 && console.time) {
          console.timeEnd(this + ".push");
        }
      });
  }
  /** Read data properties from form input elements with the same name.
   *
   * Supports elements of input (type: text, radio, checkbox), textarea,
    and select.<br>
    *form* may be a form element or selector string. Example: `"#myForm"`.<br>
    * (defaults to [[PersistoOptions.attachForm]])<br>
    *options* is optional and defaults to <code>{addNew: false, coerce: true, trim: true}</code>.
    */
  readFromForm(form?: any, options?: any) {
    let opts = util.extend(
      {
        addNew: false,
        coerce: true, // convert single checkboxes to bool (instead value)
        trim: true,
      },
      options
    );

    form = form || this.form;
    if (typeof form === "string") {
      form = document.querySelector(form);
    }
    if (opts.addNew) {
      let formItems = form.querySelectorAll("[name]");
      for (let i = 0; i < formItems.length; i++) {
        let name = formItems[i].getAttribute("name");
        if (this._data[name] === undefined) {
          this.debug("readFromForm: add field '" + name + "'");
          this._data[name] = null;
        }
      }
    }

    util.each(this._data, (k: string, _v: any) => {
      let val,
        type,
        inputItems = form.querySelectorAll("[name='" + k + "']"),
        item = inputItems[0];

      if (!inputItems.length) {
        this.debug("readFromForm: field not found: '" + k + "'");
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
        inputItems.forEach((elem: any) => {
          if (elem.checked) {
            val.push(elem.value);
          }
        });
      } else if (item.matches("select")) {
        if (item.multiple) {
          // Multiselect listbox
          val = [];
          Array.from(item.selectedOptions).forEach((elem: any) => {
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
      this.set(k, val);
    });
    // console.log("readFromForm: '" + this + "'", this._data);
  }
  /** Write data to form elements with the same name.
   *
   * *form* may be a form selector or HTMLElement object. Example: `"#myForm"`
   * (defaults to [[PersistoOptions.attachForm]])
   */
  writeToForm(form?: any, options?: any) {
    let i, elem, match;

    form = form || this.form;
    if (typeof form === "string") {
      form = document.querySelector(form);
    }

    util.each(this._data, (k: string) => {
      let v = this.get(k),
        vIsArray = Array.isArray(v),
        inputItems = form.querySelectorAll("[name='" + k + "']");

      if (!inputItems.length) {
        return; // continue iteration
      }
      let item = inputItems[0],
        type = item.getAttribute("type");

      if (type === "radio") {
        inputItems.forEach((elem: any) => {
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
