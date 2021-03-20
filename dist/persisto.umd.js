(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.mar10 = {}));
}(this, (function (exports) { 'use strict';

    /*!
     * persisto.js - utils
     * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
     * v2.0.1-0, Sat, 20 Mar 2021 16:14:12 GMT (https://github.com/mar10/persisto)
     */
    const MAX_INT = 9007199254740991;
    /**
     * Bind event handler using event delegation:
     *
     * E.g. handle all 'input' events for input and textarea elements of a given
     * form
     * ```ts
     * onEvent("#form_1", "input", "input,textarea", function (e: Event) {
     *   console.log(e.type, e.target);
     * });
     * ```
     *
     * @param element HTMLElement or selector
     * @param eventName
     * @param selector
     * @param handler
     * @param bind
     */
    function onEvent(element, eventName, selector, handler, bind) {
        if (typeof element === "string") {
            element = document.querySelector(element);
        }
        element.addEventListener(eventName, function (e) {
            if (e.target && e.target.matches(selector)) {
                if (bind) {
                    return handler.call(bind, e);
                }
                else {
                    return handler(e);
                }
            }
        });
    }
    function toggleClass(element, classname, force) {
        if (typeof element === "string") {
            element = document.querySelector(element);
        }
        switch (force) {
            case true:
                element.classList.add(classname);
                break;
            case false:
                element.classList.remove(classname);
                break;
            default:
                element.classList.toggle(classname);
        }
    }
    /**
     * jQuery Shims
     * http://youmightnotneedjquery.com
     */
    function each(obj, callback) {
        if (obj == null) {
            // accept `null` or `undefined`
            return obj;
        }
        let length = obj.length, i = 0;
        if (typeof length === "number") {
            for (; i < length; i++) {
                if (callback.call(obj[i], i, obj[i]) === false) {
                    break;
                }
            }
        }
        else {
            for (let i in obj) {
                if (callback.call(obj[i], i, obj[i]) === false) {
                    break;
                }
            }
        }
        return obj;
    }
    function extend(...args) {
        for (let i = 1; i < args.length; i++) {
            let arg = args[i];
            for (let key in arg) {
                if (Object.prototype.hasOwnProperty.call(arg, key)) {
                    args[0][key] = arg[key];
                }
            }
        }
        return args[0];
    }
    function noop() { }

    /*!
     * persisto.js - utils
     * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
     * v2.0.1-0, Sat, 20 Mar 2021 16:14:12 GMT (https://github.com/mar10/persisto)
     */
    /**
     * Deferred is a ES6 Promise, that exposes the resolve() and reject()` method.
     *
     * Loosely mimics [`jQuery.Deferred`](https://api.jquery.com/category/deferred-object/).
     */
    class Deferred {
        constructor() {
            this._promise = new Promise((resolve, reject) => {
                this._resolve = resolve;
                this._reject = reject;
            });
        }
        /** Resolve the [[Promise]]. */
        resolve(value) {
            this._resolve(value);
        }
        /** Reject the [[Promise]]. */
        reject(reason) {
            this._reject(reason);
        }
        /** Return the native [[Promise]] instance.*/
        promise() {
            return this._promise;
        }
        /** Call [[Promise.then]] on the embedded promise instance.*/
        then(cb) {
            return this._promise.then(cb);
        }
        /** Call [[Promise.catch]] on the embedded promise instance.*/
        catch(cb) {
            return this._promise.catch(cb);
        }
        /** Call [[Promise.finally]] on the embedded promise instance.*/
        finally(cb) {
            return this._promise.finally(cb);
        }
    }
    // type promiseCallbackType = (val: any) => void;
    // /**
    //  * Deferred is a ES6 Promise, that exposes the resolve() method
    //  */
    // export class Deferred {
    //   private thens: promiseCallbackType[] = [];
    //   private catches: promiseCallbackType[] = [];
    //   private status = "";
    //   private resolvedValue: any;
    //   private rejectedError: any;
    //   constructor() {}
    //   resolve(value?: any) {
    //     if (this.status) {
    //       throw new Error("already settled");
    //     }
    //     this.status = "resolved";
    //     this.resolvedValue = value;
    //     this.thens.forEach((t) => t(value));
    //     this.thens = []; // Avoid memleaks.
    //   }
    //   reject(error?: any) {
    //     if (this.status) {
    //       throw new Error("already settled");
    //     }
    //     this.status = "rejected";
    //     this.rejectedError = error;
    //     this.catches.forEach((c) => c(error));
    //     this.catches = []; // Avoid memleaks.
    //   }
    //   then(cb: any) {
    //     if (status === "resolved") {
    //       cb(this.resolvedValue);
    //     } else {
    //       this.thens.unshift(cb);
    //     }
    //   }
    //   catch(cb: any) {
    //     if (this.status === "rejected") {
    //       cb(this.rejectedError);
    //     } else {
    //       this.catches.unshift(cb);
    //     }
    //   }
    //   promise() {
    //     return {
    //       then: this.then,
    //       catch: this.catch,
    //     };
    //   }
    // }

    /*!
     * persisto.js
     *
     * Persistent JavaScript objects and web forms using Web Storage.
     *
     * Copyright (c) 2016-2021, Martin Wendt (https://wwWendt.de).
     * Released under the MIT license.
     *
     * @version v2.0.1-0
     * @date Sat, 20 Mar 2021 16:14:12 GMT
     */
    const default_debuglevel = 1; // Replaced by rollup script
    const class_prefix = "persisto-";
    var Status;
    (function (Status) {
        Status["Ok"] = "ok";
        Status["Modified"] = "modified";
        Status["Loading"] = "loading";
        Status["Saving"] = "saving";
        Status["Error"] = "error";
    })(Status || (Status = {}));
    var Phase;
    (function (Phase) {
        Phase["Idle"] = "";
        Phase["Push"] = "push";
        Phase["Pull"] = "pull";
    })(Phase || (Phase = {}));
    /**
     * A persistent plain object or array.
     *
     * See also [[PersistoOptions]].
     */
    class PersistentObject {
        constructor(namespace, options) {
            this.version = "v2.0.1-0"; // Set to semver by 'grunt release'
            this._checkTimer = null;
            this.offline = undefined;
            this.phase = Phase.Idle;
            this.status = Status.Ok;
            this.uncommittedSince = 0;
            this.unpushedSince = 0;
            this.lastUpdate = 0;
            this.lastPull = 0;
            this.commitCount = 0;
            this.pushCount = 0;
            this.lastModified = 0;
            let dfd = new Deferred();
            this.ready = dfd.promise();
            this.namespace = namespace;
            if (!namespace) {
                throw new Error("Missing required argument: namespace");
            }
            this.opts = extend({
                remote: null,
                defaults: {},
                attachForm: null,
                statusElement: null,
                commitDelay: 500,
                createParents: true,
                maxCommitDelay: 3000,
                pushDelay: 5000,
                maxPushDelay: 30000,
                storage: window.localStorage,
                debugLevel: default_debuglevel,
                // Events
                change: noop,
                update: noop,
                commit: noop,
                conflict: noop,
                error: noop,
                pull: noop,
                push: noop,
                save: noop,
                status: noop,
            }, options);
            this.storage = this.opts.storage;
            this._data = this.opts.defaults;
            // this.ready = new Promise();
            if (typeof this.opts.attachForm === "string") {
                this.form = document.querySelector(this.opts.attachForm);
            }
            else if (this.opts.attachForm instanceof HTMLElement) {
                this.form = this.opts.attachForm;
            }
            if (typeof this.opts.statusElement === "string") {
                this.statusElement = document.querySelector(this.opts.statusElement);
            }
            else if (this.opts.statusElement instanceof HTMLElement) {
                this.statusElement = this.opts.statusElement;
            }
            // _data contains the default value. Now load from persistent storage if any
            let prevValue = this.storage ? this.storage.getItem(this.namespace) : null;
            // Monitor form changes
            if (this.form) {
                this.form.classList.add("persisto");
                onEvent(this.form, "input", "input,textarea", (e) => {
                    this.readFromForm(this.form);
                });
                onEvent(this.form, "change", "select", (e) => {
                    this.readFromForm(this.form);
                });
                this.form.addEventListener("submit", (e) => {
                    this.readFromForm(this.form);
                    e.preventDefault();
                });
                this.form.addEventListener("reset", (e) => {
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
                        console.warn(this + ": could not init from remote; falling back default.", arguments);
                    }
                    else {
                        console.warn(this + ": could not init from remote; falling back to storage.", arguments);
                        // this._data = JSON.parse(prevValue);
                        this._data = extend({}, this.opts.defaults, JSON.parse(prevValue));
                    }
                    dfd.reject(reason);
                });
            }
            else if (prevValue != null) {
                this.update();
                // We still extend from opts.defaults, in case some fields were missing
                this._data = extend({}, this.opts.defaults, this._data);
                // this.debug("init from storage", this._data);
                dfd.resolve(this);
                // this.lastUpdate = stamp;
                // this.setDirty();
            }
            else {
                // this.debug("init to default", this._data);
                dfd.resolve(this);
            }
        }
        _setStatus(status) {
            this.debug("status " + this.status + " => " + status);
            this.status = status;
            function _setClass(elem) {
                if (elem) {
                    for (let s in Status) {
                        s = s.toLocaleLowerCase();
                        toggleClass(elem, class_prefix + s, status === s);
                    }
                }
            }
            _setClass(this.form);
            _setClass(this.statusElement);
            this.opts.status.call(this, status);
        }
        /** Trigger commit/push according to current settings. */
        _invalidate(hint, deferredCall) {
            let now = Date.now(), prevChange = this.lastModified || now, // first change?
            nextCommit = 0, nextPush = 0, nextCheck = 0;
            if (this._checkTimer) {
                clearTimeout(this._checkTimer);
                this._checkTimer = null;
            }
            if (deferredCall) {
                this.debug("_invalidate() recursive");
            }
            else {
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
                if (now - prevChange >= this.opts.commitDelay ||
                    now - this.uncommittedSince >= this.opts.maxCommitDelay) {
                    this.debug("_invalidate(): force commit", now - prevChange >= this.opts.commitDelay, now - this.uncommittedSince >= this.opts.maxCommitDelay);
                    this.commit();
                }
                else {
                    // otherwise schedule next check
                    nextCommit = Math.min(now + this.opts.commitDelay + 1, this.uncommittedSince + this.opts.maxCommitDelay + 1);
                }
            }
            if (this.opts.remote) {
                if (now - prevChange >= this.opts.pushDelay ||
                    now - this.unpushedSince >= this.opts.maxPushDelay) {
                    this.debug("_invalidate(): force push", now - prevChange >= this.opts.pushDelay, now - this.unpushedSince >= this.opts.maxPushDelay);
                    this.push();
                }
                else {
                    nextPush = Math.min(now + this.opts.pushDelay + 1, this.unpushedSince + this.opts.maxPushDelay + 1);
                }
            }
            if (nextCommit || nextPush) {
                nextCheck = Math.min(nextCommit || MAX_INT, nextPush || MAX_INT);
                // this.debug("Defer update:", nextCheck - now)
                this.debug("_invalidate(" + hint + ") defer by " + (nextCheck - now) + "ms");
                this._checkTimer = setTimeout(() => {
                    this._checkTimer = null; // no need to call clearTimeout in the handler...
                    this._invalidate.call(this, "deferred " + hint, true);
                }, nextCheck - now);
            }
        }
        /**
         * Write data to localStorage, check if conflict and trigger events.
         */
        _update(objData) {
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
        debug(...args) {
            if (this.opts.debugLevel >= 2) {
                Array.prototype.unshift.call(args, this.toString());
                console.log.apply(console, args);
            }
        }
        /* Log to console if opts.debugLevel >= 1 */
        log(...args) {
            if (this.opts.debugLevel >= 1) {
                Array.prototype.unshift.call(args, this.toString());
                console.log.apply(console, args);
            }
        }
        /** Return *true* if there are uncommited or unpushed modifications. */
        isDirty() {
            return !!((this.storage && this.uncommittedSince) ||
                (this.opts.remote && this.unpushedSince));
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
        get(key) {
            let i, cur = this._data, parts = ("" + key) // convert to string
                .replace(/\[(\w+)\]/g, ".$1") // convert indexes to properties
                .replace(/^\./, "") // strip a leading dot
                .split(".");
            for (i = 0; i < parts.length; i++) {
                cur = cur[parts[i]];
                if (cur === undefined && i < parts.length - 1) {
                    throw new Error(this +
                        ": Property '" +
                        key +
                        "' could not be accessed because parent '" +
                        parts.slice(0, i + 1).join(".") +
                        "' does not exist");
                }
            }
            return cur;
        }
        /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
        _setOrRemove(key, value, remove) {
            let i, parent, cur = this._data, parts = ("" + key) // convert to string
                .replace(/\[(\w+)\]/g, ".$1") // convert indexes to properties
                .replace(/^\./, "") // strip a leading dot
                .split("."), lastPart = parts.pop(); // '!': Cannot be empty (silence linter)
            for (i = 0; i < parts.length; i++) {
                parent = cur;
                cur = parent[parts[i]];
                // Create intermediate parent objects properties if required
                if (cur === undefined) {
                    if (this.opts.createParents) {
                        this.debug("Creating intermediate parent '" + parts[i] + "'");
                        cur = parent[parts[i]] = {};
                    }
                    else {
                        throw new Error(this +
                            ": Property '" +
                            key +
                            "' could not be set because parent '" +
                            parts.slice(0, i + 1).join(".") +
                            "' does not exist");
                    }
                }
            }
            if (cur[lastPart] !== value) {
                if (remove === true) {
                    delete cur[lastPart];
                    this._invalidate("remove");
                }
                else {
                    cur[lastPart] = value;
                    this._invalidate("set");
                }
            }
        }
        /**  Modify object property and set the `dirty` flag (`key` supports dot notation).
         *
         *value* must be [convertible to JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). */
        set(key, value) {
            return this._setOrRemove(key, value, false);
        }
        /** Delete object property and set the `dirty` flag (`key` supports dot notation). */
        remove(key) {
            return this._setOrRemove(key, undefined, true);
        }
        /**
         * Replace data object with a new instance and set the `dirty` flag.
         *
         * @param newData is optional and defaults to `{}`
         */
        reset(newData) {
            this._data = newData || {};
            this._invalidate("reset");
        }
        /**
         * Flag object as *modified*, so that commit / push will be scheduled.
         */
        setDirty(flag) {
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
                throw new Error(this + ": Trying to update while '" + this.phase + "' is pending.");
            }
            if (this.opts.debugLevel >= 2 && console.time) {
                console.time(this + ".update");
            }
            let data = this.storage.getItem(this.namespace); // '!' marks it as 'is a string'
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
                throw new Error(this + ": Trying to commit while '" + this.phase + "' is pending.");
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
                throw new Error(this + ": Trying to pull while '" + this.phase + "' is pending.");
            }
            if (this.opts.debugLevel >= 2 && console.time) {
                console.time(this + ".pull");
            }
            this.phase = Phase.Pull;
            this._setStatus(Status.Loading);
            return fetch(this.opts.remote, { method: "GET" })
                .then((response) => {
                if (!response.ok) {
                    throw new Error("GET " +
                        this.opts.remote +
                        " returned " +
                        response.status +
                        ", " +
                        response);
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
            }
            else {
                jsonData = JSON.stringify(this._data);
            }
            if (this.phase) {
                throw new Error(this + ": Trying to push while '" + this.phase + "' is pending.");
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
                    throw new Error("PUT " +
                        this.opts.remote +
                        " returned " +
                        response.status +
                        ", " +
                        response);
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
        readFromForm(form, options) {
            let opts = extend({
                addNew: false,
                coerce: true,
                trim: true,
            }, options);
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
            each(this._data, (k, _v) => {
                let val, type, inputItems = form.querySelectorAll("[name='" + k + "']"), item = inputItems[0];
                if (!inputItems.length) {
                    this.debug("readFromForm: field not found: '" + k + "'");
                    return; // continue iteration
                }
                type = item.getAttribute("type");
                if (type === "radio") {
                    // TODO: querySelector() may return null:
                    // val = form.querySelector("[name='" + k + "']:checked").value;
                    val = form[k].value;
                }
                else if (type === "checkbox" && inputItems.length === 1) {
                    // Single checkbox is handled as bool
                    val = !!item.checked;
                }
                else if (type === "checkbox" && inputItems.length > 1) {
                    // Multi-checkbox group is handled as array of values
                    val = [];
                    inputItems.forEach((elem) => {
                        if (elem.checked) {
                            val.push(elem.value);
                        }
                    });
                }
                else if (item.matches("select")) {
                    if (item.multiple) {
                        // Multiselect listbox
                        val = [];
                        Array.from(item.selectedOptions).forEach((elem) => {
                            val.push(elem.value);
                        });
                    }
                    else {
                        // sinlge select listbox
                        val = item.options[item.selectedIndex].value;
                    }
                }
                else {
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
        writeToForm(form, options) {
            let i, elem, match;
            form = form || this.form;
            if (typeof form === "string") {
                form = document.querySelector(form);
            }
            each(this._data, (k) => {
                let v = this.get(k), vIsArray = Array.isArray(v), inputItems = form.querySelectorAll("[name='" + k + "']");
                if (!inputItems.length) {
                    return; // continue iteration
                }
                let item = inputItems[0], type = item.getAttribute("type");
                if (type === "radio") {
                    inputItems.forEach((elem) => {
                        elem.checked = elem.value === v;
                    });
                }
                else if (type === "checkbox") {
                    if (inputItems.length === 1) {
                        // single checkbox treated as bool
                        item.checked = !!v;
                    }
                    else {
                        // multi-checkbox group is treated as array of values
                        for (i = 0; i < inputItems.length; i++) {
                            elem = inputItems[i];
                            match = vIsArray ? v.indexOf(elem.value) >= 0 : elem.value === v;
                            elem.checked = match;
                        }
                    }
                }
                else if (item.matches("select")) {
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
                }
                else if (type === "file") ;
                else {
                    item.value = v;
                }
            });
        }
    }

    exports.PersistentObject = PersistentObject;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
