import { type Resettable } from "./pool";
import { Vector2 } from "./vector2";

/**
 * A 2x2 matrix with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order):
 * 
 * E.g. `a12` is the element in the first row and second column, indexable as `this.elements[2]`.
 * 
 * >```
 * a11  |> a12   ==  0  |> 2
 * a21  >^ a22   ==  1  >^ 3
 * >```
 */
export class Matrix2 implements Resettable {
    elements: Float32Array;

    /** 
     * Constructs a new 2x2 matrix with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order).
     */
    constructor(
        //   row 1 ,      row 2 ,
        a11: number, a21: number, // col 1
        a12: number, a22: number  // col 2
    ) {
        this.elements = new Float32Array(4);
        const a = this.elements;
        //1   row ,   2   row ;
        a[0] = a11, a[1] = a21; // col 1
        a[2] = a12, a[3] = a22; // col 2
    }

    /** Constructs and returns a new [identity matrix](https://en.wikipedia.org/wiki/Identity_matrix). */
    static identity(this: void): Matrix2 {
        return new Matrix2(
            1, 0, // col 1
            0, 1, // col 2
        );
    }

    /** Resets the matrix to the [identity matrix](https://en.wikipedia.org/wiki/Identity_matrix). */
    reset(): void {
        const a = this.elements;
        //1 row ,   2 row ;
        a[0] = 1, a[1] = 0; // col 1
        a[2] = 0, a[3] = 1; // col 2
    }

    /** Sets the matrix elements with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order). */
    set(//r1           r2           
        a11: number, a21: number, // col 1
        a12: number, a22: number  // col 2
    ): this {
        const a = this.elements;
        //1   row ,   2   row ;
        a[0] = a11, a[1] = a21; // col 1
        a[2] = a12, a[3] = a22; // col 2
        return this;
    }

    /** Sets the transformation matrix to the basis vectors of the given coordinates via 90 degrees counterclockwise rotation. */
    setRotation(x: number, y: number): this {
        const a = this.elements;
        //1 row ,   2 row ;
        a[0] = x, a[1] = y; // col 1
        a[2] = y, a[3] = -x; // col 2
        return this;
    }

    /** Sets the transformation matrix to the given direction or angle in radians. */
    setRotationAngle(angle: number): this {
        const a = this.elements;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        //1   row ,   2   row  ;
        a[0] = cos, a[1] = -sin; // col 1
        a[2] = sin, a[3] = cos; // col 2
        return this;
    }

    /** Sets the transformation matrix to the given scaling factors. */
    setScaling(x: number, y: number): this {
        const a = this.elements;
        //1   row , 2   row ;
        a[0] = x, a[1] = 0; // col 1
        a[2] = 0, a[3] = y; // col 2
        return this;
    }

    /** Returns true if the matrix is the identity matrix. */
    isIdentity(): boolean {
        const a = this.elements;
        return a[0] === 1 && a[1] === 0 && a[2] === 0 && a[3] === 1;
    }
}
