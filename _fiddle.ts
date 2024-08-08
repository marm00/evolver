// Unused test file

class A {
    x: number;
    y: number;

    constructor(x = 0, y = 0) { 
        this.x = x;
        this.y = y;
    }

    static zero() {
        return new A(0, 0);
    }

    clone() {
        return new A(this.x, this.y);
    }
}

function staticZeros(iterations: number) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        const a = A.zero();
    }
    const end = performance.now();
    return end - start;
}

function cloneZeros(iterations: number) {
    const start = performance.now();
    const zero = new A(0, 0);
    for (let i = 1; i < iterations; i++) {
        const a = zero.clone();
    }
    const end = performance.now();
    return end - start;
}

function newZeros(iterations: number) {
    const start = performance.now();
    for (let i = 1; i < iterations; i++) {
        const a = new A(0, 0);
    }
    const end = performance.now();
    return end - start;
}

class ClassPool {
    items: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    alloc(): number { return this.items.pop() ?? 0 }
    free(item: number): void { this.items.push(item) }
}
const pool = new ClassPool();
const items: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
function alloc(): number { return items.pop() ?? 0 }
function free(item: number): void { items.push(item) }

function allocClass(iterations: number) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        const a = pool.alloc();
        pool.free(a);
    }
    const end = performance.now();
    return end - start;
}

function allocFunctional(iterations: number) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        const a = items.pop() ?? 0;
        items.push(a);
    }
    const end = performance.now();
    return end - start;
}

class ParamOverhead {
    x = 0;
    y = 0;
    setNoFlag(x: number, y: number): void { this.x = x; this.y = y; }
    setWithFlag(x: number, y: number, flag = true): void { if (flag) { this.x = x; this.y = y; } }
}

function setNoFlag(iterations: number) {
    const start = performance.now();
    const p = new ParamOverhead();
    for (let i = 0; i < iterations; i++) {
        p.setNoFlag(0, 0);
    }
    const end = performance.now();
    return end - start;
}

function setWithFlag(iterations: number) {
    const start = performance.now();
    const p = new ParamOverhead();
    for (let i = 0; i < iterations; i++) {
        p.setWithFlag(0, 0);
    }
    const end = performance.now();
    return end - start;
}

const iterations = 1000000000;

console.log("No Flag:", setNoFlag(iterations), "ms");
console.log("With Flag:", setWithFlag(iterations), "ms");

// console.log("Class:", allocClass(iterations), "ms");
// console.log("Functional:", allocFunctional(iterations), "ms");

// console.log("Static:", staticZeros(iterations), "ms");
// console.log("Clone:", cloneZeros(iterations), "ms");
// console.log("New:", newZeros(iterations), "ms");