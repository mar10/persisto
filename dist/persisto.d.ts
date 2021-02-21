declare module "util" {
    /*!
     * persisto.js - utils
     * Copyright (c) 2016-2021, Martin Wendt (https://wwWendt.de)
     * Released under the MIT license
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
declare module "persisto" {
    /**
     * Available options for [[PersistentObject]].
     *
     * **Note:** this will be passed as plain object:
     * ```ts
     * let store = new mar10.PersistentObject("test", {
     *   store: sessionStorage,
     *   attachForm: "#form1",
     *   defaults: {
     *     title: "foo",
     *     ...
     *   }
     * });
     * ```
     */
    export interface PersistoOptions {
        /** URL for GET/PUT, ajax options, or callback */
        remote?: any;
        /** default value if no data is found in localStorage */
        defaults?: any;
        /** Track form input changes and maintain status class names. */
        attachForm?: any;
        /** Commit changes after 0.5 seconds of inactivity */
        commitDelay?: number;
        /** set() creates missing intermediate parent objects for children */
        createParents?: boolean;
        /** commit changes max. 3 seconds after first change */
        maxCommitDelay?: number;
        /** push commits after 5 seconds of inactivity */
        pushDelay?: number;
        /** push commits max. 30 seconds after first change */
        maxPushDelay?: number;
        /** localStorage */
        storage?: any;
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
        commit?: (hint: string) => void;
        /**
         * Called ...
         * @category Callback
         */
        conflict?: (hint: string) => boolean;
        /**
         * Called on errors.
         * @category Callback
         */
        error?: (hint: string) => void;
        /**
         * Called after date was read from `remote` into `store`.
         * @category Callback
         */
        pull?: (hint: string) => void;
        /**
         * Called after modified data was POSTed to `remote`.
         * @category Callback
         */
        push?: (hint: string) => void;
        /**
         * Modified data was stored.
         * If `remote` was passed, this means `push` has finished,
         * otherwise `commit` has finished.
         * @category Callback
         */
        saved?: () => void;
        /**
         * Called after ...
         * @category Callback
         */
        update?: (hint: string) => void;
    }
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
        /** Load data from localStorage. */
        protected _update(objData: any): void;
        toString(): string;
        debug(...args: any[]): void;
        log(...args: any[]): void;
        /** Return true if there are uncommited or unpushed modifications. */
        isDirty(): boolean;
        /** Return true if initial pull has completed. */
        isReady(): void;
        /** Access object property (`key` supports dot notation). */
        get(key: string): any;
        /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
        protected _setOrRemove(key: string, value: any, remove?: boolean): void;
        /** Modify object property and set the `dirty` flag (`key` supports dot notation). */
        set(key: string, value: any): void;
        /** Delete object property and set the `dirty` flag (`key` supports dot notation). */
        remove(key: string): void;
        /** Replace data object with a new instance. */
        reset(obj?: any): void;
        /** Flag object as modified, so that commit / push will be scheduled. */
        setDirty(flag?: boolean): void;
        /** Load data from localStorage. */
        update(): void;
        /** Write data to localStorage. */
        commit(): any;
        /** Download, then update data from the cloud. */
        pull(): Promise<void>;
        /** Commit, then upload data to the cloud. */
        push(): Promise<void>;
        /** Read data properties from form input elements with the same name.
         * Supports elements of input (type: text, radio, checkbox), textarea,
         * and select.
         */
        readFromForm(form: any, options?: any): void;
        /** Write data to form elements with the same name.
         */
        writeToForm(form: any, options?: any): void;
    }
}
