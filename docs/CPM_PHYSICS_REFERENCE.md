# CPM Physics Reference

This document contains the **actual** CPM (Challenge ProMode) physics implementation, sourced from the Free ProMode project and original CPMA documentation.

**Source**: https://www.origamiparade.com/programming-projects/openarena/freepromode/

---

## CPM Variables and Default Values

| Variable | Default | Description |
|----------|---------|-------------|
| `g_promode` | 0 | Enable/disable ProMode physics (0=off, 1=on) |
| `g_friction` | 6 | Ground friction coefficient |
| `g_accelerate` | 10 | Ground acceleration multiplier |
| `g_airaccelerate` | 1 | Air acceleration when holding forward |
| `g_strafeaccelerate` | 1 | Air acceleration when strafing ONLY (no forward) |
| `g_wishspeed` | 30 | Air wish speed cap (units per frame) |
| `g_aircontrol` | 0 | Air control amount (0.02 recommended for CPM) |
| `g_doublejump` | 0 | Double jump boost (100 recommended) |
| `g_rampboost` | 0 | Ramp jump boost (1 = enabled) |

### Recommended CPM Settings

```
g_promode 1
g_wishspeed 30
g_airaccelerate 1
g_strafeaccelerate 100
g_aircontrol 0.02
```

---

## 1. CPM Strafe Detection (The Secret Sauce)

**From the source code:**

```c
if (g_promode.integer && pm->cmd.rightmove != 0 && pm->cmd.forwardmove == 0)
    PM_AirAccelerate(wishdir, wishspeed, g_strafeaccelerate.value);
else
    PM_Accelerate(wishdir, wishspeed, g_airaccelerate.value);
```

### The Key Insight:

**CPM strafe mode activates ONLY when:**
- `rightmove != 0` (A or D is pressed)
- `forwardmove == 0` (W is NOT pressed)

**NOT** based on the angle between velocity and wishdir!

This means:
- Holding W + A/D: uses `g_airaccelerate = 1` (slow)
- Holding ONLY A/D: uses `g_strafeaccelerate = 100` (100x faster!)

---

## 2. Air Accelerate (PM_AirAccelerate)

```c
static void PM_AirAccelerate(vec3_t wishdir, float wishspeed, float accel) {
    int i;
    float addspeed, accelspeed, currentspeed;

    currentspeed = DotProduct(pm->ps->velocity, wishdir);
    addspeed = wishspeed - currentspeed;
    if (addspeed <= 0) return;

    // WISH SPEED CAP - the magic number 30!
    if (wishspeed > g_wishspeed.value)
        wishspeed = g_wishspeed.value;

    accelspeed = accel * pml.frametime * wishspeed;
    if (accelspeed > addspeed)
        accelspeed = addspeed;

    for (i=0; i<3; i++)
        pm->ps->velocity[i] += accelspeed * wishdir[i];
}
```

### Key Points:
- **Wish speed is capped to 30** (configurable via `g_wishspeed`)
- With `g_strafeaccelerate = 100`: `accelspeed = 100 * 0.008 * 30 = 24` units/frame
- With `g_airaccelerate = 1`: `accelspeed = 1 * 0.008 * 30 = 0.24` units/frame

---

## 3. Air Control (CPM's Turning Ability)

**From the source code (GPL v2+ version):**

```c
// Air control
if (g_promode.integer && pm->cmd.rightmove == 0 && pm->cmd.forwardmove != 0 &&
    wishspeed <= DotProduct(pm->ps->velocity, wishdir)) {

    zspeed = pm->ps->velocity[2];
    pm->ps->velocity[2] = 0;

    speed = VectorLength(pm->ps->velocity);

    pm->ps->velocity[0] += wishdir[0] * speed * g_aircontrol.value;
    pm->ps->velocity[1] += wishdir[1] * speed * g_aircontrol.value;

    VectorNormalize(pm->ps->velocity);

    for (i=0; i<2; i++)
        pm->ps->velocity[i] = speed * pm->ps->velocity[i];

    pm->ps->velocity[2] = zspeed;
}
```

### How Air Control Works:

**Activation conditions:**
- `g_promode` is enabled
- `rightmove == 0` (NOT strafing)
- `forwardmove != 0` (holding W or S)
- `wishspeed <= currentspeed` (already faster than wishdir in that direction)

**What it does:**
1. Save vertical velocity (zspeed)
2. Get horizontal speed
3. Add a portion of wishdir to velocity, scaled by `speed * g_aircontrol`
4. Renormalize velocity to maintain same speed
5. Restore vertical velocity

**Effect:** Allows smooth turning in air while maintaining speed, WITHOUT accelerating.

**Recommended value:** `g_aircontrol = 0.02`

---

## 4. PM_Accelerate (Standard Acceleration)

```c
static void PM_Accelerate(vec3_t wishdir, float wishspeed, float accel) {
    int i;
    float addspeed, accelspeed, currentspeed;

    currentspeed = DotProduct(pm->ps->velocity, wishdir);
    addspeed = wishspeed - currentspeed;
    if (addspeed <= 0) return;

    accelspeed = accel * pml.frametime * wishspeed;
    if (accelspeed > addspeed)
        accelspeed = addspeed;

    for (i=0; i<3; i++)
        pm->ps->velocity[i] += accelspeed * wishdir[i];
}
```

### The Formula:

```
currentspeed = velocity · wishdir
addspeed = wishspeed - currentspeed

if addspeed <= 0: return (can't accelerate in this direction)

accelspeed = min(accel * frametime * wishspeed, addspeed)
velocity += accelspeed * wishdir
```

### Why Strafe Jumping Works:

When wishdir is perpendicular to velocity:
- `currentspeed = 0` (dot product of perpendicular vectors)
- `addspeed = wishspeed` (maximum!)
- Maximum acceleration!

When wishdir is aligned with velocity:
- `currentspeed = speed`
- `addspeed = wishspeed - speed ≈ 0` (minimal acceleration)

---

## 5. PM_AirMove (Air Movement Flow)

```c
static void PM_AirMove(void) {
    PM_Friction();  // Air friction (no effect in Q3)

    fmove = pm->cmd.forwardmove;
    smove = pm->cmd.rightmove;

    scale = PM_CmdScale(&cmd);
    PM_SetMovementDir();

    // Project to horizontal
    pml.forward[2] = 0;
    pml.right[2] = 0;
    VectorNormalize(pml.forward);
    VectorNormalize(pml.right);

    // Calculate wish velocity
    for (i=0; i<2; i++)
        wishvel[i] = pml.forward[i]*fmove + pml.right[i]*smove;
    wishvel[2] = 0;

    VectorCopy(wishvel, wishdir);
    wishspeed = VectorNormalize(wishdir);
    wishspeed *= scale;

    // CPM: Different acceleration based on input
    if (g_promode.integer && pm->cmd.rightmove != 0 && pm->cmd.forwardmove == 0)
        PM_AirAccelerate(wishdir, wishspeed, g_strafeaccelerate.value);
    else
        PM_Accelerate(wishdir, wishspeed, g_airaccelerate.value);

    // CPM: Air control (turning without strafing)
    if (g_promode.integer && pm->cmd.rightmove == 0 && pm->cmd.forwardmove != 0 &&
        wishspeed <= DotProduct(pm->ps->velocity, wishdir)) {
        // [air control code here]
    }

    // Steep plane slide
    if (pml.groundPlane)
        PM_ClipVelocity(pm->ps->velocity, pml.groundTrace.plane.normal,
                       pm->ps->velocity, OVERCLIP);

    PM_StepSlideMove(qtrue);
}
```

---

## 6. Input Detection Summary

| Input Pattern | forwardmove | rightmove | Acceleration Used |
|---------------|-------------|-----------|-------------------|
| Holding W (forward) | ≠ 0 | = 0 | `g_airaccelerate` (1) |
| Holding W + A/D | ≠ 0 | ≠ 0 | `g_airaccelerate` (1) |
| Holding ONLY A/D | = 0 | ≠ 0 | `g_strafeaccelerate` (100) |

**Air control activates when:**
- Holding W or S (forward ≠ 0)
- NOT holding A/D (rightmove = 0)
- Already faster than wishdir in that direction

---

## 7. Default VQ3 vs CPM Comparison

| Parameter | VQ3 (Default) | CPM (ProMode) |
|-----------|---------------|---------------|
| `g_promode` | 0 | 1 |
| `g_airaccelerate` | 1 | 1 |
| `g_strafeaccelerate` | N/A (or 1) | 100 |
| `g_wishspeed` | N/A (or 30) | 30 |
| `g_aircontrol` | N/A (or 0) | 0.02 |
| `g_doublejump` | N/A (or 0) | 100 |
| `g_rampboost` | N/A (or 0) | 1 |

---

## 8. Implementation Checklist

To properly implement CPM physics:

- [ ] **Strafe detection**: Check raw input values (`forwardmove == 0 && rightmove != 0`)
- [ ] **Wish speed cap**: Cap to `g_wishspeed` (30) in PM_AirAccelerate
- [ ] **Air control**: Implement the exact formula from source
- [ ] **PM_Accelerate**: Use exact formula (dot product, frametime)
- [ ] **Remove made-up formulas**: Delete any custom/unverified formulas

---

## Sources

1. **Free ProMode Physics**: https://www.origamiparade.com/programming-projects/openarena/freepromode/
2. **Quake III Arena Source**: https://github.com/id-Software/Quake-III-Arena
3. **QuakeWorld Air Physics**: https://www.quakeworld.nu/wiki/QW_physics_air
4. **CPM1 Development Docs**: cpm1_dev_docs.zip (Quake 3 SDK license)

---

## Notes

- The author of Free ProMode notes that the Xonotic air control implementation is "far more accurate" than the provided GPL v2+ version
- CPM1 development docs are under Quake 3 SDK license (not GPL)
- Xonotic physics are under GPL v3
- The provided air control formula is a "simple version" under GPL v2+
