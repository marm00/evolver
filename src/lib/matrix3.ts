import { type Resettable } from "./pool";

class Matrix3 implements Resettable {
    elements: Float32Array;

    /** 
     * Constructs a new 3x3 matrix with [column-major ordering](https://en.wikipedia.org/wiki/Row-_and_column-major_order):
     * 
     * >```
     * a11  |> a12  |> a13  ==  0  |> 3  |> 6  
     * a21  || a22  || a23  ==  1  || 4  || 7
     * a31  >^ a32  >^ a33  ==  2  >^ 5  >^ 8
     * >```
     */
    constructor(
        a11: number, a21: number, a31: number, // Column 1
        a12: number, a22: number, a32: number, // Column 2
        a13: number, a23: number, a33: number  // Column 3
    ) {
        this.elements = new Float32Array(9);
        this.elements[0] = a11; this.elements[1] = a21, this.elements[2] = a31; // Column 1
        this.elements[3] = a12, this.elements[4] = a22, this.elements[5] = a32; // Column 2
        this.elements[6] = a13, this.elements[7] = a23, this.elements[8] = a33; // Column 3
    }

    /** Resets the matrix to the [identity matrix](https://en.wikipedia.org/wiki/Identity_matrix). */
    reset(): void {
        this.elements[0] = 1; this.elements[1] = 0, this.elements[2] = 0; // Column 1
        this.elements[3] = 0, this.elements[4] = 1, this.elements[5] = 0; // Column 2
        this.elements[6] = 0, this.elements[7] = 0, this.elements[8] = 1; // Column 3
    }

    // TODO: translate, rotate, scale, TRS, vector mul, maybe a 2x3 matrix function (dont need last row often)

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

        //    column  1 ,  column 2 ,  column 3 ;
        const a11 = a[0], a12 = a[3], a13 = a[6]; // Row 1
        const a21 = a[1], a22 = a[4], a23 = a[7]; // Row 2
        const a31 = a[2], a32 = a[5], a33 = a[8]; // Row 3

        //    column  1 ,  column 2 ,  column 3 ;
        const b11 = b[0], b12 = b[3], b13 = b[6]; // Row 1
        const b21 = b[1], b22 = b[4], b23 = b[7]; // Row 2
        const b31 = b[2], b32 = b[5], b33 = b[8]; // Row 3

        // Set `this` mul results in column-major order c1=(0,1,2) c2=(3,4,5) c3=(6,7,8)
        a[0] = a11! * b11! + a12! * b21! + a13! * b31!; // a11
        a[1] = a21! * b11! + a22! * b21! + a23! * b31!; // a21
        a[2] = a31! * b11! + a32! * b21! + a33! * b31!; // a31
        a[3] = a11! * b12! + a12! * b22! + a13! * b32!; // a12
        a[4] = a21! * b12! + a22! * b22! + a23! * b32!; // a22
        a[5] = a31! * b12! + a32! * b22! + a33! * b32!; // a32
        a[6] = a11! * b13! + a12! * b23! + a13! * b33!; // a13
        a[7] = a21! * b13! + a22! * b23! + a23! * b33!; // a23
        a[8] = a31! * b13! + a32! * b23! + a33! * b33!; // a33

        return this;
    }

    clone(): Matrix3 {
        return new Matrix3(
            this.elements[0]!, this.elements[1]!, this.elements[2]!, // Column 1
            this.elements[3]!, this.elements[4]!, this.elements[5]!, // Column 2
            this.elements[6]!, this.elements[7]!, this.elements[8]!  // Column 3
        );
    }

}