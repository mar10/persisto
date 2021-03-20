/*!
 * persisto.js - utils
 * Copyright (c) 2016-2021, Martin Wendt. Released under the MIT license.
 * @VERSION, @DATE (https://github.com/mar10/persisto)
 */

export const MAX_INT = 9007199254740991;

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
export function onEvent(
  element: HTMLElement | string,
  eventName: string,
  selector: string,
  handler: (e: Event) => boolean | void,
  bind?: any
): void {
  if (typeof element === "string") {
    element = <HTMLElement>document.querySelector(element);
  }
  element.addEventListener(eventName, function (e) {
    if (e.target && (<HTMLElement>e.target).matches(selector)) {
      if (bind) {
        return handler.call(bind, e);
      } else {
        return handler(e);
      }
    }
  });
}

export function toggleClass(
  element: HTMLElement | string,
  classname: string,
  force?: boolean
): void {
  if (typeof element === "string") {
    element = <HTMLElement>document.querySelector(element);
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

export function each(obj: any, callback: any) {
  if (obj == null) {
    // accept `null` or `undefined`
    return obj;
  }
  let length = obj.length,
    i = 0;

  if (typeof length === "number") {
    for (; i < length; i++) {
      if (callback.call(obj[i], i, obj[i]) === false) {
        break;
      }
    }
  } else {
    for (let i in obj) {
      if (callback.call(obj[i], i, obj[i]) === false) {
        break;
      }
    }
  }
  return obj;
}

export function error(msg: string) {
  throw new Error(msg);
}

export function extend(...args: any[]) {
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

export function isEmptyObject(obj: any) {
  // let name;
  // // eslint-disable-next-line guard-for-in
  // for (name in obj) {
  //   return false;
  // }
  // return true;
  // because Object.keys(new Date()).length === 0
  // we have to do some additional check
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export function isPlainObject(obj: any) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}

export function noop(): any {}
export function ready(fn: any) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

export function type(obj: any) {
  return Object.prototype.toString
    .call(obj)
    .replace(/^\[object (.+)\]$/, "$1")
    .toLowerCase();
}
