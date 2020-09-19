/*!
 * persisto.js
 *
 * Persistent JavaScript objects and web forms using Web Storage.
 *
 * Copyright (c) 2016-2017, Martin Wendt (http://wwWendt.de)
 * Released under the MIT license
 *
 * @version @VERSION
 * @date @DATE
 */

/*
  TODO:
  - remove  eslint relaxes;
  - change eslint to non-jquery
  - fetch is not supported by IE
  - use :scope for querySelectorAll
*/
(function(factory) {
  if (typeof define === "function" && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    // Node/CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    factory();
  }
})(function() {
  "use strict";

  /**
   * Deferred is a ES6 Promise, that exposes the resolve() method
   */
  var Deferred = function() {
    var self = this;
    // eslint-disable-next-line no-undef
    if (!(this instanceof Deferred)) {
      throw new Error("Must use 'new' keyword");
    }
    this.resolve = null;
    this.reject = null;
    this._promise = new Promise(function(resolve, reject) {
      self.resolve = resolve;
      self.reject = reject;
    });
  };
  Deferred.prototype = {
    /** Return `Promise` instance. */
    promise: function() {
      return this._promise;
    },
  };

  /**
   * jQuery Shims
   * http://youmightnotneedjquery.com
   */

  // eslint-disable-next-line one-var
  var shim = {
    each: function(obj, callback) {
      if (obj == null) {
        // accept `null` or `undefined`
        return obj;
      }
      var length = obj.length,
        i = 0;

      if (typeof length === "number") {
        for (; i < length; i++) {
          if (callback.call(obj[i], i, obj[i]) === false) {
            break;
          }
        }
      } else {
        for (i in obj) {
          if (callback.call(obj[i], i, obj[i]) === false) {
            break;
          }
        }
      }
      return obj;
    },
    error: function(msg) {
      throw new Error(msg);
    },
    extend: function() {
      for (var i = 1; i < arguments.length; i++) {
        var arg = arguments[i];
        for (var key in arg) {
          if (Object.prototype.hasOwnProperty.call(arg, key)) {
            arguments[0][key] = arg[key];
          }
        }
      }
      return arguments[0];
    },
    // grep: function(elems, callback, invert) {
    //   var callbackInverse,
    //     matches = [],
    //     i = 0,
    //     length = elems.length,
    //     callbackExpect = !invert;

    //   // Go through the array, only saving the items
    //   // that pass the validator function
    //   for (; i < length; i++) {
    //     callbackInverse = !callback(elems[i], i);
    //     if (callbackInverse !== callbackExpect) {
    //       matches.push(elems[i]);
    //     }
    //   }
    //   return matches;
    // },
    // isArray: Array.isArray,
    // inArray: function(item, arr) {
    //   return arr.indexOf(item);
    // },
    isEmptyObject: function(obj) {
      // var name;
      // // eslint-disable-next-line guard-for-in
      // for (name in obj) {
      //   return false;
      // }
      // return true;
      // because Object.keys(new Date()).length === 0
      // we have to do some additional check
      return Object.keys(obj).length === 0 && obj.constructor === Object;
    },
    isPlainObject: function(obj) {
      return Object.prototype.toString.call(obj) === "[object Object]";
    },
    // map: function(arr, callback) {
    //   return Array.prototype.map.call(arr, function(currentValue, index, array) {
    //     return callback.call(this, currentValue, index, array);
    //   });
    // },
    noop: function() {},
    ready: function(fn) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fn);
      } else {
        fn();
      }
    },
    type: function(obj) {
      return Object.prototype.toString
        .call(obj)
        .replace(/^\[object (.+)\]$/, "$1")
        .toLowerCase();
    },
    /*
     * Helpers (not jQuery syntax)
     */
    // getVal: function(elem) {
    //   var type = elem.getAttribute("type");
    //   if (type === "radio") {
    //     // TODO: querySelector() may return null:
    //     val = elem.querySelector(">option:checked").value;
    //   } else if (type === "checkbox" && inputItems.length === 1) {
    //     val = !!inputItems[0].checked;
    //   } else if (type === "checkbox" && inputItems.length > 1) {
    //     val = [];
    //     inputItems.forEach(function(elem) {
    //       if (elem.checked) {
    //         val.push(elem.value);
    //       }
    //     });
    //   } else if (inputItems[0].matches("select")) {
    //     val = [];
    //     inputItems[0].querySelectorAll("option").forEach(function(elem) {
    //       if (elem.selected) {
    //         val.push(elem.value);
    //       }
    //     });
    //   } else {
    //     val = inputItems[0].value;
    //     if (opts.trim && typeof val === "string") {
    //       val = val.trim();
    //     }
    //   }
    // },
  };

  /*******************************************************************************
   * Private functions and variables
   */

  // eslint-disable-next-line one-var
  var MAX_INT = 9007199254740991,
    // Allow mangling of some global names:
    console = window.console,
    noop = shim.noop,
    error = shim.error;

  /**
   * A persistent plain object or array.
   */
  window.PersistentObject = function(namespace, opts) {
    var prevValue,
      self = this,
      dfd = new Deferred(),
      stamp = Date.now(); // disable warning 'PersistentObject is not defined'

    // eslint-disable-next-line no-undef
    if (!(this instanceof PersistentObject)) {
      error("Must use 'new' keyword");
    }

    if (typeof namespace !== "string") {
      error(this + ": Missing required argument: namespace");
    }

    this.opts = shim.extend(
      {
        remote: null, // URL for GET/PUT, ajax options, or callback
        defaults: {}, // default value if no data is found in localStorage
        commitDelay: 500, // commit changes after 0.5 seconds of inactivity
        createParents: true, // set() creates missing intermediate parent objects for children
        maxCommitDelay: 3000, // commit changes max. 3 seconds after first change
        pushDelay: 5000, // push commits after 5 seconds of inactivity
        maxPushDelay: 30000, // push commits max. 30 seconds after first change
        storage: window.localStorage,
        // Default debugLevel is set to 1 by `grunt build`:
        debugLevel: 2, // 0:quiet, 1:normal, 2:verbose
        // Events
        change: noop,
        commit: noop,
        conflict: noop,
        error: noop,
        pull: noop,
        push: noop,
        update: noop,
      },
      opts
    );
    this._checkTimer = null;
    this.namespace = namespace;
    this.storage = this.opts.storage;
    this._data = this.opts.defaults;

    this.offline = undefined;
    this.phase = null;
    this.uncommittedSince = null;
    this.unpushedSince = null;
    this.lastUpdate = 0;
    this.lastPull = 0;
    this.commitCount = 0;
    this.pushCount = 0;
    this.lastModified = stamp;

    this.ready = dfd.promise();

    // _data contains the default value. Now load from persistent storage if any
    prevValue = this.storage ? this.storage.getItem(this.namespace) : null;

    if (this.opts.remote) {
      // Try to pull, then resolve
      this.pull()
        .done(function() {
          // self.debug("init from remote", this._data);
          self.offline = false;
          dfd.resolve();
        })
        .fail(function() {
          self.offline = true;
          if (prevValue == null) {
            console.warn(
              self + ": could not init from remote; falling back default."
            );
          } else {
            console.warn(
              self + ": could not init from remote; falling back to storage."
            );
            // self._data = JSON.parse(prevValue);
            self._data = shim.extend(
              {},
              self.opts.defaults,
              JSON.parse(prevValue)
            );
          }
          dfd.resolve();
        });
      // eslint-disable-next-line no-negated-condition
    } else if (prevValue != null) {
      this.update();
      // We still extend from opts.defaults, in case some fields where missing
      this._data = shim.extend({}, this.opts.defaults, this._data);
      // this.debug("init from storage", this._data);
      dfd.resolve();
      // this.lastUpdate = stamp;
      // this.setDirty();
    } else {
      // this.debug("init to default", this._data);
      dfd.resolve();
    }
  };

  window.PersistentObject.prototype = {
    /** @type {string} */
    version: "@VERSION", // Set to semver by 'grunt release'

    /* Trigger commit/push according to current settings. */
    _invalidate: function(hint, deferredCall) {
      var self = this,
        prevChange = this.lastModified,
        now = Date.now(),
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
        this.opts.change(hint);
      }

      if (this.storage) {
        // If we came here by a deferred timer (or delay is 0), commit
        // immedialtely
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
        this._checkTimer = setTimeout(function() {
          self._checkTimer = null; // no need to call clearTimeout in the handler...
          self._invalidate.call(self, null, true);
        }, nextCheck - now);
      }
    },
    /* Load data from localStorage. */
    _update: function(objData) {
      if (this.uncommittedSince) {
        console.warn("Updating an uncommitted object.");
        if (this.conflict(objData, this._data) === false) {
          return;
        }
      }
      this._data = objData;
      // this.dirty = false;
      this.lastUpdate = Date.now();
    },
    /* Return readable string representation for this instance. */
    toString: function() {
      return "PersistentObject('" + this.namespace + "')";
    },
    /* Log to console if opts.debugLevel >= 2 */
    debug: function() {
      if (this.opts.debugLevel >= 2) {
        Array.prototype.unshift.call(arguments, this.toString());
        console.log.apply(console, arguments);
      }
    },
    /* Log to console if opts.debugLevel >= 1 */
    log: function() {
      if (this.opts.debugLevel >= 1) {
        Array.prototype.unshift.call(arguments, this.toString());
        console.log.apply(console, arguments);
      }
    },
    /** Return true if there are uncommited or unpushed modifications. */
    isDirty: function() {
      return !!(
        (this.storage && this.uncommittedSince) ||
        (this.opts.remote && this.unpushedSince)
      );
    },
    /** Return true if initial pull has completed. */
    isReady: function() {
      return this.ready.state !== "pending";
    },
    /** Access object property (`key` supports dot notation). */
    get: function(key) {
      var i,
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
    },
    /* Modify object property and set the `dirty` flag (`key` supports dot notation). */
    _setOrRemove: function(key, value, remove) {
      var i,
        parent,
        cur = this._data,
        parts = ("" + key) // convert to string
          .replace(/\[(\w+)\]/g, ".$1") // convert indexes to properties
          .replace(/^\./, "") // strip a leading dot
          .split("."),
        lastPart = parts.pop();

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
    },
    /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
    set: function(key, value) {
      return this._setOrRemove(key, value, false);
    },
    /** Delete object property and set the `dirty` flag (`key` supports dot notation). */
    remove: function(key) {
      return this._setOrRemove(key, undefined, true);
    },
    /** Replace data object with a new instance. */
    reset: function(obj) {
      this._data = obj || {};
      this._invalidate("reset");
    },
    /** Flag object as modified, so that commit / push will be scheduled. */
    setDirty: function(flag) {
      if (flag !== false) {
        this._invalidate("explicit");
      }
    },
    /** Load data from localStorage. */
    update: function() {
      if (this.phase) {
        error(
          this + ": Trying to update while '" + this.phase + "' is pending."
        );
      }
      if (this.opts.debugLevel >= 2 && console.time) {
        console.time(this + ".update");
      }
      var data = this.storage.getItem(this.namespace);
      data = JSON.parse(data);
      this._update(data);
      if (this.opts.debugLevel >= 2 && console.time) {
        console.timeEnd(this + ".update");
      }
    },
    /** Write data to localStorage. */
    commit: function() {
      var data;
      if (this.phase) {
        error(
          this + ": Trying to commit while '" + this.phase + "' is pending."
        );
      }
      if (this.opts.debugLevel >= 2 && console.time) {
        console.time(this + ".commit");
      }
      // try { data = JSON.stringify(this._data); } catch(e) { }
      data = JSON.stringify(this._data);
      this.storage.setItem(this.namespace, data);
      // this.dirty = false;
      this.uncommittedSince = null;
      this.commitCount += 1;
      // this.lastCommit = Date.now();
      if (this.opts.debugLevel >= 2 && console.time) {
        console.timeEnd(this + ".commit");
      }
      return data;
    },
    /** Download, then update data from the cloud. */
    pull: function() {
      var self = this;

      if (this.phase) {
        error(this + ": Trying to pull while '" + this.phase + "' is pending.");
      }
      if (this.opts.debugLevel >= 2 && console.time) {
        console.time(this + ".pull");
      }
      this.phase = "pull";

      return fetch(this.opts.remote, { method: "GET" })
        .then(function(objData) {
          var strData = objData;
          if (Array.isArray(objData) || shim.isPlainObject(objData)) {
            strData = JSON.stringify(objData);
          } else {
            objData = JSON.parse(objData);
          }
          self.storage.setItem(self.namespace, strData);
          self._update(objData);
          self.lastPull = Date.now();
        })
        .fail(function() {
          self.opts.error(arguments);
        })
        .always(function() {
          self.phase = null;
          if (self.opts.debugLevel >= 2 && console.time) {
            console.timeEnd(self + ".pull");
          }
        });
    },
    /** Commit, then upload data to the cloud. */
    push: function() {
      var self = this,
        data = this.commit();

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
      return fetch(this.opts.remote, {
        method: "PUT",
        data: data,
      })
        .done(function() {
          // console.log("PUT", arguments);
          // self.lastPush = Date.now();
          self.unpushedSince = null;
          self.pushCount += 1;
        })
        .fail(function() {
          self.opts.error(arguments);
        })
        .always(function() {
          self.phase = null;
          if (self.opts.debugLevel >= 2 && console.time) {
            console.timeEnd(self + ".push");
          }
        });
    },
    /** Read data properties from form input elements with the same name.
     * Supports elements of input (type: text, radio, checkbox), textarea,
     * and select.
     */
    readFromForm: function(form, options) {
      var self = this,
        opts = shim.extend(
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
        var formItems = form.querySelectorAll("[name]");
        for (var i = 0; i < formItems.length; i++) {
          var name = formItems[i].getAttribute("name");
          if (self._data[name] === undefined) {
            self.debug("readFromForm: add field '" + name + "'");
            self._data[name] = null;
          }
        }
      }

      shim.each(this._data, function(k, v) {
        var val,
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
          inputItems.forEach(function(elem) {
            if (elem.checked) {
              val.push(elem.value);
            }
          });
        } else if (item.matches("select")) {
          if (item.multiple) {
            // Multiselect listbox
            val = [];
            Array.from(item.selectedOptions).forEach(function(elem) {
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
    },
    /** Write data to form elements with the same name.
     */
    writeToForm: function(form, options) {
      var i,
        elem,
        match,
        self = this;

      if (typeof form === "string") {
        form = document.querySelector(form);
      }

      shim.each(this._data, function(k) {
        var v = self.get(k),
          vIsArray = Array.isArray(v),
          inputItems = form.querySelectorAll("[name='" + k + "']");

        if (!inputItems.length) {
          return; // continue iteration
        }
        var item = inputItems[0],
          type = item.getAttribute("type");

        if (type === "radio") {
          inputItems.forEach(function(elem) {
            elem.checked = elem.value === v;
          });
        } else if (type === "checkbox") {
          if (inputItems.length === 1) {
            item.checked = !!v;
          } else {
            // multi-value checkbox
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
    },
  };
  // -----------------------------------------------------------------------------
  // Value returned by `require('persisto')`
  return window.PersistentObject;
}); // End of closure
