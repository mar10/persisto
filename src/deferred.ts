/*!
 * persisto.js - deferred
 * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
 * @VERSION, @DATE (https://github.com/mar10/persisto)
 */

type promiseCallbackType = (val: any) => void;
type finallyCallbackType = () => void;

/**
 * Deferred is a ES6 Promise, that exposes the resolve() and reject()` method.
 *
 * Loosely mimics [`jQuery.Deferred`](https://api.jquery.com/category/deferred-object/).
 */
export class Deferred {
  private _promise: Promise<any>;
  protected _resolve: any;
  protected _reject: any;

  constructor() {
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
  /** Resolve the [[Promise]]. */
  resolve(value?: any) {
    this._resolve(value);
  }
  /** Reject the [[Promise]]. */
  reject(reason?: any) {
    this._reject(reason);
  }
  /** Return the native [[Promise]] instance.*/
  promise() {
    return this._promise;
  }
  /** Call [[Promise.then]] on the embedded promise instance.*/
  then(cb: promiseCallbackType) {
    return this._promise.then(cb);
  }
  /** Call [[Promise.catch]] on the embedded promise instance.*/
  catch(cb: promiseCallbackType) {
    return this._promise.catch(cb);
  }
  /** Call [[Promise.finally]] on the embedded promise instance.*/
  finally(cb: finallyCallbackType) {
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
