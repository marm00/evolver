/** Explicit contract for {@link Pool} items: the item must implement a `set` method. */
interface Settable<T> {
    set(...args: unknown[]): T;
    // An additional copy function might necessarily be slower at runtime if just `T` is passed, 
    // specifically in the case that the pool is empty, since the generator cannot be called with just `T`.
    // This tradeoff is disadvantageous until a better solution is found.
}

/** Extracts the arguments of a {@link Settable} `set` method, whose signature should be shared with the generator. */
type SetArgs<T extends Settable<T>> = Parameters<T["set"]>;

/**
 * A stack-like pool of reusable items of type `T`. Reduces garbage collection for temporary objects.
 * 
 * @example
 * Usage with a Vector2 class
 * ```typescript
 * const initialSize = 5;
 * const v2Pool = new Pool<Vector2>((x = 0, y = 0) => new Vector2(x, y), initialSize);
 * const p_v2 = v2Pool.alloc(20, 30); // New pool size: (5-1) = 4
 * console.log(p_v2.x, p_v2.y); // 20, 30
 * v2Pool.free(p_v2);
 * ```
 * 
 * @example
 * Usage with a Square object (likely memory inefficient without a prototype)
 * ```typescript
 * interface Square { size: number; set: (size: number) => this; }
 * const squarePool = new Pool<Square>((size = 10) => ({
 *     size,
 *     set(size: number) {
 *         this.size = size;
 *         return this;
 *     }
 * }));
 * ```
 */
export class Pool<T extends Settable<T>> {
    // For items that update every frame specifically, a different pooling strategy could be used,
    // where the array contains all items of T and an occupancy number is managed, reducing the
    // amount of freeing and making the pool serve as a container.
    private available: T[] = [];

    /**
     * Creates an object pool of `T`, functions like a stack. Allocate with {@link alloc}, free with {@link free}.
     * 
     * @param generator A generator of `T`, used to create new items when the pool is empty, and optionally on construction with {@link initialSize}.
     * @param initialSize The initial size *n* of the pool, where *n* items are created using the {@link generator} and pushed to the pool.
     */
    constructor(private generator: (...args: SetArgs<T>) => T, initialSize = 0) {
        for (let i = 0; i < initialSize; i++) {
            this.available.push(this.generator(...[] as unknown as SetArgs<T>));
        }
    }

    /** Allocates and sets an item from the pool, or creates and sets a new item if the pool is empty. */
    alloc(...args: SetArgs<T>): T {
        return this.available.pop()?.set(...args) ?? this.generator(...args);
    }

    /** Releases an item back to the pool for reuse and returns the new number of available items (size). */
    free(item: T): number {
        return this.available.push(item);
    }

    /** Returns the number of available items in the pool. */
    size(): number {
        return this.available.length;
    }
}

/** Explicit contract for {@link Pool2} items: the item must implement a `reset` method. */
export interface Resettable {
    /** Resets the item to its default state. Executed by pools: {@link Pool2.free}. */
    reset(): void;
}

/** A pool of reusable items of type `T`. Reduces garbage collection for temporary objects. */
export class Pool2<T extends Resettable> {
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