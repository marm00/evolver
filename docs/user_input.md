# User Input

Last updated: 26 July 2024

Documentation for supported user input and implementation details.

## Keyboard

The player can move with `WASD` and/or `Arrow Keys` in 8 directions (with *idle* as default). An identical instruction like `W & Arrow Up` cancels out, such that the movement north is *idle*. A contradictory instruction like `A & D` cancels out, such that the horizontal movement is *idle*. Similarly, if the player presses all of `WASD` and/or all of `Arrow Keys`, all movement is *idle* until identical or contradictory keys are released.

## Mouse

The player can opt into `Auto Aim` and `Auto Attack`, complicating the mouse logic. In essence, the `<canvas>` mouse position is projected onto the world every frame, relative to player position. This means that the mouse position is *always* known in world coordinates. While memoization could be cheaper in some cases, this solution is consistent and allows for things like real-time accurate tooltips.

Below is a table showing the possible combinations of mouse input and settings. *Note that the table is overriden when the player [holds down the mouse button](#override-by-holding-down-the-mouse), and that the **aim** position is the vector onto which the attack is excecuted, unrelated to character movement as covered in the [keyboard section](#keyboard).*

| Auto Aim | Auto Attack | Click | Aim | Attack |
|----------|-------------|-------|-----|-------|
| disabled | disabled | no | mouse | no |
| enabled | disabled | no | auto | no |
| disabled | enabled | no | mouse | yes |
| enabled | enabled | no | auto | yes |
| disabled | disabled | yes | mouse | yes |
| enabled | disabled | yes | auto | yes |
| disabled | enabled | yes | mouse | yes |
| enabled | enabled | yes | auto | yes |

### Override by holding down the mouse

When the player holds down the mouse button, the *aim* position is overriden by the mouse position, and attacks are automatically executed at this position until the mouse button is released. On release, the rules listed above apply again.
