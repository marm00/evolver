# Evolver

A realistic Reverse Bullet Hell game.

## Technical

Custom TypeScript game library (see: [src/lib](src/lib)), world translated to HTML 2D canvas for rendering.

Optimal Reciprocal Collision Avoidance [(ORCA)](https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf) used for certain units. [Examples visualized with RVO2 + raylib](https://github.com/marm00/RVO2-raylib).

## TODO

Features:

- [ ] Dev mode canvas rendering
- [x] Object pooling
- [x] Implement shapes (AABB/OBB/...)
- [x] Projectiles
- [ ] Spatial partitioning
- [x] Collision detection
- [ ] Roadmaps / clever pathfinding
- [ ] Leveling
- [ ] UI
- [ ] Stats
- [ ] Talents
- [ ] Items
- [ ] Art
- [ ] Music
- [ ] Sounds
- [ ] React app

Reminders:

- [ ] Debounce camera resize
- [ ] Canvas considerations for [max size](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#maximum_canvas_size)
- [ ] next-auth styling
- [ ] Custom email signin template
- [ ] Prevent email signin spam identification
- [ ] [Next.js](https://nextjs.org), [NextAuth.js](https://next-auth.js.org), [Drizzle](https://orm.drizzle.team), [Tailwind CSS](https://tailwindcss.com), [T3 Stack](https://create.t3.gg/)
