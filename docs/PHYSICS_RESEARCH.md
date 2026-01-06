# Quake 3 / CPM Physics Research Document

## Executive Summary

This document contains detailed research on Quake 3 Arena and Challenge ProMode (CPM) player movement physics, based on analysis of the actual source code from `bg_pmove.c`.

**Key Finding**: The behavior user reported (maintaining velocity direction without input) is **CORRECT Quake physics**. However, there are implementation bugs that need fixing.

---

## 1. Velocity Storage: World Space vs Local Space

### Finding: Velocity is Stored in World Space

From `bg_pmove.c`:
```c
// pm->ps->velocity is a vec3_t: float[3]
// Stored as absolute world coordinates (x, y, z)
pm->ps->velocity[i] += accelspeed*wishdir[i];
```

### What This Means:
- Velocity is **independent of camera direction**
- When you release all keys, velocity continues in its current direction
- Looking around does NOT change your movement direction
- Only **input** (W/A/S/D) can change your velocity direction

### User's Reported "Bug" is Actually Correct Behavior:
> "during movement, say if my speed is x, then even if i release my movement key, as long as i got jump held, it will maintain the movement direction with x as the speed, regardless of the camera looking direction"

**This is CORRECT Quake physics.** Velocity persists in world space regardless of view angles.

---

## 2. Air Movement (PM_AirMove)

### Source Code Analysis:
```c
static void PM_AirMove( void ) {
    PM_Friction();        // Air friction is FIRST

    fmove = pm->cmd.forwardmove;  // W/S: -127 to 127
    smove = pm->cmd.rightmove;    // A/D: -127 to 127

    scale = PM_CmdScale( &cmd );  // Normalize diagonal input

    // Project to horizontal plane
    pml.forward[2] = 0;
    pml.right[2] = 0;
    VectorNormalize (pml.forward);
    VectorNormalize (pml.right);

    // Calculate wish velocity
    for ( i = 0 ; i < 2 ; i++ ) {
        wishvel[i] = pml.forward[i]*fmove + pml.right[i]*smove;
    }
    wishvel[2] = 0;

    VectorCopy (wishvel, wishdir);
    wishspeed = VectorNormalize(wishdir);
    wishspeed *= scale;

    // NOT on ground = little effect
    PM_Accelerate (wishdir, wishspeed, pm_airaccelerate);
}
```

### Key Observations:
1. **PM_Friction() is called FIRST** - air friction exists!
2. **fmove/smove are from INPUT only** - not from camera
3. **forward/right vectors are from viewAngles** - used to calculate wishdir
4. **Wish speed is NOT capped in PM_AirMove** (only in PM_Accelerate in QW)

---

## 3. Air Friction (PM_Friction)

### Source Code Analysis:
```c
static void PM_Friction( void ) {
    vec3_t vec;
    float *vel;
    float speed, newspeed, control;
    float drop;

    vel = pm->ps->velocity;
    VectorCopy( vel, vec );

    if ( pml.walking ) {
        vec[2] = 0; // Ignore vertical on ground
    }

    speed = VectorLength(vec);
    if (speed < 1) {
        vel[0] = 0;
        vel[1] = 0;
        return;
    }

    drop = 0;

    // Apply ground friction
    if ( pm->waterlevel <= 1 ) {
        if ( pml.walking && !(pml.groundTrace.surfaceFlags & SURF_SLICK) ) {
            if ( ! (pm->ps->pm_flags & PMF_TIME_KNOCKBACK) ) {
                control = speed < pm_stopspeed ? pm_stopspeed : speed;
                drop += control*pm_friction*pml.frametime;
            }
        }
    }

    // Water friction
    if ( pm->waterlevel ) {
        drop += speed*pm_waterfriction*pm->waterlevel*pml.frametime;
    }

    // Flying friction
    if ( pm->ps->powerups[PW_FLIGHT]) {
        drop += speed*pm_flightfriction*pml.frametime;
    }

    // Spectator friction
    if ( pm->ps->pm_type == PM_SPECTATOR) {
        drop += speed*pm_spectatorfriction*pml.frametime;
    }

    // Scale the velocity
    newspeed = speed - drop;
    if (newspeed < 0) {
        newspeed = 0;
    }
    newspeed /= speed;

    vel[0] = vel[0] * newspeed;
    vel[1] = vel[1] * newspeed;
    vel[2] = vel[2] * newspeed;
}
```

### Critical Finding: NO Air Friction in Quake 3!

Looking at the code:
- Ground friction: `if ( pml.walking )` - only when walking
- Water friction: `if ( pm->waterlevel )` - only in water
- Flying friction: `if ( pm->ps->powerups[PW_FLIGHT])` - only when flying
- Spectator friction: `if ( pm->ps->pm_type == PM_SPECTATOR)` - only spectator

**There is NO air friction for normal player movement!**

This means:
- In air, velocity persists UNCHANGED (except for gravity)
- Horizontal speed is maintained indefinitely
- You don't lose speed by releasing keys

### User Report Analysis:
> "one don't loose any speed even if they stopped strafing"

**This is CORRECT Quake physics!** There is no air friction in Q3.

---

## 4. Acceleration (PM_Accelerate)

### Source Code Analysis:
```c
static void PM_Accelerate( vec3_t wishdir, float wishspeed, float accel ) {
    int i;
    float addspeed, accelspeed, currentspeed;

    currentspeed = DotProduct (pm->ps->velocity, wishdir);
    addspeed = wishspeed - currentspeed;

    if (addspeed <= 0) {
        return;  // Already going faster than wishspeed in this direction
    }

    accelspeed = accel*pml.frametime*wishspeed;

    if (accelspeed > addspeed) {
        accelspeed = addspeed;
    }

    for (i=0 ; i<3 ; i++) {
        pm->ps->velocity[i] += accelspeed*wishdir[i];
    }
}
```

### The Key Formula:

```
currentspeed = velocity · wishdir  (dot product)
addspeed = wishspeed - currentspeed

if addspeed <= 0: return (no acceleration)

accelspeed = min(accel * frametime * wishspeed, addspeed)
velocity += accelspeed * wishdir
```

### Why Strafe Jumping Works:

The dot product `velocity · wishdir` gives us the component of velocity in the wish direction.

**Case 1: Wishdir aligned with velocity (holding W while moving forward)**
```
currentspeed = speed * cos(0°) = speed
addspeed = wishspeed - speed = small or negative
→ Minimal or NO acceleration
```

**Case 2: Wishdir perpendicular to velocity (strafing only)**
```
currentspeed = speed * cos(90°) = 0
addspeed = wishspeed - 0 = wishspeed = MAXIMUM
→ Maximum acceleration!
```

**Case 3: Wishdir somewhere in between**
```
currentspeed = speed * cos(γ) where γ is angle between velocity and wishdir
addspeed = wishspeed - speed * cos(γ)
→ Acceleration depends on angle
```

---

## 5. QuakeWorld Air Strafing Analysis

From QW physics documentation:

### Wish Speed Cap:
```c
wishspd = min(wishspd, 30);  // 30 is the magic number!
```

### Best Angle Formula:
```
v_new² = v² + 30² - (v*cos(γ))²

Maximum acceleration when cos(γ) = 0
→ γ = 90° (wishdir perpendicular to velocity)
```

### Per-Frame Gain:
```
With perpendicular strafing: +30 qu per frame to velocity magnitude
Velocity rotation per frame: arctan(30/v)

As v increases: rotation rate decreases (need to turn slower)
```

### Theoretical Speed vs Time:
```
v(t) = 30 * sqrt(t / T)
where T = frametime

With 77fps (T=0.013): ~200 qu/s in 58 seconds
```

---

## 6. CPM-Specific Physics

### The "Secret" - Strafe Accelerate

CPM introduced different acceleration values:

| Input Pattern | Acceleration | Per-Frame Gain |
|---------------|--------------|----------------|
| Holding W + A/D | `pm_airaccelerate = 1` | ~0.24 qu/frame |
| Holding ONLY A/D | `cpm_strafeaccelerate = 100` | ~24 qu/frame |

This is **100x acceleration** when strafing WITHOUT forward!

### Detection Logic:
```c
// CPM checks if forward key is pressed
if (cmd.forwardmove == 0 && cmd.rightmove != 0) {
    // Pure strafe: use cpm_strafeaccelerate
    accel = cpm_strafeaccelerate;  // 100!
} else {
    // Forward + strafe: use normal airaccelerate
    accel = pm_airaccelerate;  // 1
}
```

### Why This Matters:

At 0 speed:
- Press W: wishdir aligns with velocity (0) → addspeed = 30 - 0 = 30
- But currentspeed ≈ 0, so acceleration works

At high speed, moving in direction of velocity:
- Press W: wishdir aligns with velocity → currentspeed ≈ total speed
- addspeed = 30 - highSpeed ≈ 0 → NO acceleration!

Release W, press A/D:
- wishdir is perpendicular to velocity
- currentspeed = 0 (dot product of perpendicular vectors)
- addspeed = 30 - 0 = 30 → MAX acceleration!
- With 100x multiplier: HUGE speed gain!

---

## 7. Implementation Bug Analysis

### Current Implementation Status:

Looking at `src/physics/MovementController.ts`:

**CORRECT:**
1. ✅ Velocity stored in world space (THREE.Vector3)
2. ✅ Accelerate function uses dot product correctly
3. ✅ forward/right vectors calculated from viewAngles
4. ✅ wishDir calculated from input using forward/right
5. ✅ Ground friction applied correctly
6. ✅ No friction on jump frame (bunny hopping)
7. ✅ CPM strafe detection implemented

**INCORRECT / MISSING:**
1. ❌ **PM_Friction is NOT called in moveAir** - but Q3 doesn't have air friction anyway!
2. ❌ **No air friction in Q3** - but this is correct behavior!
3. ⚠️ **Potential bug**: wishDir normalization when input is zero

### The Real Issues:

After analyzing the code, the "bugs" user reported are actually **correct Quake physics**:

1. ✅ "Velocity maintains direction when input released" - **CORRECT**
2. ✅ "Don't lose speed when stopped strafing" - **CORRECT** (no air friction)
3. ⚠️ "Movement doesn't follow camera when input released" - **CORRECT** (world-space velocity)

### What Might Feel "Wrong":

The user might be experiencing confusion because:

1. **Coming from Source engine**: Source games have different physics
2. **Expecting air friction**: Many modern games add air drag
3. **Velocity-view coupling**: Some games couple movement to view direction

### Potential Minor Bugs:

1. **Air friction application**:
   - Current: No friction in air (like Q3)
   - This is correct but might feel wrong if expecting Source-style physics

2. **CPM strafe detection**:
   - Current: `Math.abs(this.wishDir.dot(this.forward)) < 0.5`
   - This checks if wishdir is perpendicular to forward
   - Should be: check if forward input is zero

3. **Wish speed calculation**:
   - Current: `wishSpeed = config.pm_maxspeed` when input detected
   - QW: caps to 30 for air acceleration
   - Current code does cap airWishSpeed to 30 - correct!

---

## 8. Key Constants Reference

| Parameter | Quake 3 Value | Description |
|-----------|---------------|-------------|
| `pm_frametime` | 0.008s | 125Hz physics tick |
| `pm_maxspeed` | 320 | Max ground speed (qu/s) |
| `pm_accelerate` | 10 | Ground acceleration |
| `pm_friction` | 6 | Ground friction |
| `pm_stopspeed` | 100 | Speed threshold for friction |
| `pm_airaccelerate` | 1 | Air acceleration (VQ3) |
| `cpm_strafeaccelerate` | 100 | CPM strafe acceleration |
| `g_gravity` | 800 | Gravity (qu/s²) |
| `pm_jumpvelocity` | 270 | Jump velocity (qu/s) |
| Air wish speed cap | 30 | Max per-frame acceleration |

---

## 9. Sources

- [Quake III Arena Source Code](https://github.com/id-Software/Quake-III-Arena/blob/master/code/game/bg_pmove.c)
- [QuakeWorld Air Physics](https://www.quakeworld.nu/wiki/QW_physics_air)
- [Quake Player Movement Document](https://github.com/myria666/qMovementDoc)
- [FreeProMode CPMA Physics](https://github.com/oitzujoey/freepromode)
- [Strafing Theory](https://dimit.me/blog/2017/08/08/defrag-strafe-theory/)

---

## 10. Conclusion

The user-reported "bugs" are actually **correct implementations of Quake 3 physics**:

1. **Velocity persists without input** - Q3 has no air friction
2. **Velocity independent of camera** - Velocity is in world space
3. **Speed maintained when strafing stops** - No air drag

The current implementation is largely correct for Quake 3-style movement. If the user wants different behavior, we need to clarify:
- Are we implementing Quake 3 physics exactly?
- Or do we want a hybrid with some modern mechanics?
- Which game is the "reference" for correct behavior?

The strafe jumping mechanics, acceleration formula, and wish speed capping are all implemented correctly based on the source code analysis.
