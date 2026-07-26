import Phaser from 'phaser';

interface ItemDrop {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface Creature {
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  level: number; // 1, 2, or 3
  name: string;
  state: 'NEUTRAL' | 'PURSUIT' | 'ATTACK' | 'FLEE';
  isAggro: boolean;
  hpBar: Phaser.GameObjects.Graphics;
  hoverLabel: Phaser.GameObjects.Text;
  isHovered: boolean;
  lastAttackTime: number;
  patrolTarget: Phaser.Math.Vector2;
  isEating?: boolean;
  isIdle?: boolean;
  idleEndTime?: number;
  spawnPoint: Phaser.Math.Vector2;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: any;

  // Player Stats
  private playerLevel: number = 1;
  private playerXp: number = 0;
  private playerHp: number = 100;
  private playerMaxHp: number = 100;
  private playerMana: number = 10;
  private playerMaxMana: number = 10;
  private playerAttackPower: number = 25;
  private lastPlayerAttackTime: number = 0;

  // Game Groups
  private creatures: Creature[] = [];
  private lootBags!: Phaser.Physics.Arcade.Group;
  private treeNodes!: Phaser.GameObjects.Group;
  private stumpGroup!: Phaser.GameObjects.Group;
  private rockGroup!: Phaser.Physics.Arcade.StaticGroup;
  private waterTiles!: Phaser.Physics.Arcade.StaticGroup;
  private animatedWaterObjects: Array<{ sprite: Phaser.GameObjects.Image; baseIsoY: number; phaseOffset: number }> = [];
  private creaturesGroup!: Phaser.Physics.Arcade.Group;

  // Center Coordinates of the Island
  private islandCenterIsoX: number = 0;
  private islandCenterIsoY: number = 1152;

  // Inventory Data
  private inventory: Map<string, ItemDrop> = new Map();

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // 0. Set Clear Tropical Daytime Sky Background
    this.cameras.main.setBackgroundColor(0x38bdf8);

    this.creaturesGroup = this.physics.add.group();
    this.treeNodes = this.add.group(); // PURE VISUAL GROUP: Visual tree sprites
    this.stumpGroup = this.add.group(); // PURE VISUAL GROUP: Visual stump sprites
    this.rockGroup = this.physics.add.staticGroup(); // STATIC PHYSICS GROUP: Small decorative rocks with small collider!

    this.createIslandMap();
    this.createGatheringNodes();
    this.createPlayer();
    this.createCreatures();

    this.lootBags = this.physics.add.group();
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.15);
    this.setupInputs();

    // Physics Colliders: Player and Animals Collide with Ocean Water & Small Rocks 🌊🪨
    this.physics.add.collider(this.player, this.waterTiles);
    this.physics.add.collider(this.creaturesGroup, this.waterTiles);
    this.physics.add.collider(this.player, this.rockGroup);
    this.physics.add.collider(this.creaturesGroup, this.rockGroup);
    this.physics.add.overlap(this.player, this.lootBags, this.collectLoot, undefined, this);

    // Passive Regeneration Timers:
    // 1. Life Regeneration: +1 HP per 1 second for Player & Animals
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.playerHp > 0 && this.playerHp < this.playerMaxHp) {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 1);
        }
        this.creatures.forEach(c => {
          if (c.sprite.active && c.hp > 0 && c.hp < c.maxHp) {
            c.hp = Math.min(c.maxHp, c.hp + 1);
          }
        });
        this.updateHud();
      }
    });

    // 2. Mana Regeneration: +1 Mana every 2 seconds (0.5 Mana/s)
    this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        if (this.playerMana < this.playerMaxMana) {
          this.playerMana = Math.min(this.playerMaxMana, this.playerMana + 1);
          this.updateHud();
        }
      }
    });

    this.updateHud();
    this.loadSavedCharacter();

    // Auto-Save Player Progress to Server every 10 seconds
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.savePlayerToServer()
    });
  }

  public async loadSavedCharacter() {
    try {
      const res = await fetch('http://localhost:3002/api/player/HéroeAtNight');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.player) {
        const p = data.player;
        this.playerLevel = p.level || 1;
        this.playerXp = p.xp || 0;
        this.playerHp = p.hp || 100;
        this.playerMaxHp = p.maxHp || 100;
        this.playerMana = p.mana || 10;
        this.playerMaxMana = p.maxMana || 10;

        if (typeof window !== 'undefined' && (window as any).characterStats) {
          const stats = (window as any).characterStats;
          stats.name = p.characterName || 'Héroe de la Noche';
          stats.level = this.playerLevel;
          stats.availablePoints = p.availablePoints || 0;
          if (p.elements) stats.elements = p.elements;
          if (p.specials) stats.specials = p.specials;
          if ((window as any).updateCaracteristicasUI) {
            (window as any).updateCaracteristicasUI();
          }
        }
        this.updateHud();
        console.log('✅ Personaje cargado desde el servidor local:', p.characterName);
      }
    } catch (err) {
      console.log('ℹ️ Servidor local no disponible, operando en cliente.');
    }
  }

  public async savePlayerToServer() {
    try {
      const stats = (typeof window !== 'undefined' && (window as any).characterStats) ? (window as any).characterStats : {};
      const payload = {
        characterName: 'HéroeAtNight',
        level: this.playerLevel,
        xp: this.playerXp,
        availablePoints: stats.availablePoints || 0,
        elements: stats.elements || {},
        specials: stats.specials || {},
        hp: this.playerHp,
        maxHp: this.playerMaxHp,
        mana: this.playerMana,
        maxMana: this.playerMaxMana,
        inventory: Array.from(this.inventory.values()),
        lastPosition: { x: this.player ? this.player.x : 0, y: this.player ? this.player.y : 0 }
      };

      await fetch('http://localhost:3002/api/player/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      // Silent catch
    }
  }

  update(time: number, _delta: number) {
    this.handlePlayerMovement();
    this.updateCreaturesAI(time);
    this.updateDepthSorting();
    this.animateOceanWaves(time);
  }

  private createIslandMap() {
    this.waterTiles = this.physics.add.staticGroup();
    this.animatedWaterObjects = [];

    const mapSize = 36;
    const center = mapSize / 2;
    const tileW = 128;
    const tileH = 64;

    this.islandCenterIsoX = 0;
    this.islandCenterIsoY = Math.round((center + center) * (tileH / 2)) - 20;

    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        const dx = x - center;
        const dy = y - center;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);

        const baseIsoX = Math.round((x - y) * (tileW / 2));
        const baseIsoY = Math.round((x + y) * (tileH / 2));

        if (distFromCenter <= 10.2) {
          const isoY = baseIsoY - 20;
          const tile = this.add.image(baseIsoX, isoY, 'tile-grass');
          tile.setOrigin(0.5, 0);
          tile.setDepth(-5000 + baseIsoY);
        } else if (distFromCenter <= 13.2) {
          const isoY = baseIsoY - 10;
          const tile = this.add.image(baseIsoX, isoY, 'tile-sand');
          tile.setOrigin(0.5, 0);
          tile.setDepth(-5000 + baseIsoY);
        } else {
          const isoY = baseIsoY;
          const waterTile = this.add.image(baseIsoX, isoY, 'tile-water');
          waterTile.setOrigin(0.5, 0);
          waterTile.setDepth(-5000 + baseIsoY);

          this.animatedWaterObjects.push({
            sprite: waterTile,
            baseIsoY,
            phaseOffset: (x * 0.3) + (y * 0.2)
          });

          const waterCollider = this.waterTiles.create(baseIsoX, isoY + 16, 'tile-water');
          waterCollider.setVisible(false);
          waterCollider.refreshBody();
        }
      }
    }
  }

  private animateOceanWaves(time: number) {
    this.animatedWaterObjects.forEach(item => {
      const waveOffset = Math.sin(time * 0.0025 + item.phaseOffset) * 2.5;
      item.sprite.y = item.baseIsoY + waveOffset;
    });
  }

  private createGatheringNodes() {
    const nodePositions = [
      { x: this.islandCenterIsoX - 250, y: this.islandCenterIsoY + 180 },
      { x: this.islandCenterIsoX + 320, y: this.islandCenterIsoY - 150 },
      { x: this.islandCenterIsoX - 180, y: this.islandCenterIsoY - 280 },
      { x: this.islandCenterIsoX + 380, y: this.islandCenterIsoY + 280 },
      { x: this.islandCenterIsoX - 350, y: this.islandCenterIsoY - 80 }
    ];

    nodePositions.forEach(pos => {
      // 1. Permanent Stump Visual Sprite (NO PHYSICS COLLIDER AT ALL!)
      const stump = this.add.sprite(pos.x, pos.y, 'tree-stump');
      stump.setOrigin(0.5, 0.85);
      stump.setScale(1.5);
      stump.setDepth(pos.y - 1);
      this.stumpGroup.add(stump);

      // 2. Small Decorative Rock attached to stump with small physical collider (18x12px)!
      const rock = this.rockGroup.create(pos.x + 22, pos.y + 6, 'small-rock') as Phaser.Physics.Arcade.Sprite;
      rock.setOrigin(0.5, 0.85);
      rock.setScale(1.2);
      const rBody = rock.body as Phaser.Physics.Arcade.StaticBody;
      if (rBody) {
        rBody.setSize(18, 12); // Small physical rock collider!
        rBody.setOffset(7, 14);
      }
      rock.refreshBody();
      rock.setDepth(pos.y + 6);

      // 3. Pure Visual Tree Sprite (NO PHYSICS BODY AT ALL!)
      const tree = this.add.sprite(pos.x, pos.y, 'node-tree');
      tree.setOrigin(0.5, 0.85);
      tree.setScale(1.5);
      tree.setDepth(pos.y);
      tree.setData('name', 'Manzano');
      tree.setData('type', 'tree');
      tree.setData('hp', 3);
      this.treeNodes.add(tree);
    });
  }

  private lastDirection: string = 'down';

  private createPlayer() {
    const dirs = ['down', 'up', 'right', 'left', 'down-right', 'down-left', 'up-right', 'up-left'];
    dirs.forEach(d => {
      if (!this.anims.exists(`hero-walk-${d}`)) {
        this.anims.create({
          key: `hero-walk-${d}`,
          frames: [
            { key: `hero-${d}-1` },
            { key: `hero-${d}-2` },
            { key: `hero-${d}-3` },
            { key: `hero-${d}-0` }
          ],
          frameRate: 9,
          repeat: -1
        });
      }
      if (!this.anims.exists(`hero-idle-${d}`)) {
        this.anims.create({
          key: `hero-idle-${d}`,
          frames: [
            { key: `hero-${d}-0` }
          ],
          frameRate: 1,
          repeat: -1
        });
      }
    });

    this.player = this.physics.add.sprite(this.islandCenterIsoX, this.islandCenterIsoY, 'hero-down-0');
    this.player.setOrigin(0.5, 0.85);
    this.player.setCollideWorldBounds(false);
    this.player.body?.setSize(32, 24);
    this.player.body?.setOffset(16, 78);
    this.player.setDepth(this.islandCenterIsoY);
  }

  private getPolloLevelData(level: number) {
    switch (level) {
      case 1:
        return { maxHp: 100, scale: 0.81, xp: 50 }; // 0.9 * 0.9 = 0.81 relative to Level 3
      case 2:
        return { maxHp: 200, scale: 0.90, xp: 75 }; // 0.9 relative to Level 3
      case 3:
      default:
        return { maxHp: 300, scale: 1.00, xp: 100 }; // Level 3 base scale
    }
  }

  private createCreatures() {
    const birdDirs = ['down', 'up', 'right', 'left'];
    birdDirs.forEach(d => {
      if (!this.anims.exists(`chick-walk-peaceful-${d}`)) {
        this.anims.create({
          key: `chick-walk-peaceful-${d}`,
          frames: [
            { key: `chick-peaceful-${d}-1` },
            { key: `chick-peaceful-${d}-0` },
            { key: `chick-peaceful-${d}-2` },
            { key: `chick-peaceful-${d}-0` }
          ],
          frameRate: 8,
          repeat: -1
        });
      }
      if (!this.anims.exists(`chick-walk-angry-${d}`)) {
        this.anims.create({
          key: `chick-walk-angry-${d}`,
          frames: [
            { key: `chick-angry-${d}-1` },
            { key: `chick-angry-${d}-0` },
            { key: `chick-angry-${d}-2` },
            { key: `chick-angry-${d}-0` }
          ],
          frameRate: 10,
          repeat: -1
        });
      }
      if (!this.anims.exists(`chick-eat-anim-${d}`)) {
        this.anims.create({
          key: `chick-eat-anim-${d}`,
          frames: [
            { key: `chick-eat-${d}-0` },
            { key: `chick-eat-${d}-1` },
            { key: `chick-eat-${d}-0` },
            { key: `chick-eat-${d}-1` }
          ],
          frameRate: 4,
          repeat: 1
        });
      }
    });

    if (!this.anims.exists('chick-idle-looking-around')) {
      this.anims.create({
        key: 'chick-idle-looking-around',
        frames: [
          { key: 'chick-peaceful-down-0' },
          { key: 'chick-peaceful-left-0' },
          { key: 'chick-peaceful-down-0' },
          { key: 'chick-peaceful-right-0' }
        ],
        frameRate: 2.5,
        repeat: -1
      });
    }

    // Exactly 6 Pollos on the map at all times
    const polloSpawns = [
      { x: this.islandCenterIsoX + 160, y: this.islandCenterIsoY + 120 },
      { x: this.islandCenterIsoX - 220, y: this.islandCenterIsoY + 150 },
      { x: this.islandCenterIsoX + 250, y: this.islandCenterIsoY - 180 },
      { x: this.islandCenterIsoX - 200, y: this.islandCenterIsoY - 160 },
      { x: this.islandCenterIsoX + 120, y: this.islandCenterIsoY + 300 },
      { x: this.islandCenterIsoX - 280, y: this.islandCenterIsoY - 20 }
    ];

    polloSpawns.forEach(spawn => {
      const level = Phaser.Math.Between(1, 3);
      const stats = this.getPolloLevelData(level);

      const sprite = this.physics.add.sprite(spawn.x, spawn.y, 'chick-peaceful-down-0');
      sprite.setOrigin(0.5, 0.8);
      sprite.setScale(stats.scale);
      sprite.body?.setSize(28, 20);
      sprite.body?.setOffset(18, 38);
      sprite.setInteractive({ useHandCursor: true });
      this.creaturesGroup.add(sprite);

      const hpBar = this.add.graphics();
      hpBar.setDepth(5000);

      const hoverLabel = this.add.text(spawn.x, spawn.y - 35, `Pollo Niv. ${level}`, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5, 1).setDepth(10000).setVisible(false);

      const creature: Creature = {
        sprite,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        level,
        name: 'Pollo',
        state: 'NEUTRAL',
        isAggro: false,
        hpBar,
        hoverLabel,
        isHovered: false,
        lastAttackTime: 0,
        patrolTarget: new Phaser.Math.Vector2(spawn.x + Phaser.Math.Between(-30, 30), spawn.y + Phaser.Math.Between(-30, 30)),
        isIdle: true,
        idleEndTime: this.time.now + Phaser.Math.Between(1500, 4000),
        spawnPoint: new Phaser.Math.Vector2(spawn.x, spawn.y)
      };

      sprite.on('pointerover', () => {
        creature.isHovered = true;
        hoverLabel.setText(`Pollo Niv. ${creature.level}`);
        hoverLabel.setVisible(true);
      });

      sprite.on('pointerout', () => {
        creature.isHovered = false;
        hoverLabel.setVisible(false);
      });

      this.creatures.push(creature);
    });
  }

  private clickTarget: { x: number; y: number } | null = null;
  private targetTileGraphic: Phaser.GameObjects.Graphics | null = null;

  private setupInputs() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      skill1: Phaser.Input.Keyboard.KeyCodes.ONE,
      skill2: Phaser.Input.Keyboard.KeyCodes.TWO,
      gather: Phaser.Input.Keyboard.KeyCodes.E
    });

    // Pointer Click: Move to Clicked Location on Map
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // Check if clicking directly on a creature to attack
      let clickedCreature = false;
      this.creatures.forEach(c => {
        if (c.sprite.active && c.sprite.getBounds().contains(worldPoint.x, worldPoint.y)) {
          clickedCreature = true;
          this.handlePlayerAttack(worldPoint);
        }
      });

      if (!clickedCreature) {
        // Set Click Target Destination
        this.clickTarget = { x: worldPoint.x, y: worldPoint.y };
        this.updateTileGridMarker(worldPoint.x, worldPoint.y);
      }
    });

    // Keyboard Shortcuts
    this.wasdKeys.skill1.on('down', () => this.handlePlayerAttack());
    this.wasdKeys.skill2.on('down', () => this.handleSpecialSkill());
    this.wasdKeys.gather.on('down', () => this.handleGathering());
  }

  private updateTileGridMarker(worldX: number, worldY: number) {
    // Snap world coordinates to exact Isometric Diamond Tile (64x32px)
    const isoI = Math.round((worldX / 32 + worldY / 16) / 2);
    const isoJ = Math.round((worldY / 16 - worldX / 32) / 2);
    const cellX = (isoI - isoJ) * 32;
    const cellY = (isoI + isoJ) * 16;

    if (!this.targetTileGraphic) {
      this.targetTileGraphic = this.add.graphics();
    }

    // Render persistent cyan tile grid highlight
    this.targetTileGraphic.clear();
    this.targetTileGraphic.lineStyle(2, 0x00f2fe, 0.95);
    this.targetTileGraphic.fillStyle(0x00f2fe, 0.25);

    // Draw Isometric Diamond Tile (64x32)
    this.targetTileGraphic.beginPath();
    this.targetTileGraphic.moveTo(cellX, cellY - 16);
    this.targetTileGraphic.lineTo(cellX + 32, cellY);
    this.targetTileGraphic.lineTo(cellX, cellY + 16);
    this.targetTileGraphic.lineTo(cellX - 32, cellY);
    this.targetTileGraphic.closePath();
    this.targetTileGraphic.fillPath();
    this.targetTileGraphic.strokePath();

    this.targetTileGraphic.setDepth(cellY - 20);
  }

  private handlePlayerMovement() {
    if (!this.player || !this.player.body) return;

    // Ignore keyboard movement if typing inside any form input field
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') {
      return;
    }

    const speed = 220;
    let vx = 0;
    let vy = 0;

    // Check Keyboard Inputs (WASD / Arrows)
    if (this.cursors.left.isDown || this.wasdKeys.left.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.right.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasdKeys.up.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.down.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      // Manual Keyboard Override: Cancel click movement target & clear marker
      this.clickTarget = null;
      if (this.targetTileGraphic) {
        this.targetTileGraphic.clear();
      }
      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }
    } else if (this.clickTarget) {
      // Point-and-Click Movement towards clickTarget
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.clickTarget.x, this.clickTarget.y);
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const isBlocked = playerBody && (!playerBody.blocked.none || !playerBody.touching.none);

      if (dist > 14 && !isBlocked) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.clickTarget.x, this.clickTarget.y);
        vx = Math.cos(angle);
        vy = Math.sin(angle);
      } else {
        // Arrived at destination tile OR blocked by solid tree trunk! Clear target & tile marker
        this.clickTarget = null;
        if (this.targetTileGraphic) {
          this.targetTileGraphic.clear();
        }
      }
    }

    this.player.setVelocity(vx * speed, vy * speed);

    // Determine 8-Directional Angle & Animation Key
    if (vx !== 0 || vy !== 0) {
      let currentDir = 'down';

      const angleDeg = Phaser.Math.RadToDeg(Math.atan2(vy, vx));
      if (angleDeg >= -22.5 && angleDeg < 22.5) currentDir = 'right';
      else if (angleDeg >= 22.5 && angleDeg < 67.5) currentDir = 'down-right';
      else if (angleDeg >= 67.5 && angleDeg < 112.5) currentDir = 'down';
      else if (angleDeg >= 112.5 && angleDeg < 157.5) currentDir = 'down-left';
      else if (angleDeg >= 157.5 || angleDeg < -157.5) currentDir = 'left';
      else if (angleDeg >= -157.5 && angleDeg < -112.5) currentDir = 'up-left';
      else if (angleDeg >= -112.5 && angleDeg < -67.5) currentDir = 'up';
      else if (angleDeg >= -67.5 && angleDeg < -22.5) currentDir = 'up-right';

      this.lastDirection = currentDir;
      this.player.play(`hero-walk-${currentDir}`, true);
    } else {
      // Idle Stance / Reposo en las 8 direcciones
      this.player.play(`hero-idle-${this.lastDirection}`, true);
    }
  }

  private updateDepthSorting() {
    this.player.setDepth(this.player.y);

    this.creatures.forEach(c => {
      if (c.sprite.active) {
        c.sprite.setDepth(c.sprite.y);
        this.renderCreatureHpBar(c);
      }
    });
  }

  // --- Real-Time Action Combat ---
  public handlePlayerAttack(targetPoint?: Phaser.Math.Vector2) {
    const time = this.time.now;
    if (time - this.lastPlayerAttackTime < 400) return;
    this.lastPlayerAttackTime = time;

    // Slash Arc Visual Effect
    const slashX = this.player.x + (this.player.flipX ? -30 : 30);
    const slashY = this.player.y - 20;
    const slash = this.add.image(slashX, slashY, 'slash-effect');
    slash.setDepth(this.player.y + 10);
    slash.setFlipX(this.player.flipX);
    
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.4,
      duration: 200,
      onComplete: () => slash.destroy()
    });

    // Check Melee Hitbox Range
    const attackRange = 95;
    this.creatures.forEach(c => {
      if (!c.sprite.active) return;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y);
      if (dist <= attackRange) {
        const isCrit = Math.random() < 0.2;
        const damage = isCrit ? Math.round(this.playerAttackPower * 1.8) : this.playerAttackPower;

        c.hp -= damage;

        if (!c.isAggro) {
          c.isAggro = true;
          c.state = 'PURSUIT';
        }

        this.showFloatingText(c.sprite.x, c.sprite.y - 30, `-${damage}${isCrit ? ' CRIT!' : ''}`, isCrit ? '#ef4444' : '#ffffff');

        c.sprite.setTint(0xff0000);
        this.time.delayedCall(120, () => c.sprite.clearTint());

        if (c.hp <= 0) {
          this.killCreature(c);
        }
      }
    });
  }

  public handleSpecialSkill() {
    const time = this.time.now;
    if (time - this.lastPlayerAttackTime < 800) return;
    this.lastPlayerAttackTime = time;

    const nova = this.add.circle(this.player.x, this.player.y, 10, 0x00f2fe, 0.6);
    nova.setDepth(this.player.y + 5);

    this.tweens.add({
      targets: nova,
      radius: 140,
      alpha: 0,
      duration: 350,
      onComplete: () => nova.destroy()
    });

    this.creatures.forEach(c => {
      if (!c.sprite.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y);
      if (dist <= 140) {
        const damage = Math.round(this.playerAttackPower * 1.4);
        c.hp -= damage;

        if (!c.isAggro) {
          c.isAggro = true;
          c.state = 'PURSUIT';
        }
        this.showFloatingText(c.sprite.x, c.sprite.y - 30, `-${damage} ⚡`, '#00f2fe');

        if (c.hp <= 0) {
          this.killCreature(c);
        }
      }
    });
  }

  // --- Real-Time Neutral Fowl Creature AI ---
  private updateCreaturesAI(time: number) {
    const attackRadius = 45;

    this.creatures.forEach(c => {
      if (!c.sprite.active || !c.sprite.body) return;

      const body = c.sprite.body as Phaser.Physics.Arcade.Body;
      const distToPlayer = Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, this.player.x, this.player.y);

      // Check physics collision blockage against water/rocks/trees
      const isBlocked = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down ||
                        body.touching.left || body.touching.right || body.touching.up || body.touching.down;

      if (!c.isAggro) {
        if (c.isEating) {
          body.setVelocity(0, 0);
          return;
        }

        // Idle / Rest State with Looking-Around Animation 🐓👀
        if (c.isIdle) {
          body.setVelocity(0, 0);
          if (time > (c.idleEndTime || 0)) {
            c.isIdle = false;
            // Pick a short target 30 to 70px away ("caminar unos pocos cuadros")
            const randAngle = Math.random() * Math.PI * 2;
            const randDist = Phaser.Math.Between(30, 75);
            c.patrolTarget.set(
              Phaser.Math.Clamp(c.sprite.x + Math.cos(randAngle) * randDist, this.islandCenterIsoX - 450, this.islandCenterIsoX + 450),
              Phaser.Math.Clamp(c.sprite.y + Math.sin(randAngle) * randDist, this.islandCenterIsoY - 350, this.islandCenterIsoY + 350)
            );
          } else {
            c.sprite.play('chick-idle-looking-around', true);
            return;
          }
        }

        const distToTarget = Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, c.patrolTarget.x, c.patrolTarget.y);
        
        // Reached target OR hit obstacle: Enter Idle / Rest / Look-Around state!
        if (distToTarget < 14 || isBlocked) {
          // 25% Chance to Peck ground for worms 🪱
          if (!isBlocked && Math.random() < 0.25) {
            c.isEating = true;
            body.setVelocity(0, 0);
            c.sprite.play(`chick-eat-anim-down`, true);
            this.time.delayedCall(1600, () => {
              c.isEating = false;
              c.isIdle = true;
              c.idleEndTime = time + Phaser.Math.Between(2000, 4500);
            });
            return;
          }

          // Otherwise enter Idle / Rest mode looking around for 2 to 4.5 seconds!
          c.isIdle = true;
          c.idleEndTime = time + Phaser.Math.Between(2000, 4500);
          body.setVelocity(0, 0);
          c.sprite.play('chick-idle-looking-around', true);
          return;
        }

        this.physics.moveToObject(c.sprite, c.patrolTarget, 30);
      } else {
        if (c.hp < c.maxHp * 0.25) {
          c.state = 'FLEE';
        } else if (distToPlayer <= attackRadius) {
          c.state = 'ATTACK';
        } else {
          c.state = 'PURSUIT';
        }

        switch (c.state) {
          case 'PURSUIT':
            if (isBlocked) {
              const bounceAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y) + (Math.random() < 0.5 ? 0.9 : -0.9);
              body.setVelocity(Math.cos(bounceAngle) * 90, Math.sin(bounceAngle) * 90);
            } else {
              this.physics.moveToObject(c.sprite, this.player, 100);
            }
            break;

          case 'ATTACK':
            body.setVelocity(0, 0);
            if (time - c.lastAttackTime > 1200) {
              c.lastAttackTime = time;
              this.damagePlayer(12);
            }
            break;

          case 'FLEE':
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, c.sprite.x, c.sprite.y);
            const fleeX = c.sprite.x + Math.cos(angle) * 120;
            const fleeY = c.sprite.y + Math.sin(angle) * 120;
            this.physics.moveTo(c.sprite, fleeX, fleeY, 120);
            break;
        }
      }

      // Update Hover Label Position Directly Above Pollo
      if (c.hoverLabel) {
        c.hoverLabel.setPosition(c.sprite.x, c.sprite.y - 35);
        if (c.isHovered && c.sprite.active) {
          c.hoverLabel.setText(`Pollo Niv. ${c.level}`);
          c.hoverLabel.setVisible(true);
        }
      }

      // Update Directional Creature Animations (Pause walking animation when blocked!)
      const vx = body.velocity.x;
      const vy = body.velocity.y;
      const actualSpeed = Math.sqrt(vx * vx + vy * vy);

      let dir = 'down';
      if (Math.abs(vx) > Math.abs(vy)) {
        dir = vx > 0 ? 'right' : 'left';
      } else if (Math.abs(vy) > 0.1) {
        dir = vy > 0 ? 'down' : 'up';
      }

      const animPrefix = c.isAggro ? 'chick-walk-angry' : 'chick-walk-peaceful';
      if (actualSpeed > 5 && !isBlocked) {
        c.sprite.play(`${animPrefix}-${dir}`, true);
      } else {
        c.sprite.stop();
        const stateKey = c.isAggro ? 'chick-angry' : 'chick-peaceful';
        c.sprite.setTexture(`${stateKey}-${dir}-0`);
      }
    });
  }

  private damagePlayer(amount: number) {
    this.playerHp = Math.max(0, this.playerHp - amount);
    this.showFloatingText(this.player.x, this.player.y - 40, `-${amount}`, '#ef4444');

    // Trigger Health Row Shake Pulse
    const healthRow = document.getElementById('hud-health-row');
    if (healthRow) {
      healthRow.classList.remove('hit-shake');
      void healthRow.offsetWidth;
      healthRow.classList.add('hit-shake');
    }

    this.player.setTint(0xff0000);
    this.time.delayedCall(150, () => this.player.clearTint());

    this.updateHud();

    if (this.playerHp <= 0) {
      // Death sequence with Red Camera Flash
      this.cameras.main.flash(500, 255, 0, 0);
      this.showFloatingText(this.player.x, this.player.y - 40, '¡HAS MUERTO! Reanimando en la Isla...', '#ef4444');

      this.time.delayedCall(700, () => {
        // Reset player HP & Mana back to max, position back to island center, keeping inventory completely intact!
        this.playerHp = this.playerMaxHp;
        this.playerMana = this.playerMaxMana;
        this.player.setPosition(this.islandCenterIsoX, this.islandCenterIsoY);
        this.updateHud();
        this.cameras.main.fadeIn(500);
      });
    }
  }

  private killCreature(c: Creature) {
    c.sprite.setActive(false);
    c.sprite.setVisible(false);
    if (c.sprite.body) c.sprite.body.stop();
    c.hpBar.clear();
    if (c.hoverLabel) c.hoverLabel.setVisible(false);

    // 1. Calculate Drops
    const dropsToSpawn: Array<{ id: string; name: string; count: number }> = [];

    // Monedas de Oro (1 a 100)
    const goldCount = Phaser.Math.Between(1, 100);
    dropsToSpawn.push({ id: 'gold', name: 'Monedas de Oro', count: goldCount });

    // Pluma de Pollo (50% probability)
    if (Math.random() < 0.50) {
      dropsToSpawn.push({ id: 'chicken_feather', name: 'Pluma de Pollo', count: 1 });
    }
    // Huevo de Pollo (30% probability)
    if (Math.random() < 0.30) {
      dropsToSpawn.push({ id: 'chicken_egg', name: 'Huevo de Pollo', count: 1 });
    }
    // Pico de Pollo (20% probability)
    if (Math.random() < 0.20) {
      dropsToSpawn.push({ id: 'chicken_beak', name: 'Pico de Pollo', count: 1 });
    }
    // Ojo de Pollo (15% probability)
    if (Math.random() < 0.15) {
      dropsToSpawn.push({ id: 'chicken_eye', name: 'Ojo de Pollo', count: 1 });
    }

    // Spawn physical drop items on the ground for player pickup
    dropsToSpawn.forEach((drop, idx) => {
      const offsetX = (idx - (dropsToSpawn.length - 1) / 2) * 16;
      const textureKey = this.textures.exists(drop.id) ? drop.id : 'loot-bag';
      const itemSprite = this.lootBags.create(c.sprite.x + offsetX, c.sprite.y + Phaser.Math.Between(-10, 10), textureKey) as Phaser.Physics.Arcade.Sprite;
      itemSprite.setDepth(c.sprite.y + 10);
      itemSprite.setScale(0.9);
      itemSprite.setData('itemId', drop.id);
      itemSprite.setData('itemName', drop.name);
      itemSprite.setData('itemCount', drop.count);
    });

    // 2. XP Reward proportional to Level with dynamic Level-Difference modifier (+1% per level higher, -1% per level lower)
    const baseXp = c.level === 1 ? 50 : (c.level === 2 ? 75 : 100);
    const levelDiff = c.level - this.playerLevel;
    const xpModifier = 1 + (levelDiff * 0.01);
    const xpReward = Math.max(1, Math.round(baseXp * Math.max(0.01, xpModifier)));

    this.gainXp(xpReward);

    const summaryText = dropsToSpawn.map(d => `+${d.count} ${d.name}`).join(' ');
    this.showFloatingText(c.sprite.x, c.sprite.y - 30, `+${xpReward} XP ${summaryText}`, '#f59e0b');

    // 3. Respawn 3 Minutes Later (180,000 ms) with Random Level (1, 2, or 3)
    this.time.delayedCall(180000, () => {
      const newLevel = Phaser.Math.Between(1, 3);
      const stats = this.getPolloLevelData(newLevel);

      c.level = newLevel;
      c.hp = stats.maxHp;
      c.maxHp = stats.maxHp;
      c.isAggro = false;
      c.state = 'NEUTRAL';
      c.isIdle = true;
      c.idleEndTime = this.time.now + Phaser.Math.Between(1500, 3500);

      const spawnX = c.spawnPoint.x;
      const spawnY = c.spawnPoint.y;

      c.sprite.setPosition(spawnX, spawnY);
      c.sprite.setScale(stats.scale);
      c.sprite.setAlpha(1);
      c.sprite.setActive(true);
      c.sprite.setVisible(true);
      c.sprite.setTexture('chick-peaceful-down-0');
    });
  }

  // --- Gathering & Loot Logic ---
  public handleGathering() {
    let gatheredAny = false;

    this.treeNodes.getChildren().forEach((treeObj: any) => {
      const tree = treeObj as Phaser.Physics.Arcade.Sprite;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tree.x, tree.y);

      if (dist <= 115) {
        gatheredAny = true;
        
        this.tweens.add({
          targets: tree,
          angle: 4,
          duration: 80,
          yoyo: true,
          repeat: 2
        });

        const hp = (tree.getData('hp') || 3) - 1;
        tree.setData('hp', hp);

        if (hp <= 0) {
          // 1. Calculate Drops
          const woodCount = Math.floor(Math.random() * 5) + 1; // 1 a 5 Madera de Manzano (20% cada una)
          const appleCount = Math.random() < 0.10 ? 2 : 1;    // 1 Manzana (90%), 2 Manzanas (10%)

          this.addInventoryItem('wood_apple', 'Madera de Manzano', '', woodCount);
          this.addInventoryItem('apple_fruit', 'Manzana', '', appleCount);
          this.showFloatingText(tree.x, tree.y - 40, `+${woodCount} Madera de Manzano +${appleCount} Manzana`, '#eab308');

          // 2. Falling Tree Animation (Tree tilts to 90° horizontal and disappears)
          const originalY = tree.y;
          const originalX = tree.x;
          const fallAngle = Math.random() < 0.5 ? 90 : -90;
          this.tweens.add({
            targets: tree,
            angle: fallAngle,
            y: originalY + 20,
            duration: 1000,
            ease: 'Quad.easeIn',
            onComplete: () => {
              // Fade out when horizontal
              this.tweens.add({
                targets: tree,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  tree.setActive(false);
                  tree.setVisible(false);
                }
              });
            }
          });

          // 3. Respawn Timer (Random between 3 to 5 minutes: 180,000ms - 300,000ms)
          const respawnDelayMs = Phaser.Math.Between(180000, 300000);

          this.time.delayedCall(respawnDelayMs, () => {
            // Tree grows back in 2s out of the permanent stump!
            tree.setPosition(originalX, originalY);
            tree.setAngle(0);
            tree.setAlpha(1);
            tree.setScale(0); // Starts at scale 0
            tree.setActive(true);
            tree.setVisible(true);
            tree.setData('hp', 3);

            // 4. Single Smooth Growth Motion (Grows continuously in 2 seconds)
            this.tweens.add({
              targets: tree,
              scaleX: 1.5,
              scaleY: 1.5,
              duration: 2000,
              ease: 'Cubic.easeOut'
            });
          });
        } else {
          this.showFloatingText(tree.x, tree.y - 40, '¡Talando Manzano...!', '#cbd5e1');
        }
      }
    });

    if (!gatheredAny) {
      this.showFloatingText(this.player.x, this.player.y - 30, 'Acércate a un árbol frutal (E)', '#94a3b8');
    }
  }

  private collectLoot(playerObj: any, lootObj: any) {
    const loot = lootObj as Phaser.Physics.Arcade.Sprite;
    const itemId = loot.getData('itemId') || 'gold';
    const itemName = loot.getData('itemName') || 'Monedas de Oro';
    const itemCount = loot.getData('itemCount') || 15;

    loot.destroy();
    this.addInventoryItem(itemId, itemName, '', itemCount);
    this.showLootNotification(`¡Obtenido! ${itemCount}x ${itemName}`);
  }

  private addInventoryItem(id: string, name: string, icon: string, count: number) {
    if (this.inventory.has(id)) {
      const existing = this.inventory.get(id)!;
      existing.count += count;
    } else {
      this.inventory.set(id, { id, name, icon, count });
    }
    this.renderInventoryHtml();
  }

  private getXpRequiredForLevel(lvl: number): number {
    if (lvl >= 50) return 0; // Level 50 is MAX LEVEL CAP!
    let req = 1000;
    for (let l = 1; l < lvl; l++) {
      req = Math.round(req * 1.10);
    }
    return req;
  }

  private gainXp(amount: number) {
    this.playerXp += amount;

    let leveledUp = false;
    while (this.playerLevel < 50) {
      const req = this.getXpRequiredForLevel(this.playerLevel);
      if (this.playerXp >= req) {
        this.playerLevel++;
        this.playerXp -= req;
        this.playerMaxHp += 25;
        this.playerHp = this.playerMaxHp;
        this.playerMaxMana += 1;
        this.playerMana = this.playerMaxMana;
        this.playerAttackPower += 8;
        leveledUp = true;

        // Otorgar +5 Puntos de Características por cada nivel ganado
        if (typeof window !== 'undefined' && (window as any).characterStats) {
          const stats = (window as any).characterStats;
          stats.level = this.playerLevel;
          stats.availablePoints += 5;
          if ((window as any).updateCaracteristicasUI) {
            (window as any).updateCaracteristicasUI();
          }
        }

        this.showFloatingText(this.player.x, this.player.y - 50, `¡NIVEL ALCANZADO! LV. ${this.playerLevel} (+5 Puntos)`, '#00f2fe');
      } else {
        break;
      }
    }

    if (leveledUp && typeof window !== 'undefined' && (window as any).characterStats) {
      (window as any).characterStats.level = this.playerLevel;
      if ((window as any).updateCaracteristicasUI) {
        (window as any).updateCaracteristicasUI();
      }
    }

    this.updateHud();
  }

  private showFloatingText(x: number, y: number, textString: string, color: string) {
    const text = this.add.text(x, y, textString, {
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: color,
      stroke: '#000000',
      strokeThickness: 3
    });
    text.setOrigin(0.5);
    text.setDepth(20000);

    this.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 1200,
      onComplete: () => text.destroy()
    });
  }

  private showLootNotification(msg: string) {
    const feed = document.getElementById('loot-feed');
    if (!feed) return;

    const toast = document.createElement('div');
    toast.className = 'loot-toast';
    toast.innerHTML = msg;
    feed.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  private renderCreatureHpBar(c: Creature) {
    c.hpBar.clear();
    // Render HP bar DIRECTLY UNDERNEATH the animal when damaged or in combat!
    if (c.hp < c.maxHp || c.isAggro) {
      const w = 32;
      const h = 4;
      const x = c.sprite.x - w / 2;
      const y = c.sprite.y + 12; // Directly underneath the animal's feet!

      c.hpBar.fillStyle(0x0f172a, 0.75);
      m_fillRect(c.hpBar, x, y, w, h);

      const pct = Math.max(0, c.hp / c.maxHp);
      c.hpBar.fillStyle(0xef4444, 1);
      m_fillRect(c.hpBar, x, y, w * pct, h);
      c.hpBar.setDepth(c.sprite.y + 100);
    }
  }

  private updateHud() {
    const nameEl = document.getElementById('hud-player-name');
    const levelEl = document.getElementById('hud-player-level');

    const bottomHpFill = document.getElementById('bottom-hp-fill');
    const bottomHpText = document.getElementById('bottom-hp-text');

    const bottomManaFill = document.getElementById('bottom-mana-fill');
    const bottomManaText = document.getElementById('bottom-mana-text');

    const bottomXpFill = document.getElementById('bottom-xp-fill');
    const bottomXpText = document.getElementById('bottom-xp-text');

    if (nameEl) nameEl.innerText = 'Héroe AtNight';
    if (levelEl) levelEl.innerText = `Nivel ${this.playerLevel}`;

    // 1. Health Bar Update
    if (bottomHpFill && bottomHpText) {
      const pct = Math.max(0, (this.playerHp / this.playerMaxHp) * 100);
      bottomHpFill.style.width = `${pct}%`;
      bottomHpText.innerText = `${Math.ceil(this.playerHp)} / ${this.playerMaxHp} HP`;
    }

    // 2. Mana Bar Update (Capacity 10 default)
    if (bottomManaFill && bottomManaText) {
      const pct = Math.max(0, (this.playerMana / this.playerMaxMana) * 100);
      bottomManaFill.style.width = `${pct}%`;
      bottomManaText.innerText = `${Math.ceil(this.playerMana)} / ${this.playerMaxMana} MP`;
    }

    // 3. Experience Bar Update (Level 1: 1000 XP, +10% per level up to Level 50 MAX Cap)
    if (bottomXpFill && bottomXpText) {
      if (this.playerLevel >= 50) {
        bottomXpFill.style.width = '100%';
        bottomXpText.innerText = `Niv. 50 (MÁX) - ${this.playerXp} XP Total`;
      } else {
        const req = this.getXpRequiredForLevel(this.playerLevel);
        const pct = Math.max(0, Math.min(100, (this.playerXp / req) * 100));
        bottomXpFill.style.width = `${pct}%`;
        bottomXpText.innerText = `Niv. ${this.playerLevel} (${Math.floor(this.playerXp)} / ${req} XP)`;
      }
    }
  }

  private getTextureSrc(key: string): string {
    if (!this.textures.exists(key)) return '';
    try {
      const texture = this.textures.get(key);
      const image = texture.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
      if (image instanceof HTMLCanvasElement) {
        return image.toDataURL();
      } else if (image instanceof HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width || 32;
        canvas.height = image.height || 32;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(image, 0, 0);
        return canvas.toDataURL();
      }
    } catch (_e) {
      // Fallback
    }
    return '';
  }

  private renderInventoryHtml() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    grid.innerHTML = '';
    this.inventory.forEach(item => {
      const slot = document.createElement('div');
      slot.className = 'inventory-slot';
      slot.title = `${item.name} (${item.count})`;

      const imgSrc = this.getTextureSrc(item.id);
      let imgHtml = '';
      if (imgSrc) {
        imgHtml = `<img src="${imgSrc}" alt="${item.name}" style="width: 32px; height: 32px; object-fit: contain;" />`;
      } else {
        imgHtml = `<span style="font-size: 11px; color: #cbd5e1;">${item.name}</span>`;
      }

      slot.innerHTML = `
        ${imgHtml}
        <span class="item-count">${item.count}</span>
      `;
      grid.appendChild(slot);
    });
  }
}

function m_fillRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillRect(x, y, w, h);
}
