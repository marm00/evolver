// Unused test file

class A {
    x;
    y;

    constructor(x, y) {
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

function staticZeros(iterations) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        const a = A.zero();
    }
    const end = performance.now();
    return end - start;
}

function cloneZeros(iterations) {
    const start = performance.now();
    const zero = new A(0, 0);
    for (let i = 1; i < iterations; i++) {
        const a = zero.clone();
    }
    const end = performance.now();
    return end - start;
}

const iterations = 100000000;
console.log("Static:", staticZeros(iterations), "ms");
console.log("Clone:", cloneZeros(iterations), "ms");