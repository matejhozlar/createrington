import EventEmitter from "node:events";

export interface TypedEventEmitter<T> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(
    event: K,
    ...args: T[K] extends (...args: infer A) => unknown ? A : never
  ): boolean;
}

export function typedEmitter<T>() {
  return EventEmitter as new () => TypedEventEmitter<T> & EventEmitter;
}
