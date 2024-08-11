# Collision

Last updated: 11 August 2024

Documentation for collision detection and implementation details.

## Object Types

All types of objects in world space are classified into one of the following categories:

| Type | Collision | Example |
|------|-----------|-------------|
| Static Decoration | None | Floor |
| Dynamic Decoration | None | Weather |
| Static Obstacle | Restrict | Tree |
| Dynamic Obstacle | Restrict | Landslide |
| Static Resource | Collect | Herb |
| Dynamic Resource | Collect | Feather |
| Static Hazard | Harm | Quicksand |
| Dynamic Hazard | Harm | Arrow |
| Static Agent | Interact | Merchant |
| Dynamic Agent | Interact | Wolf |

## Detection

A partition strategy (e.g. [quadtree](https://en.wikipedia.org/wiki/Quadtree)) contains subdivided references to world objects. Given a player spear as world object (dynamic hazard), collision checks are performed against each enemy in its partition. Broad example, with [Axis-Aligned Bounding Box](https://en.wikipedia.org/wiki/Axis-aligned_bounding_box) (or AABB) collision detection. Narrow example, with the [Separating Axis Theorem](https://en.wikipedia.org/wiki/Hyperplane_separation_theorem#Use_in_collision_detection) (or SAT): the vertices of the spear ([Oriented Bounding Box](https://en.wikipedia.org/wiki/Bounding_volume#Common_types) or OBB) and enemy (AABB or OBB) are projected onto their axes and tested for intersection (is a minimum larger than a maximum [dot product](https://en.wikipedia.org/wiki/Dot_product)).

*Circle detection...*
