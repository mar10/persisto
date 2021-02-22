declare module "util" {
    /*!
     * persisto.js - utils
     * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
     * @VERSION, @DATE (https://github.com/mar10/persisto)
     */
    export const MAX_INT = 9007199254740991;
    /**
     * Deferred is a ES6 Promise, that exposes the resolve() method
     */
    export class Deferred {
        private thens;
        private catches;
        private status;
        private resolvedValue;
        private rejectedError;
        constructor();
        resolve(value?: any): void;
        reject(error?: any): void;
        then(cb: any): void;
        catch(cb: any): void;
        promise(): {
            then: (cb: any) => void;
            catch: (cb: any) => void;
        };
    }
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
    export function onEvent(element: HTMLElement | string, eventName: string, selector: string, handler: (e: Event) => boolean | void, bind?: any): void;
    /**
     * jQuery Shims
     * http://youmightnotneedjquery.com
     */
    export function each(obj: any, callback: any): any;
    export function error(msg: string): void;
    export function extend(...args: any[]): any;
    export function isEmptyObject(obj: any): boolean;
    export function isPlainObject(obj: any): boolean;
    export function noop(): any;
    export function ready(fn: any): void;
    export function type(obj: any): any;
}
declare module "persisto_options" {
    /*!
     * persisto.js - utils
     * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
     * @VERSION, @DATE (https://github.com/mar10/persisto)
     */
    /**
     * Available options for [[PersistentObject]].
     *
     * Options are passed to the constructor as plain object:
     *
     * ```js
     * let store = new mar10.PersistentObject("test", {
     *   storage: sessionStorage,  // Default: localStorage
     *   attachForm: "#form1",
     *   defaults: {
     *     title: "foo",
     *     ...
     *   }
     * });
     * ```
     *
     * Events may be handled by passing a handler callback option:
     *
     * ```js
     * let store = new mar10.PersistentObject("mySettings", {
     *   [...]
     *   change: function(hint){
     *     alert("Store " + this + " was changed. Reason: " + hint);
     *   }
     * });
     * ```
     *
     */
    export interface PersistoOptions {
        /**
         * URL for GET/PUT request to remote server.
         *
         * Pass `null` to disable remote synchronization.<br>
         * Default: `null`.
         */
        remote?: any;
        /**
         * Default values if no data is found in localStorage.
         *
         * Default: `{}`.
         */
        defaults?: any;
        /**
         * Track form input changes and maintain status class names.
         *
         * Automatically call [[readFromForm]] when users enter form data.
         */
        attachForm?: HTMLFormElement | string;
        /**
         * Commit changes after *X* milliseconds of inactivity.
         *
         * Commit cached changes to localStorage after 0.5 seconds of inactivity.<br>
         * After each change, we wait 0.5 more seconds for additional changes to come
         * in, before the actual commit is executed.
         *
         * The maximum delay (first change until actual commit) is limited by
         * [[maxCommitDelay]].
         *
         * Set to `0` to force synchronous mode.
         * Default: `500` milliseconds.
         */
        commitDelay: number;
        /**
         * Allow [[PersistentObject.set]] to create missing intermediate parent
         * objects.
         */
        createParents?: boolean;
        /**
         * Commit changes max. *X* millseconds after first change.
         *
         * This settings limits the effect of [[commitDelay]], which would otherwise
         * never commit if the user enters keystrokes frequently.
         *
         * Default: `3000` milliseconds
        */
        maxCommitDelay?: number;
        /**
         * Push commits after *X* milliseconds of inactivity.
         *
         * Push commits to remote after 5 seconds of inactivity.<br>
         * After each change, we wait 5 more seconds for additional changes to come
         * in, before the actual push is executed.<br>
         * The maximum delay (first change until actual push) is limited by [[maxPushDelay]].
         *
         * Set to `0` to force synchronous mode.
         * Default: `5000` milliseconds
         */
        pushDelay?: number;
        /**
         * Push commits max. *X* milliseconds after first change.
         *
         * Push every commit to remote max. 30 seconds after it occurred.
         * This setting limits the effect of [[pushDelay]].
         *
         * Default: `30000` milliseconds.
         */
        maxPushDelay?: number;
        /**
         * Instance of [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).
         *
         * Possible values are `window.localStorage`, `window.sessionStorage`.<br>
         * Pass `null` to disable persistence.
         *
         * Default: `window.localStorage`
        */
        storage?: any;
        /**
         * Verbosity level: 0:quiet, 1:normal, 2:verbose.
         * Default: `1`
         */
        debugLevel?: number;
        /**
         * Called when data was changed (before comitting).
         * @category Callback
         */
        change?: (hint: string) => void;
        /**
         * Called after modified data was written to storage.
         * @category Callback
         */
        commit?: () => void;
        /**
         * Called when new data arrives from storage, while local data is still
         * uncommitted.
         *
         * Return false to prevent updating the local data with the new storage content.
         * @category Callback
         */
        conflict?: (remoteData: any, localData: any) => boolean;
        /**
         * Called on errors, e.g. when Ajax requests fails.
         * @category Callback
         */
        error?: (...args: any[]) => void;
        /**
         * Called after data was received from remote service.
         * @category Callback
         */
        pull?: (response: any) => void;
        /**
         * Called after modified data was POSTed to `remote`.
         * @category Callback
         */
        push?: (response: any) => void;
        /**
         * Modified data was stored.
         *
         * If `remote` was passed, this means `push` has finished,
         * otherwise `commit` has finished.
         * @category Callback
         */
        save?: () => void;
        /**
         * Called after data was loaded from local storage.
         * @category Callback
         */
        update?: () => void;
    }
}
declare module "persisto" {
    import { PersistoOptions } from "persisto_options";
    /**
     * A persistent plain object or array.
     *
     * See also [[PersistoOptions]].
     */
    export class PersistentObject {
        version: string;
        protected _data: any;
        protected opts: any;
        protected storage: Storage;
        protected _checkTimer: any;
        readonly namespace: string;
        protected form: any;
        protected offline: undefined | boolean;
        protected phase: string | null;
        protected uncommittedSince: number;
        protected unpushedSince: number;
        protected lastUpdate: number;
        protected lastPull: number;
        commitCount: number;
        pushCount: number;
        protected lastModified: number;
        constructor(namespace: string, options: PersistoOptions);
        /** Trigger commit/push according to current settings. */
        protected _invalidate(hint: string, deferredCall?: boolean): void;
        /**
         * Write data to localStorage, check if conflict and trigger events.
         */
        protected _update(objData: any): void;
        /**
         * Return readable string representation for this instance.
         * @internal
         */
        toString(): string;
        debug(...args: any[]): void;
        log(...args: any[]): void;
        /** Return *true* if there are uncommited or unpushed modifications. */
        isDirty(): boolean;
        /** Return true if initial pull has completed.
         *
         * See also the `store.ready` promise, that is resolved accordingly.
         */
        isReady(): void;
        /**
         * Return a data property value (`key` supports dot notation).
         */
        get(key: string): any;
        /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
        protected _setOrRemove(key: string, value: any, remove?: boolean): void;
        /**  Modify object property and set the `dirty` flag (`key` supports dot notation).
         *
         *value* must be [convertible to JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). */
        set(key: string, value: any): void;
        /** Delete object property and set the `dirty` flag (`key` supports dot notation). */
        remove(key: string): void;
        /**
         * Replace data object with a new instance and set the `dirty` flag.
         *
         * @param newData is optional and defaults to `{}`
         */
        reset(newData?: any): void;
        /**
         * Flag object as *modified*, so that commit / push will be scheduled.
         */
        setDirty(flag?: boolean): void;
        /**
         * Load data from localStorage.
         */
        update(): void;
        /**
         * Write modified data to localStorage.
         *
          (Normally there is no need to call this method, since it is triggered internally
          after a short collation interval.)
      
         */
        commit(): any;
        /** Download  data from the cloud, then call `.update()`. */
        pull(): Promise<void>;
        /** Commit, then upload data into the cloud.
         *
          (Normally there is no need to call this method, since it is triggered internally.) */
        push(): Promise<void>;
        /** Read data properties from form input elements with the same name.
         *
         * Supports elements of input (type: text, radio, checkbox), textarea,
          and select.<br>
          *form* may be a form element or selector string. Example: `"#myForm"`.<br>
          *options* is optional and defaults to <code>{addNew: false, coerce: true, trim: true}</code>.
         */
        readFromForm(form: any, options?: any): void;
        /** Write data to form elements with the same name.
         *
         * *form* may be a form selector or HTMLElement object. Example: `"#myForm"`.
         */
        writeToForm(form: any, options?: any): void;
    }
}
