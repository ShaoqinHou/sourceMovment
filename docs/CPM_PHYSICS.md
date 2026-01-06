# Quake 3 Challenge ProMode (CPM) Movement Physics

## Reference Game
**Quake 3 Arena + Challenge ProMode Arena (CPMA) mod**

## Unit System
- **Quake units (qu)** - approximately 1 inch per unit
- 16 qu = 1 foot
- Player height: 56 qu standing, 32 qu crouching
- Player width: 32 qu

---

## Core Formulas

### 1. Acceleration Function (PM_Accelerate)
```c
accelspeed = accel * frametime * wishspeed;
if (accelspeed > addspeed) {
    accelspeed = addspeed;
}
pm->ps->velocity[i] += accelspeed * wishdir[i];
```

**Where:**
- `accel` = acceleration multiplier (depends on mode)
- `frametime` = time per physics tick (typically 0.008s at 125Hz)
- `wishspeed` = desired speed (capped)
- `addspeed` = wishspeed - currentSpeed (dot product of velocity and wishdir)
- `wishdir` = normalized direction of player input

**Key Insight:** Only the **projection** of velocity onto wishdir is limited, not total velocity!
This is why strafe jumping works - accelerating perpendicular to velocity adds to total speed.

---

### 2. Friction Function (PM_Friction)
```c
control = speed < pm_stopspeed ? pm_stopspeed : speed;
drop += control * pm_friction * frametime;
newSpeed = speed - drop;
```

**Where:**
- `speed` = current horizontal speed
- `pm_stopspeed` = 100 (threshold below which friction increases)
- `pm_friction` = 6 (ground friction)
- `frametime` = 0.008s

---

### 3. Gravity
- `g_gravity` = 800 qu/s²
- Applied as: `velocity.y -= g_gravity * frametime`

---

## CPM-Specific Values

| Parameter | Value | Description |
|-----------|-------|-------------|
| `g_speed` | 320 | Base speed limit (can be exceeded via strafing) |
| `pm_accelerate` | 10 | Ground acceleration |
| `pm_airaccelerate` | 1 | Air acceleration (W + strafe) |
| `g_strafeaccelerate` | **100** | Air acceleration (strafe ONLY) - CPM unique! |
| `g_aircontrol` | **0.02** | Air control factor - CPM unique! |
| `g_wishspeed` | 30 | Air wish speed cap |
| `pm_friction` | 6 | Ground friction |
| `pm_stopspeed` | 100 | Friction threshold |
| `pm_jumpvelocity` | 270 | Initial jump velocity |
| `g_gravity` | 800 | Gravity |

---

## The Secret: CPM Uses Different Acceleration Values!

### When Holding W + A/D:
- Uses `pm_airaccelerate = 1`
- `accelspeed = 1 * 0.008 * 30 = 0.24` qu/frame
- **Gradual acceleration**

### When Holding ONLY A/D (No W):
- Uses `g_strafeaccelerate = 100`
- `accelspeed = 100 * 0.008 * 30 = 24` qu/frame
- **100x faster acceleration!**

This is why CPM strafe jumping feels so responsive!

---

## Air Control (CPM Unique)

```c
// CPM allows turning in air by blending velocity toward wishdir
turnAmount = g_aircontrol * dotProduct * dt;
// Blends current velocity direction toward wishdir
// Maintains same speed, just changes direction
```

**Value:** `g_aircontrol = 0.02` (or 150 in some implementations)

---

## Strafe Jumping Mechanics

### Optimal Technique:
1. **Circle Jump Start**: 90° turn into first strfe
2. **In Air**: Release W, hold A or D
3. **Turn mouse** in direction of strafe
4. **Jump immediately** on landing (before friction applies)

### Speed Gain Per Frame:
- With W + strafe: 0.24 qu/frame (pm_airaccelerate = 1)
- With strafe only: 24 qu/frame (g_strafeaccelerate = 100)
- At 125fps: ~30 qu gain per second of air time

### Maximum Speed:
- Theoretically unlimited (can keep strafe jumping)
- Practical limit: ~800-1000 qu/s for skilled players
- Circle jump start: 600+ qu/s

---

## Frametime

**Quake 3 runs at 125Hz physics:**
```c
pml.frametime = pml.msec * 0.001;
// With pml.msec = 8: frametime = 0.008s
```

---

## Key Takeaways for Implementation

1. **Must detect input pattern:**
   - W + A/D → use pm_airaccelerate (1)
   - A/D only → use g_strafeaccelerate (100)

2. **Air control only applies when holding W**
   - Blends velocity toward wishdir
   - Does NOT add speed, just changes direction

3. **Wish speed is capped to 30 in air**
   - This is the magic number for strafe jumping

4. **Friction is skipped on jump frame**
   - This is what enables bunny hopping

5. **Gravity:** 800 qu/s²
   - Jump velocity: 270 qu/s
   - Jump height: ~57 qu

---

## Sources
- [Quake III Arena Source Code](https://github.com/id-Software/Quake-III-Arena)
- [Free ProMode Physics - Origami Parade](https://www.origamiparade.com/programming-projects/openarena/freepromode/)
- [Strafing Theory by injx](https://dimit.me/blog/2017/08/08/defrag-strafe-theory/)
- [QuakeWorld Air Physics](https://www.quakeworld.nu/wiki/QW_physics_air)
