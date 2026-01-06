import * as THREE from 'three';
import { CollisionDetection } from '../physics/CollisionDetection';

/**
 * Creates the test map geometry and collision
 */
export class TestMap {
  public readonly scene: THREE.Scene;
  public readonly collision: CollisionDetection;

  // Materials
  private groundMaterial: THREE.MeshStandardMaterial;
  private platformMaterial: THREE.MeshStandardMaterial;
  private wallMaterial: THREE.MeshStandardMaterial;
  private surfMaterial: THREE.MeshStandardMaterial;
  private ladderMaterial: THREE.MeshStandardMaterial;
  private markerMaterial: THREE.MeshStandardMaterial;

  constructor() {
    this.scene = new THREE.Scene();
    this.collision = new CollisionDetection();

    // Create materials
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      roughness: 0.8,
    });

    this.platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a6e,
      roughness: 0.6,
    });

    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a5e,
      roughness: 0.7,
    });

    this.surfMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aa88,
      roughness: 0.3,
      metalness: 0.2,
    });

    this.ladderMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa6600,
      roughness: 0.5,
    });

    this.markerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      roughness: 0.5,
    });

    this.buildMap();
    this.setupLighting();
    this.setupSkybox();
  }

  private buildMap(): void {
    // Ground plane
    const groundSize = 4000;
    this.collision.setGroundLevel(0);

    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const ground = new THREE.Mesh(groundGeom, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add grid texture to ground
    this.addGroundGrid(groundSize);

    // === SPAWN AREA (Center) ===
    this.addSpawnArea();

    // === BHOP CORRIDOR (North) ===
    this.addBhopZone();

    // === STRAFE ZONE (East) ===
    this.addStrafeZone();

    // === SURF RAMPS (West) ===
    this.addSurfZone();

    // === LONG JUMP PIT (South) ===
    this.addLongJumpZone();

    // === VERTICAL PLATFORMS (Northeast) ===
    this.addVerticalZone();

    // === LADDER TOWER (Northwest) ===
    this.addLadderZone();

    // === CIRCLE JUMP CORNER (Southeast) ===
    this.addCircleJumpZone();
  }

  private addGroundGrid(size: number): void {
    const gridHelper = new THREE.GridHelper(size, size / 64, 0x444466, 0x333355);
    gridHelper.position.y = 0.1;
    this.scene.add(gridHelper);

    // Add distance markers every 500 units from center
    for (let dist = 500; dist <= size / 2; dist += 500) {
      this.addDistanceRing(dist);
    }
  }

  private addDistanceRing(radius: number): void {
    const ringGeom = new THREE.RingGeometry(radius - 2, radius + 2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x666688,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    this.scene.add(ring);
  }

  private addSpawnArea(): void {
    // Spawn platform
    this.addPlatformWithVisual(0, 0, 0, 200, 200, 8);

    // Spawn point marker
    const markerGeom = new THREE.CylinderGeometry(16, 16, 4, 32);
    const marker = new THREE.Mesh(markerGeom, this.markerMaterial);
    marker.position.set(0, 10, 0);
    this.scene.add(marker);

    // Zone labels
    this.addZoneLabel('SPAWN', 0, 50, 0);
    this.addZoneLabel('BHOP →', 0, 50, -150);
    this.addZoneLabel('← SURF', -150, 50, 0);
    this.addZoneLabel('STRAFE →', 150, 50, 0);
    this.addZoneLabel('LONG JUMP ↓', 0, 50, 150);
  }

  private addBhopZone(): void {
    // Long flat corridor for bunny hopping
    const startZ = -300;
    const corridorLength = 2000;

    // Main corridor floor
    this.addPlatformWithVisual(0, 0, startZ - corridorLength / 2, 200, corridorLength, 8);

    // Side walls
    this.addWall(-110, 0, startZ - corridorLength / 2, 20, 100, corridorLength);
    this.addWall(110, 0, startZ - corridorLength / 2, 20, 100, corridorLength);

    // Distance markers along corridor
    for (let i = 0; i <= corridorLength; i += 100) {
      this.addFloorMarker(0, startZ - i, i);
    }

    // Bhop platforms (varying heights)
    const platforms = [
      { x: 0, z: -400, height: 32 },
      { x: 0, z: -550, height: 48 },
      { x: 0, z: -700, height: 32 },
      { x: 0, z: -850, height: 64 },
      { x: 0, z: -1000, height: 48 },
    ];

    for (const p of platforms) {
      this.addPlatformWithVisual(p.x, p.height, p.z, 100, 60, 16);
    }

    this.addZoneLabel('BHOP ZONE', 0, 120, startZ);
  }

  private addStrafeZone(): void {
    // Very long corridor for strafe jumping practice
    const startX = 300;
    const corridorLength = 3000;

    // Main corridor floor
    this.addPlatformWithVisual(startX + corridorLength / 2, 0, 0, corridorLength, 150, 8);

    // Side walls
    this.addWall(startX + corridorLength / 2, 0, -85, corridorLength, 100, 20);
    this.addWall(startX + corridorLength / 2, 0, 85, corridorLength, 100, 20);

    // Distance markers
    for (let i = 0; i <= corridorLength; i += 100) {
      this.addFloorMarker(startX + i, 0, i);
    }

    // Speed checkpoints
    const checkpoints = [500, 1000, 1500, 2000, 2500, 3000];
    for (const dist of checkpoints) {
      this.addCheckpointArch(startX + dist, 0);
    }

    this.addZoneLabel('STRAFE ZONE', startX + 100, 120, 0);
  }

  private addSurfZone(): void {
    const startX = -300;

    // Beginner surf ramps (45 degrees)
    this.addSurfRampWithVisual(startX - 200, 0, 0, 150, 200, 300, 45);
    this.addSurfRampWithVisual(startX - 200, 0, -400, 150, 200, 300, -45);

    // Medium surf ramps (50 degrees)
    this.addSurfRampWithVisual(startX - 500, 100, 0, 150, 250, 400, 50);
    this.addSurfRampWithVisual(startX - 500, 100, -400, 150, 250, 400, -50);

    // Advanced surf (55 degrees)
    this.addSurfRampWithVisual(startX - 900, 200, -200, 150, 300, 600, 52);

    // Landing platforms
    this.addPlatformWithVisual(startX - 200, 200, 200, 100, 100, 16);
    this.addPlatformWithVisual(startX - 500, 350, 200, 100, 100, 16);

    this.addZoneLabel('SURF ZONE', startX - 200, 300, 100);
  }

  private addLongJumpZone(): void {
    const startZ = 300;

    // Starting platform
    this.addPlatformWithVisual(0, 64, startZ, 150, 150, 64);

    // Jump pit with distance markers
    for (let dist = 0; dist <= 1000; dist += 50) {
      const z = startZ + 100 + dist;
      this.addFloorMarker(0, z, dist);

      // Landing platforms at key distances
      if (dist === 300 || dist === 400 || dist === 500 || dist === 600 || dist === 700) {
        const width = dist === 300 ? 80 : dist === 400 ? 60 : dist === 500 ? 50 : 40;
        this.addPlatformWithVisual(0, 0, z, width, 30, 8);
      }
    }

    // Side markers for visualization
    this.addWall(-100, 0, startZ + 600, 10, 30, 1000);
    this.addWall(100, 0, startZ + 600, 10, 30, 1000);

    this.addZoneLabel('LONG JUMP', 0, 150, startZ);
  }

  private addVerticalZone(): void {
    const startX = 400;
    const startZ = -400;

    // Stacked platforms at increasing heights
    const heights = [0, 64, 128, 192, 256, 320, 400, 500];
    const sizes = [150, 120, 100, 80, 70, 60, 50, 40];

    for (let i = 0; i < heights.length; i++) {
      const offset = i * 30; // Spiral offset
      const angle = (i * Math.PI) / 4;
      const x = startX + Math.cos(angle) * offset;
      const z = startZ + Math.sin(angle) * offset;

      this.addPlatformWithVisual(x, heights[i], z, sizes[i], sizes[i], 16);

      // Height marker
      if (i > 0) {
        this.addHeightMarker(x, heights[i], z, heights[i]);
      }
    }

    this.addZoneLabel('VERTICAL ZONE', startX, 550, startZ);
  }

  private addLadderZone(): void {
    const startX = -400;
    const startZ = -400;

    // Base platform
    this.addPlatformWithVisual(startX, 0, startZ, 150, 150, 8);

    // Ladder tower
    const ladderHeight = 500;
    this.addLadderWithVisual(startX + 50, 8, startZ, 30, ladderHeight);

    // Platforms at intervals
    const ladderPlatforms = [100, 200, 300, 400, 500];
    for (const height of ladderPlatforms) {
      this.addPlatformWithVisual(startX - 50, height, startZ, 80, 80, 16);
    }

    // Top platform
    this.addPlatformWithVisual(startX, ladderHeight + 8, startZ, 150, 150, 16);

    this.addZoneLabel('LADDER ZONE', startX, ladderHeight + 100, startZ);
  }

  private addCircleJumpZone(): void {
    const startX = 400;
    const startZ = 400;

    // 90-degree corner for circle jump starts
    this.addPlatformWithVisual(startX, 0, startZ, 200, 200, 8);

    // Corner walls
    this.addWall(startX - 110, 0, startZ, 20, 80, 200);
    this.addWall(startX, 0, startZ - 110, 200, 80, 20);

    // Target platforms at various distances
    const targets = [
      { x: startX + 300, z: startZ, dist: '300' },
      { x: startX + 400, z: startZ + 100, dist: '400' },
      { x: startX + 500, z: startZ, dist: '500' },
      { x: startX + 600, z: startZ + 100, dist: '600' },
    ];

    for (const t of targets) {
      this.addPlatformWithVisual(t.x, 0, t.z, 60, 60, 8);
      this.addZoneLabel(t.dist + 'u', t.x, 50, t.z);
    }

    this.addZoneLabel('CIRCLE JUMP', startX, 100, startZ);
  }

  // === Helper Methods ===

  private addPlatformWithVisual(
    x: number, y: number, z: number,
    width: number, depth: number, height: number
  ): void {
    // Visual
    const geom = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, this.platformMaterial);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Edge highlight
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 })
    );
    line.position.copy(mesh.position);
    this.scene.add(line);

    // Collision
    this.collision.addPlatform(x, y, z, width, depth, height);
  }

  private addWall(
    x: number, y: number, z: number,
    width: number, height: number, depth: number
  ): void {
    const geom = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, this.wallMaterial);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.collision.addBox(
      new THREE.Vector3(x - width / 2, y, z - depth / 2),
      new THREE.Vector3(x + width / 2, y + height, z + depth / 2)
    );
  }

  private addSurfRampWithVisual(
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    angle: number
  ): void {
    // Create angled ramp geometry
    const geom = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geom, this.surfMaterial);

    // Rotate for surf angle
    mesh.rotation.z = THREE.MathUtils.degToRad(angle);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Collision (simplified AABB)
    this.collision.addSurfRamp(x, y, z, width, height, depth, Math.abs(angle));
  }

  private addLadderWithVisual(
    x: number, y: number, z: number,
    width: number, height: number
  ): void {
    // Ladder visual (rungs)
    const rungCount = Math.floor(height / 30);
    for (let i = 0; i < rungCount; i++) {
      const rungGeom = new THREE.BoxGeometry(width, 4, 8);
      const rung = new THREE.Mesh(rungGeom, this.ladderMaterial);
      rung.position.set(x, y + i * 30 + 15, z);
      this.scene.add(rung);
    }

    // Side rails
    const railGeom = new THREE.BoxGeometry(4, height, 4);
    const leftRail = new THREE.Mesh(railGeom, this.ladderMaterial);
    const rightRail = new THREE.Mesh(railGeom, this.ladderMaterial);
    leftRail.position.set(x - width / 2, y + height / 2, z);
    rightRail.position.set(x + width / 2, y + height / 2, z);
    this.scene.add(leftRail);
    this.scene.add(rightRail);

    // Collision
    this.collision.addLadder(x, y, z, width, height);
  }

  private addFloorMarker(x: number, z: number, distance: number): void {
    // Marker line on ground
    const markerGeom = new THREE.PlaneGeometry(distance % 500 === 0 ? 100 : 50, 4);
    const markerMat = new THREE.MeshBasicMaterial({
      color: distance % 500 === 0 ? 0xff4444 : distance % 100 === 0 ? 0xffff44 : 0x666688,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.5, z);
    this.scene.add(marker);
  }

  private addHeightMarker(x: number, y: number, z: number, _height: number): void {
    // Simple height indicator
    const poleGeom = new THREE.CylinderGeometry(2, 2, 20, 8);
    const pole = new THREE.Mesh(poleGeom, this.markerMaterial);
    pole.position.set(x, y + 10, z);
    this.scene.add(pole);
  }

  private addCheckpointArch(x: number, z: number): void {
    // Simple arch marker
    const archGeom = new THREE.TorusGeometry(60, 4, 8, 16, Math.PI);
    const archMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const arch = new THREE.Mesh(archGeom, archMat);
    arch.rotation.y = Math.PI / 2;
    arch.rotation.x = Math.PI / 2;
    arch.position.set(x, 60, z);
    this.scene.add(arch);
  }

  private addZoneLabel(text: string, x: number, y: number, z: number): void {
    // Create text sprite
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 256, 64);

    ctx.font = 'bold 32px Consolas, monospace';
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y, z);
    sprite.scale.set(128, 32, 1);
    this.scene.add(sprite);
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);

    // Main directional light (sun)
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(500, 1000, 500);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 3000;
    sun.shadow.camera.left = -1500;
    sun.shadow.camera.right = 1500;
    sun.shadow.camera.top = 1500;
    sun.shadow.camera.bottom = -1500;
    this.scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0x4466aa, 0.3);
    fill.position.set(-500, 500, -500);
    this.scene.add(fill);
  }

  private setupSkybox(): void {
    // Simple gradient sky
    const skyGeom = new THREE.SphereGeometry(5000, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0a0a1a) },
        bottomColor: { value: new THREE.Color(0x1a1a3e) },
        offset: { value: 500 },
        exponent: { value: 0.4 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });

    const sky = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(sky);
  }

  /**
   * Get spawn position
   */
  getSpawnPosition(): THREE.Vector3 {
    return new THREE.Vector3(0, 64, 0);
  }
}
