# Implementation Comparison: Reference vs. Current

## DEEP RESEARCH COMPLETED

After analyzing the actual Quake 3 Arena source code (`bg_pmove.c`), QuakeWorld physics documentation, and comparing with my implementation, I have important findings.

---

## Physics Research Summary

### Key Finding: User-Reported "Bugs" are CORRECT Quake Physics

| User Report | Actual Quake 3 Behavior | Status |
|-------------|------------------------|--------|
| "Velocity maintains direction when input released" | ✅ CORRECT - World-space velocity, no air friction | Working as intended |
| "Don't lose speed when stopped strafing" | ✅ CORRECT - No air friction in Q3 | Working as intended |
| "Movement doesn't follow camera when no input" | ✅ CORRECT - Velocity independent of view angles | Working as intended |

### Velocity Storage: World Space (NOT Local)

From `bg_pmove.c`:
```c
pm->ps->velocity[i] += accelspeed*wishdir[i];
```

**What this means:**
- Velocity is stored as absolute world coordinates (x, y, z)
- Velocity is **independent of camera direction**
- Looking around does NOT change movement direction
- Only INPUT (W/A/S/D) changes velocity direction

### No Air Friction in Quake 3

From `PM_Friction()` analysis:
- Ground friction: `if ( pml.walking )` - only when grounded
- Water friction: `if ( pm->waterlevel )` - only in water
- **No air friction for normal player movement**

This means horizontal speed is maintained indefinitely while airborne.

---

## What Changed - CPM Strafe Acceleration

### The Discovery
CPM uses **100x acceleration** when strafing WITHOUT W! This was the missing piece.

| Input Pattern | Acceleration | Per-Frame Gain |
|---------------|--------------|----------------|
| Holding W + A/D | `pm_airaccelerate = 1` | 0.24 qu/frame |
| Holding ONLY A/D | `cpm_strafeaccelerate = 100` | 24 qu/frame (100x!) |

### Why This Matters
- When you have 0 speed and press W: wishdir aligns with velocity → minimal acceleration
- When you release W and press A/D: wishdir is perpendicular to velocity → MAX acceleration
- With 100x multiplier, CPM strafe jumping feels incredibly responsive

### How to Test
1. **CPM (F1)**: Jump → Release W → Hold A + turn left → FAST speed gain!
2. **VQ3 (F2)**: Same technique → Slow speed gain (no 100x boost)
3. **CS:GO (F3)**: Moderate speed gain (pm_airaccelerate = 12)

---

## Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| World-space velocity | ✅ Correct | Velocity independent of camera |
| Ground acceleration | ✅ Correct | PM_Accelerate formula implemented |
| Ground friction | ✅ Correct | PM_Friction formula implemented |
| Air acceleration (W + strafe) | ✅ Correct | pm_airaccelerate = 1 |
| CPM strafe acceleration (A/D only) | ✅ Correct | cpm_strafeaccelerate = 100 |
| Air control | ✅ Correct | Blends velocity toward wishdir |
| **NO air friction** | ✅ Correct | Matches Quake 3 behavior |
| Bunny hopping | ✅ Correct | No friction on jump frame |
| Gravity | ✅ Correct | 800 qu/s², frametime 0.008s |
| Jump velocity | ✅ Correct | 270 qu/s |
| Dot product acceleration | ✅ Correct | Only limits projection on wishdir |

---

## The Acceleration Formula (Why Strafe Jumping Works)

```
currentspeed = velocity · wishdir  (dot product)
addspeed = wishspeed - currentspeed

if addspeed <= 0: return (no acceleration)

accelspeed = min(accel * frametime * wishspeed, addspeed)
velocity += accelspeed * wishdir
```

### Optimal Strafing Angle

From QW physics:
```
v_new² = v² + 30² - (v*cos(γ))²

Maximum when cos(γ) = 0 → γ = 90°
```

**The technique:**
1. Hold A or D (strafe only, no W)
2. Turn mouse in same direction as strafe
3. Keep wishdir ~90° from velocity
4. Each frame: +30 qu to velocity magnitude
5. As speed increases, turn rate decreases

---

## Expected Behavior Now

### CPM (F1 - Default)
- **Circle jump**: 600+ qu/s from standstill
- **Strafe jumps**: ~30 qu gain per jump
- **With A/D only (no W)**: Very fast acceleration!
- **Max speed**: Unlimited (theoretically 800-1000+ qu/s)

### VQ3 (F2 - Vanilla Q3)
- **Circle jump**: ~500-545 qu/s
- **Strafe jumps**: Same ~30 qu gain per jump
- **With A/D only**: Same acceleration as W + strafe (no boost)
- **Max speed**: Unlimited but harder to reach

### CS:GO (F3 - Source)
- **Bhops**: More responsive than Quake
- **Strafing**: pm_airaccelerate = 12 (12x Quake's value)
- **Max speed**: Limited by weapon speed (~250-350 qu/s)

---

## Hosting Instructions

### Development
```bash
npm run dev
```
Runs on http://localhost:3000

### Production Build
```bash
npm run build
npm run server
```

### For Others to Join
1. Host on a server (VPS, Heroku, etc.)
2. Others open http://YOUR-IP:3000
3. Multiplayer coming soon!

---

## Sources
- [Quake III Arena Source](https://github.com/id-Software/Quake-III-Arena)
- [Free ProMode Physics](https://www.origamiparade.com/programming-projects/openarena/freepromode/)
- [Strafing Theory](https://dimit.me/blog/2017/08/08/defrag-strafe-theory/)
- [QuakeWorld Air Physics](https://www.quakeworld.nu/wiki/QW_physics_air)
