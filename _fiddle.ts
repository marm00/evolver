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

const iterations = 1000000000;
console.log("Static:", staticZeros(iterations), "ms");
console.log("Clone:", cloneZeros(iterations), "ms");
console.log("New:", newZeros(iterations), "ms");