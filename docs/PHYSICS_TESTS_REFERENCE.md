# Physics Tests Reference

This document provides expected values for various movement scenarios to verify the physics implementation.

**Key Reference**: `pm_frametime = 0.008s` (125Hz physics tick)

---

## Test 1: Ground Acceleration from Standstill

**Scenario**: Player at rest, hold W (forward only)

### Initial State
- `velocity = (0, 0, 0)`
- `wishdir = (0, 0, -1)` (forward direction)
- `wishspeed = 320` (pm_maxspeed)

### First Physics Tick (dt = 0.008)

**Acceleration Formula**:
```
currentspeed = velocity · wishdir = 0
addspeed = wishspeed - currentspeed = 320 - 0 = 320
accelSpeed = min(accel * wishspeed * dt, addspeed)
accelSpeed = min(10 * 320 * 0.008, 320) = min(25.6, 320) = 25.6
```

**After tick 1**:
- `velocity = (0, 0, -25.6)`
- `speed = 25.6 qu/s`

### After Multiple Ticks (until max speed)

The player will accelerate until `currentspeed` approaches `wishspeed`:
- Tick 2: `currentspeed = 25.6`, `addspeed = 294.4`, `accelSpeed = 25.6` → `speed = 51.2`
- Tick 3: `speed = 76.8`
- ...
- Eventually approaches 320 qu/s

**Expected**: ~13 ticks (~104ms) to reach 320 qu/s

---

## Test 2: Air Acceleration - Holding W (NOT strafing)

**Scenario**: Player in air with speed 300 qu/s, holding W

### Initial State
- `velocity = (0, 0, -300)` (moving forward)
- `wishdir = (0, 0, -1)` (looking forward, holding W)
- `wishspeed = 30` (capped by cpm_wishspeed)
- `accel = 1` (pm_airaccelerate)

### Calculation

```
currentspeed = velocity · wishdir = 300
addspeed = wishspeed - currentspeed = 30 - 300 = -270
```

**Result**: `addspeed < 0`, so **NO ACCELERATION APPLIED**

**This is why holding W in air doesn't help!** The dot product of velocity and wishdir equals the current speed when aligned, so addspeed is negative.

---

## Test 3: Air Acceleration - Strafe Jumping (A/D only, NO W)

**Scenario**: Player moving forward at 300 qu/s, holding A (strafe left), turning left

### Initial State
- `velocity = (0, 0, -300)` (moving forward)
- Player starts turning left, wishdir points left
- After 45° turn: `wishdir ≈ (-0.707, 0, -0.707)`

### Calculation

```
currentspeed = velocity · wishdir = 0 * -0.707 + 0 * 0 + (-300) * -0.707
currentspeed = 212.13

addspeed = wishspeed - currentspeed = 30 - 212.13 = -182.13
```

Hmm, still negative... Let's check at 90°:

### At 90° Turn (wishdir perpendicular to velocity)

```
wishdir = (-1, 0, 0)  (purely left)
velocity = (0, 0, -300)  (moving forward)

currentspeed = 0 * -1 + 0 * 0 + (-300) * 0 = 0
addspeed = 30 - 0 = 30
accelSpeed = 1 * 30 * 0.008 = 0.24
```

**With cpm_strafeaccelerate = 100** (when holding A/D only):
```
accelSpeed = 100 * 30 * 0.008 = 24 units per tick!
```

**After tick 1**: New velocity has leftward component of 24 qu/s
**After ~12 ticks**: ~288 qu/s in strafe direction

**This is why strafe jumping works!** Turn 90° from velocity, hold A/D, get massive acceleration.

---

## Test 4: Bunny Hop Speed Preservation

**Scenario**: Player at 400 qu/s, lands and immediately jumps

### Before Landing (in air)
- `velocity = (0, 0, -400)`
- `isGrounded = false`

### Landing Frame
- Collision detects ground
- Jump queued (Space pressed before/at landing)
- `friction` is NOT applied (jump happens first in moveGround)
- `jump()` sets `velocity.y = 270`
- Horizontal velocity `(0, 0, -400)` is **PRESERVED**

### Result
- Speed after jump: **400 qu/s** (no loss!)

**If no jump queued**: Friction would be applied:
```
drop = 400 * 6 * 0.008 = 19.2
newSpeed = 400 - 19.2 = 380.8
```

---

## Test 5: CPM Air Control (Turning without strafing)

**Scenario**: Moving at 500 qu/s, holding W, turning slightly

### Activation Conditions
- `rightmove = 0` (NOT strafing)
- `forwardmove ≠ 0` (holding W or S)
- `wishspeed ≤ currentspeed` (faster than wishdir)

### Air Control Formula

```
speed = 500 (horizontal)
zspeed = velocity.y (saved)
velocity.y = 0 (temporarily)

// Add wishdir contribution
velocity.x += wishdir.x * speed * g_aircontrol
velocity.z += wishdir.z * speed * g_aircontrol

// With g_aircontrol = 0.02:
// Each frame adds 500 * 0.02 = 10 units in wishdir direction

// Normalize and restore original speed
normalize(velocity)
velocity = velocity * speed  // restore 500
velocity.y = zspeed  // restore vertical
```

**Effect**: Player can turn smoothly while maintaining 500 qu/s speed

---

## Debug Panel Verification

Press **F4** to toggle debug panel. Key values to check:

### Air Strafe Acceleration Test
1. Start from rest, build speed to ~400
2. Release all keys (coast)
3. Hold ONLY A or D (NOT W)
4. Turn mouse in strafe direction

**Expected debug values**:
- `StrafeOnly: YES` (must be true for 100x accel)
- `AirAccel: 100` (not 1!)
- `WishSpeed: 30` (capped)
- `AccelSpeed: ~24` (100 * 30 * 0.008)

### W Key Air Test (for comparison)
1. At speed ~400, hold W in air
2. Check debug panel

**Expected debug values**:
- `StrafeOnly: NO`
- `AirAccel: 1` (not 100!)
- `CurrentSpeed: ~400`
- `AddSpeed: negative` (no acceleration possible)

---

## Common Issues to Debug

### "Gradual acceleration with W, instant with A/D"

This is **CORRECT BEHAVIOR** based on CPM physics:

1. **Holding W in air**:
   - `currentspeed = velocity · wishdir` ≈ current speed (when aligned)
   - `addspeed = 30 - currentspeed` ≈ negative
   - **Result**: Minimal or no acceleration

2. **Holding A/D only**:
   - Turn 90° from velocity direction
   - `currentspeed = 0` (perpendicular vectors)
   - `addspeed = 30 - 0 = 30` (maximum!)
   - With `cpm_strafeaccelerate = 100`: `accelSpeed = 24` per tick
   - **Result**: "Instant" acceleration

The bug the user reported is actually **correct CPM physics**! The "instant" feel is because 100x acceleration kicks in when strafing without W.

---

## Unit Reference

- **1 Quake unit (qu)** ≈ 1 inch ≈ 2.54 cm
- **Player speed**: 320 qu/s ≈ 18 mph ≈ 29 km/h
- **Jump height**: With `pm_jumpvelocity = 270`, ~45 qu vertical
- **Gravity**: 800 qu/s²

---

## Frame Timing

- **Physics tick**: 0.008s (8ms) = 125Hz
- **Display refresh**: Typically 60Hz (16.67ms) or 144Hz (6.94ms)
- Multiple physics ticks may run per frame (fixed timestep)

---

## Testing Checklist

- [ ] Ground acceleration from standstill reaches 320 qu/s
- [ ] Ground friction slows down when no input
- [ ] Air strafe (A/D only) accelerates at ~24 qu/tick
- [ ] Air forward (W only) has minimal acceleration at speed
- [ ] Bunny hop preserves speed on jump frame
- [ ] Air control allows turning without speed loss
- [ ] Debug panel shows correct `StrafeOnly` state
- [ ] Debug panel shows correct `AirAccel` value

