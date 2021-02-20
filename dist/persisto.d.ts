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
    interface PersistoOptions {
        remote?: any;
        defaults?: any;
        commitDelay?: number;
        createParents?: boolean;
        maxCommitDelay?: number;
        pushDelay?: number;
        maxPushDelay?: number;
        storage?: any;
        debugLevel?: number;
        change?: (hint: string) => void;
        commit?: (hint: string) => void;
        conflict?: (hint: string) => boolean;
        error?: (hint: string) => void;
        pull?: (hint: string) => void;
        push?: (hint: string) => void;
        update?: (hint: string) => void;
    }
    /**
     * A persistent plain object or array.
     */
    export class PersistentObject {
        version: string;
        protected _data: any;
        protected opts: any;
        protected storage: Storage;
        protected _checkTimer: any;
        readonly namespace: string;
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
        _invalidate(hint: string, deferredCall?: boolean): void;
        _update(objData: any): void;
        toString(): string;
        debug(...args: any[]): void;
        log(...args: any[]): void;
        /** Return true if there are uncommited or unpushed modifications. */
        isDirty(): boolean;
        /** Return true if initial pull has completed. */
        isReady(): void;
        /** Access object property (`key` supports dot notation). */
        get(key: string): any;
        _setOrRemove(key: string, value: any, remove?: boolean): void;
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
    export default PersistentObject;
}
