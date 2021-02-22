(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.mar10 = {}));
}(this, (function (exports) { 'use strict';

    /*!
     * persisto.js - utils
     * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
     * v2.0.1-0, Mon, 22 Feb 2021 20:54:30 GMT (https://github.com/mar10/persisto)
     */
    const MAX_INT = 9007199254740991;
    /**
     * Deferred is a ES6 Promise, that exposes the resolve() method
     */
    class Deferred {
        constructor() {
            this.thens = [];
            this.catches = [];
            this.status = "";
        }
        resolve(value) {
            if (this.status) {
                throw new Error("already settled");
            }
            this.status = "resolved";
            this.resolvedValue = value;
            this.thens.forEach((t) => t(value));
            this.thens = []; // Avoid memleaks.
        }
        reject(error) {
            if (this.status) {
                throw new Error("already settled");
            }
            this.status = "rejected";
            this.rejectedError = error;
            this.catches.forEach((c) => c(error));
            this.catches = []; // Avoid memleaks.
        }
        then(cb) {
            if (status === "resolved") {
                cb(this.resolvedValue);
            }
            else {
                this.thens.unshift(cb);
            }
        }
        catch(cb) {
            if (this.status === "rejected") {
                cb(this.rejectedError);
            }
            else {
                this.catches.unshift(cb);
            }
        }
        promise() {
            return {
                then: this.then,
                catch: this.catch,
            };
        }
    }
    // function delegate(rootElem:any, selector:string, event:Event, handler:(ev:Event)=>boolean|undefined,bind?:any):boolean|undefined {
    //   let nearest = event.target!.closest(selector);
    //   if (nearest && rootElem.contains(nearest)) {
    //     return handler.call(bind, event);
    //   }
    //   return
    // }
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
    function error(msg) {
        throw new Error(msg);
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
     * persisto.js
     *
     * Persistent JavaScript objects and web forms using Web Storage.
     *
     * Copyright (c) 2016-2021, Martin Wendt (https://wwWendt.de).
     * Released under the MIT license.
     *
     * @version v2.0.1-0
     * @date Mon, 22 Feb 2021 20:54:30 GMT
     */
    const default_debuglevel = 1; // Replaced by rollup script
    const class_modified = "persisto-modified";
    const class_saving = "persisto-saving";
    const class_error = "persisto-error";
    /**
     * A persistent plain object or array.
     *
     * See also [[PersistoOptions]].
     */
    class PersistentObject {
        // ready: Promise<any>;
        constructor(namespace, options) {
            this.version = "v2.0.1-0"; // Set to semver by 'grunt release'
            this._checkTimer = null;
            this.offline = undefined;
            this.phase = null;
            this.uncommittedSince = 0;
            this.unpushedSince = 0;
            this.lastUpdate = 0;
            this.lastPull = 0;
            this.commitCount = 0;
            this.pushCount = 0;
            this.lastModified = 0;
            let dfd = new Deferred();
            this.namespace = namespace;
            if (!namespace) {
                error("Missing required argument: namespace");
            }
            this.opts = extend({
                remote: null,
                defaults: {},
                attachForm: null,
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
            // _data contains the default value. Now load from persistent storage if any
            let prevValue = this.storage ? this.storage.getItem(this.namespace) : null;
            let self = this;
            // Monitor form changes
            if (this.form) {
                this.form.classList.add("persisto");
                onEvent(this.form, "input", "input,textarea", function (e) {
                    self.readFromForm(self.form);
                });
                onEvent(this.form, "change", "select", function (e) {
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
                        console.warn(self + ": could not init from remote; falling back default.", arguments);
                    }
                    else {
                        console.warn(self + ": could not init from remote; falling back to storage.", arguments);
                        // self._data = JSON.parse(prevValue);
                        self._data = extend({}, self.opts.defaults, JSON.parse(prevValue));
                    }
                    dfd.resolve();
                });
            }
            else if (prevValue != null) {
                this.update();
                // We still extend from opts.defaults, in case some fields were missing
                this._data = extend({}, this.opts.defaults, this._data);
                // this.debug("init from storage", this._data);
                dfd.resolve();
                // this.lastUpdate = stamp;
                // this.setDirty();
            }
            else {
                // this.debug("init to default", this._data);
                dfd.resolve();
            }
        }
        /** Trigger commit/push according to current settings. */
        _invalidate(hint, deferredCall) {
            let self = this, now = Date.now(), prevChange = this.lastModified || now, // first change?
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
                if (this.form) {
                    this.form.classList.add(class_modified);
                    this.form.classList.remove(class_error);
                }
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
                this._checkTimer = setTimeout(function () {
                    self._checkTimer = null; // no need to call clearTimeout in the handler...
                    self._invalidate.call(self, "deferred " + hint, true);
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
            error("Not implemented");
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
            // NOTE: this is slower (tested on Safari):
            // return key.split(".").reduce(function(prev, curr) {
            // 	return prev[curr];
            // }, this._data);
            for (i = 0; i < parts.length; i++) {
                cur = cur[parts[i]];
                if (cur === undefined && i < parts.length - 1) {
                    error(this +
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
                        error(this +
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
                error(this + ": Trying to update while '" + this.phase + "' is pending.");
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
                }
                else {
                    error("GET " +
                        self.opts.remote +
                        " returned " +
                        response.status +
                        ", " +
                        response);
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
            }
            else {
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
                    error("PUT " +
                        self.opts.remote +
                        " returned " +
                        response.status +
                        ", " +
                        response);
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
        readFromForm(form, options) {
            let self = this;
            let opts = extend({
                addNew: false,
                coerce: true,
                trim: true,
            }, options);
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
            each(this._data, function (k, _v) {
                let val, type, inputItems = form.querySelectorAll("[name='" + k + "']"), item = inputItems[0];
                if (!inputItems.length) {
                    self.debug("readFromForm: field not found: '" + k + "'");
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
                    inputItems.forEach(function (elem) {
                        if (elem.checked) {
                            val.push(elem.value);
                        }
                    });
                }
                else if (item.matches("select")) {
                    if (item.multiple) {
                        // Multiselect listbox
                        val = [];
                        Array.from(item.selectedOptions).forEach(function (elem) {
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
                self.set(k, val);
            });
            // console.log("readFromForm: '" + this + "'", this._data);
        }
        /** Write data to form elements with the same name.
         *
         * *form* may be a form selector or HTMLElement object. Example: `"#myForm"`.
         */
        writeToForm(form, options) {
            let i, elem, match, self = this;
            if (typeof form === "string") {
                form = document.querySelector(form);
            }
            each(this._data, function (k) {
                let v = self.get(k), vIsArray = Array.isArray(v), inputItems = form.querySelectorAll("[name='" + k + "']");
                if (!inputItems.length) {
                    return; // continue iteration
                }
                let item = inputItems[0], type = item.getAttribute("type");
                if (type === "radio") {
                    inputItems.forEach(function (elem) {
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
    // let p = new PersistentObject("namespace", {
    //   remote: null,
    //   change: function () {
    //     return 3;
    //   },
    //   conflict: (...args) => {return true}
    // });
    // export default PersistentObject;

    exports.PersistentObject = PersistentObject;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
