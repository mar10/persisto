/*!
 * persisto.js - utils
 * Copyright (c) 2016-2021, Martin Wendt (https://wwWendt.de)
 * Released under the MIT license
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
            throw new Error("already fulfilled");
        }
        this.status = "resolved";
        this.resolvedValue = value;
        this.thens.forEach((t) => t(value));
        this.thens = []; // Avoid memleaks.
    }
    reject(error) {
        if (this.status) {
            throw new Error("already fulfilled");
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
 * Copyright (c) 2016-2021, Martin Wendt (https://wwWendt.de)
 * Released under the MIT license
 *
 * @version @VERSION
 * @date @DATE
 */
/**
 * A persistent plain object or array.
 */
class PersistentObject {
    // ready: Promise<any>;
    constructor(namespace, options) {
        this.version = "@VERSION"; // Set to semver by 'grunt release'
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
        // let stamp = Date.now()
        this.namespace = namespace;
        if (!namespace) {
            error("Missing required argument: namespace");
        }
        // if( !new.target ) { error("Must use `new`")}
        this.opts = extend({
            remote: null,
            defaults: {},
            commitDelay: 500,
            createParents: true,
            maxCommitDelay: 3000,
            pushDelay: 5000,
            maxPushDelay: 30000,
            storage: window.localStorage,
            // Default debugLevel is set to 1 by `grunt build`:
            debugLevel: 2,
            // Events
            change: noop,
            commit: noop,
            conflict: noop,
            error: noop,
            pull: noop,
            push: noop,
            update: noop,
        }, options);
        this.storage = this.opts.storage;
        this._data = this.opts.defaults;
        // this.ready = new Promise();
        // _data contains the default value. Now load from persistent storage if any
        let prevValue = this.storage ? this.storage.getItem(this.namespace) : null;
        let self = this;
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
            // eslint-disable-next-line no-negated-condition
        }
        else if (prevValue != null) {
            this.update();
            // We still extend from opts.defaults, in case some fields where missing
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
    /* Trigger commit/push according to current settings. */
    _invalidate(hint, deferredCall) {
        let self = this, prevChange = this.lastModified, now = Date.now(), nextCommit = 0, nextPush = 0, nextCheck = 0;
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
            this.opts.change(hint);
        }
        if (this.storage) {
            // If we came here by a deferred timer (or delay is 0), commit
            // immediately
            if (prevChange !== 0 && // do not force commit if this is the first change
                (now - prevChange >= this.opts.commitDelay ||
                    now - this.uncommittedSince >= this.opts.maxCommitDelay)) {
                this.debug("_invalidate(): force commit", now - prevChange >= this.opts.commitDelay, now - this.uncommittedSince >= this.opts.maxCommitDelay, prevChange);
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
    /* Load data from localStorage. */
    _update(objData) {
        if (this.uncommittedSince) {
            console.warn("Updating an uncommitted object.");
            if (this.opts.conflict(objData, this._data) === false) {
                return;
            }
        }
        this._data = objData;
        // this.dirty = false;
        this.lastUpdate = Date.now();
    }
    /* Return readable string representation for this instance. */
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
    /** Return true if there are uncommited or unpushed modifications. */
    isDirty() {
        return !!((this.storage && this.uncommittedSince) ||
            (this.opts.remote && this.unpushedSince));
    }
    /** Return true if initial pull has completed. */
    isReady() {
        error("Not implemented");
        // return this.ready.state !== "pending";
    }
    /** Access object property (`key` supports dot notation). */
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
    /* Modify object property and set the `dirty` flag (`key` supports dot notation). */
    _setOrRemove(key, value, remove) {
        let i, parent, cur = this._data, parts = ("" + key) // convert to string
            .replace(/\[(\w+)\]/g, ".$1") // convert indexes to properties
            .replace(/^\./, "") // strip a leading dot
            .split("."), lastPart = parts.pop();
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
    /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
    set(key, value) {
        return this._setOrRemove(key, value, false);
    }
    /** Delete object property and set the `dirty` flag (`key` supports dot notation). */
    remove(key) {
        return this._setOrRemove(key, undefined, true);
    }
    /** Replace data object with a new instance. */
    reset(obj) {
        this._data = obj || {};
        this._invalidate("reset");
    }
    /** Flag object as modified, so that commit / push will be scheduled. */
    setDirty(flag) {
        if (flag !== false) {
            this._invalidate("explicit");
        }
    }
    /** Load data from localStorage. */
    update() {
        if (this.phase) {
            error(this + ": Trying to update while '" + this.phase + "' is pending.");
        }
        if (this.opts.debugLevel >= 2 && console.time) {
            console.time(this + ".update");
        }
        let data = this.storage.getItem(this.namespace);
        data = JSON.parse(data);
        this._update(data);
        if (this.opts.debugLevel >= 2 && console.time) {
            console.timeEnd(this + ".update");
        }
    }
    /** Write data to localStorage. */
    commit() {
        let jsonData;
        if (this.phase) {
            error(this + ": Trying to commit while '" + this.phase + "' is pending.");
        }
        if (this.opts.debugLevel >= 2 && console.time) {
            console.time(this + ".commit");
        }
        // try { data = JSON.stringify(this._data); } catch(e) { }
        jsonData = JSON.stringify(this._data);
        this.storage.setItem(this.namespace, jsonData);
        // this.dirty = false;
        this.uncommittedSince = 0;
        this.commitCount += 1;
        // this.lastCommit = Date.now();
        if (this.opts.debugLevel >= 2 && console.time) {
            console.timeEnd(this + ".commit");
        }
        return jsonData;
    }
    /** Download, then update data from the cloud. */
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
                self.opts.pull(arguments);
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
        })
            .catch(function () {
            console.error(arguments);
            self.opts.error(arguments);
        })
            .finally(function () {
            self.phase = null;
            if (self.opts.debugLevel >= 2 && console.time) {
                console.timeEnd(self + ".pull");
            }
        });
    }
    /** Commit, then upload data to the cloud. */
    push() {
        let self = this, jsonData = this.commit();
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
            body: jsonData,
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then(function (response) {
            // console.log("PUT", arguments);
            // self.lastPush = Date.now();
            if (response.ok) {
                self.opts.push(arguments);
            }
            else {
                error("PUT " +
                    self.opts.remote +
                    " returned " +
                    response.status +
                    ", " +
                    response);
            }
            self.unpushedSince = 0;
            self.pushCount += 1;
        })
            .catch(function () {
            self.opts.error(arguments);
        })
            .finally(function () {
            self.phase = null;
            if (self.opts.debugLevel >= 2 && console.time) {
                console.timeEnd(self + ".push");
            }
        });
    }
    /** Read data properties from form input elements with the same name.
     * Supports elements of input (type: text, radio, checkbox), textarea,
     * and select.
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
        each(this._data, function (k, v) {
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

export { PersistentObject };
