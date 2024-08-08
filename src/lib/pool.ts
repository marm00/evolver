/** Explicit contract for {@link Pool} items: the item must implement a `reset` method. */
export interface Resettable {
    /** Resets the item to its default state. Executed by pools: {@link Pool.free}. */
    reset(): void;
}

/** A pool of reusable items of type `T`. Reduces garbage collection for temporary objects. */
export class Pool<T extends Resettable> {
    private items: T[];
    private create: () => T;

    /** Creates a new pool with the given create function and initial length. The create function should return a *reset* or 'zero' instance. */
    constructor(create: () => T, initialLength = 0) {
        this.create = create;
        this.items = [];
        for (let i = 0; i < initialLength; i++) {
            this.items.push(this.create());
        }
    }

    /** Allocates an item from the pool, or creates a new one if the pool is empty. */
    alloc(): T {
        // console.log(this.items.length)
        return this.items.pop() ?? this.create();
    }

    /** Releases an item back to the pool for reuse, resets on demand (explicit pool responsibility). */
    free(item: T, reset = false): void {
        if (reset) {
            item.reset();
        }
        this.items.push(item);
    }

    /** 
     * Clears the items in the pool. Does not reuse items if `keepLength > 0`, but creates new ones.
     * 
     * @param keepLength The number of items to recreate in the pool. If 0, all items are cleared.
     * @param reset Whether to reset the items to their default state. Defaults to false.
     */
    clear(keepLength = 0, reset = false): void {
        if (reset) {
            for (const item of this.items) {
                item.reset();
            }
        }
        this.items = [];
        for (let i = 0; i < keepLength; i++) {
            this.items.push(this.create());
        }
    }

    /** Returns the number of items in the pool. */
    length(): number {
        return this.items.length;
    }
}