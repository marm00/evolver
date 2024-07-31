import { type Resettable } from "./pool";
import { Shape } from "./shape";
import { type Vector2 } from "./vector2";

/**
 * A 3x3 matrix with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order):
 * 
 * E.g. `a12` is the element in the first row and second column, indexable as `this.elements[3]`.
 * 
 * >```
 * a11  |> a12  |> a13  ==  0  |> 3  |> 6  
 * a21  || a22  || a23  ==  1  || 4  || 7
 * a31  >^ a32  >^ a33  ==  2  >^ 5  >^ 8
 * >```
 */
export class Matrix3 implements Resettable {
    elements: Float32Array;

    /** 
     * Constructs a new 3x3 Matrix3 with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order).
     */
    constructor(
        //   row 1 ,      row 2 ,      row 3 ,
        a11: number, a21: number, a31: number, // col 1
        a12: number, a22: number, a32: number, // col 2
        a13: number, a23: number, a33: number  // col 3
    ) {
        this.elements = new Float32Array(9);
        const a = this.elements;
        //1   row ,   2   row ,   3   row ;
        a[0] = a11, a[1] = a21, a[2] = a31; // col 1
        a[3] = a12, a[4] = a22, a[5] = a32; // col 2
        a[6] = a13, a[7] = a23, a[8] = a33; // col 3
    }

    /** Constructs and returns a new [identity matrix](https://en.wikipedia.org/wiki/Identity_matrix). */
    static identity(this: void): Matrix3 {
        return new Matrix3(
            1, 0, 0, // col 1
            0, 1, 0, // col 2
            0, 0, 1, // col 3
        );
    }

    /** Resets the matrix to the [identity matrix](https://en.wikipedia.org/wiki/Identity_matrix). */
    reset(): void {
        const a = this.elements;
        //1 row ,   2 row ,   3 row ;
        a[0] = 1, a[1] = 0, a[2] = 0; // col 1
        a[3] = 0, a[4] = 1, a[5] = 0; // col 2
        a[6] = 0, a[7] = 0, a[8] = 1; // col 3
    }

    /** Sets the matrix elements with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order). */
    set(//r1           r2           r3
        a11: number, a21: number, a31: number, // col 1
        a12: number, a22: number, a32: number, // col 2
        a13: number, a23: number, a33: number  // col 3
    ): this {
        const a = this.elements;
        //1   row ,   2   row ,   3   row ;
        a[0] = a11, a[1] = a21, a[2] = a31; // col 1
        a[3] = a12, a[4] = a22, a[5] = a32; // col 2
        a[6] = a13, a[7] = a23, a[8] = a33; // col 3
        return this;
    }

    /** Sets the transformation matrix to the given shape (e.g. a rectangle or circle in 2D space). */
    setShape(s: Shape): this {
        s.setMatrix(this);
        return this;
    }

    /** Returns a new Matrix3 with the same elements. */
    clone(): Matrix3 {
        const a = this.elements;
        return new Matrix3(
            //1r ,   2r ,   3r ,
            a[0]!, a[1]!, a[2]!, // column 1
            a[3]!, a[4]!, a[5]!, // column 2
            a[6]!, a[7]!, a[8]!  // column 3
        );
    }

    /** 
     * Matrix multiplication in place. Memory layout by indices:
     * 
     * >```
     * this    m
     * 0 3 6   0 3 6
     * 1 4 7   1 4 7
     * 2 5 8   2 5 8
     * >```
     */
    mul(m: Matrix3): this {
        const a = this.elements;
        const b = m.elements;

        //        col 1  ,     col 2  ,     col 3  ;
        const a11 = a[0]!, a12 = a[3]!, a13 = a[6]!; // row 1
        const a21 = a[1]!, a22 = a[4]!, a23 = a[7]!; // row 2
        const a31 = a[2]!, a32 = a[5]!, a33 = a[8]!; // row 3

        //        col 1  ,     col 2  ,     col 3  ;
        const b11 = b[0]!, b12 = b[3]!, b13 = b[6]!; // row 1
        const b21 = b[1]!, b22 = b[4]!, b23 = b[7]!; // row 2
        const b31 = b[2]!, b32 = b[5]!, b33 = b[8]!; // row 3

        a[0] = a11 * b11 + a12 * b21 + a13 * b31; // a11
        a[1] = a21 * b11 + a22 * b21 + a23 * b31; // a21
        a[2] = a31 * b11 + a32 * b21 + a33 * b31; // a31
        a[3] = a11 * b12 + a12 * b22 + a13 * b32; // a12
        a[4] = a21 * b12 + a22 * b22 + a23 * b32; // a22
        a[5] = a31 * b12 + a32 * b22 + a33 * b32; // a32
        a[6] = a11 * b13 + a12 * b23 + a13 * b33; // a13
        a[7] = a21 * b13 + a22 * b23 + a23 * b33; // a23
        a[8] = a31 * b13 + a32 * b23 + a33 * b33; // a33

        return this;
    }

    /** 
    * Inverse matrix multiplication in place. Memory layout by indices:
    * 
    * >```
    * this    m
    * 0 3 6   0 3 6
    * 1 4 7   1 4 7
    * 2 5 8   2 5 8
    * >```
    */
    premul(m: Matrix3): this {
        const a = this.elements;
        const b = m.elements;

        //        col 1  ,     col 2  ,     col 3  ;
        const a11 = a[0]!, a12 = a[3]!, a13 = a[6]!; // row 1
        const a21 = a[1]!, a22 = a[4]!, a23 = a[7]!; // row 2
        const a31 = a[2]!, a32 = a[5]!, a33 = a[8]!; // row 3

        //        col 1  ,     col 2  ,     col 3  ;
        const b11 = b[0]!, b12 = b[3]!, b13 = b[6]!; // row 1
        const b21 = b[1]!, b22 = b[4]!, b23 = b[7]!; // row 2
        const b31 = b[2]!, b32 = b[5]!, b33 = b[8]!; // row 3

        a[0] = b11 * a11 + b12 * a21 + b13 * a31; // a11
        a[1] = b21 * a11 + b22 * a21 + b23 * a31; // a21
        a[2] = b31 * a11 + b32 * a21 + b33 * a31; // a31
        a[3] = b11 * a12 + b12 * a22 + b13 * a32; // a12
        a[4] = b21 * a12 + b22 * a22 + b23 * a32; // a22
        a[5] = b31 * a12 + b32 * a22 + b33 * a32; // a32
        a[6] = b11 * a13 + b12 * a23 + b13 * a33; // a13
        a[7] = b21 * a13 + b22 * a23 + b23 * a33; // a23
        a[8] = b31 * a13 + b32 * a23 + b33 * a33; // a33

        return this;
    }

    /** Set/translate the position of the matrix origin to the given vector. */
    translate(v: Vector2): this {
        _b.set(
            1, 0, 0,    // col 1
            0, 1, 0,    // col 2
            v.x, v.y, 1 // col 3
        );
        this.premul(_b);
        return this;
    }

    /** Rotate the matrix clockwise around the origin by the given angle in radians. */
    rotate(angle: number): this {
        angle = -angle; // Negate for clockwise rotation
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        _b.set(
            cos, sin, 0,  // col 1
            -sin, cos, 0, // col 2
            0, 0, 1,      // col 3
        );
        this.premul(_b);
        return this;
    }

    /** Scales the matrix up or down by the given vector. @see {@link Vector2.scale} */
    scale(v: Vector2): this {
        _b.set(
            v.x, 0, 0, // col 1
            0, v.y, 0, // col 2
            0, 0, 1,   // col 3
        );
        this.premul(_b);
        return this;
    }

    /** 
     * Combines (not chains) {@link Matrix3.translate}, {@link Matrix3.rotate}, and {@link Matrix3.scale} into a 
     * single matrix premultiplication. The translation sets the matrix origin and the scale is multiplied by the
     * axis rotation to form the transformation matrix.
     */
    trs(translation: Vector2, rotation: number, scale: Vector2): this {
        rotation = -rotation;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        _b.set(
            scale.x * cos, sin, 0,           // col 1
            -sin, scale.y * cos, 0,          // col 2
            translation.x, translation.y, 1, // col 3
        );
        this.premul(_b);
        return this;
    }

    // TODO:  maybe a 2x3 matrix function (dont need last row often)

}

/** 
 * A privately shared Matrix3 for all Matrix3 instances, used for temporary operations like {@link Matrix3.translate}.
 * Using this architecture over a pool or pool instance parameter is faster and more convenient. The use of
 * __&#47;&#42;@&#95;&#95;PURE&#95;&#95;&#42;&#47;__ informs the compiler that this variable can be safely removed 
 * if it goes unused.
 * 
 * @see https://webpack.js.org/guides/tree-shaking/
 */
const _b = /*@__PURE__*/ new Matrix3(
    1, 0, 0, // col 1
    0, 1, 0, // col 2
    0, 0, 1, // col 3
);