export {}; // Make this a module

declare global {
  interface Array<T> {
    unique(): T[];
    first(): T | undefined;
    last(): T | undefined;
    groupBy<K>(keyFn: (item: T) => K): Map<K, T[]>;
    remove(item: T): T[];
    removeAt(index: number): T | undefined;
    insertAt(index: number, item: T): void;
    emplace(item: T, target: T, where: "before" | "after"): void;
  }
}

Array.prototype.unique = function <T>(this: T[]): T[] {
  return [...new Set(this)];
};

Array.prototype.first = function <T>(this: T[]): T | undefined {
  return this[0];
};

Array.prototype.last = function <T>(this: T[]): T | undefined {
  return this[this.length - 1];
};

Array.prototype.remove = function <T>(this: T[], item: T): T[] {
  const removed: T[] = [];
  let i = 0;
  while (i < this.length) {
    if (this[i] === item) {
      removed.push(this[i]);
      this.splice(i, 1);
    } else {
      i++;
    }
  }
  return removed;
};

Array.prototype.removeAt = function <T>(this: T[], index: number): T | undefined {
  return this.splice(index, 1)[0];
};

Array.prototype.insertAt = function <T>(this: T[], index: number, item: T): void {
  this.splice(index, 0, item);
};

Array.prototype.groupBy = function <T, K>(this: T[], keyFn: (item: T) => K): Map<K, T[]> {
  return this.reduce((map, item) => {
    const key = keyFn(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
    return map;
  }, new Map<K, T[]>());
};

Array.prototype.emplace = function <T>(
  this: T[],
  item: T,
  target: T,
  where: "before" | "after"
): void {
  const index = this.indexOf(target);
  if (index !== -1) {
    if (where === "before") {
      this.splice(index, 0, item);
    } else {
      this.splice(index + 1, 0, item);
    }
  } else {
    this.push(item);
  }
};
