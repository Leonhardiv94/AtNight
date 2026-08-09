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
  public characterClass: string = 'arquero';
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

  // Temple Transition Data
  private pendingTempleEnter: boolean = false;
  private isSceneTransitioning: boolean = false;
  private templeDoorZone: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.image('temple-building', '/assets/temple-building.png');
  }

  create(data?: any) {
    this.isSceneTransitioning = false;
    this.pendingTempleEnter = false;

    if (data?.fromTempleInterior) {
      this.cameras.main.fadeIn(500, 0, 0, 0);
    }

    // 0. Set Clear Tropical Daytime Sky Background
    this.cameras.main.setBackgroundColor(0x38bdf8);

    this.creaturesGroup = this.physics.add.group();
    this.treeNodes = this.add.group(); // PURE VISUAL GROUP: Visual tree sprites
    this.stumpGroup = this.add.group(); // PURE VISUAL GROUP: Visual stump sprites
    this.rockGroup = this.physics.add.staticGroup(); // STATIC PHYSICS GROUP: Small decorative rocks with small collider!

    if (this.textures.exists('gold')) {
      this.textures.remove('gold');
    }
    const goldG = this.make.graphics({ x: 0, y: 0 });
    goldG.fillStyle(0xcbd5e1, 1);
    goldG.fillCircle(16, 16, 13);
    goldG.lineStyle(1.5, 0x475569, 1);
    goldG.strokeCircle(16, 16, 13);

    goldG.lineStyle(1.2, 0x64748b, 1);
    goldG.strokeCircle(16, 16, 9);

    goldG.fillStyle(0xf8fafc, 1);
    goldG.fillCircle(16, 16, 7.5);

    goldG.generateTexture('gold', 32, 32);
    goldG.destroy();

    this.createIslandMap();
    this.createTempleBuilding();
    this.createGatheringNodes();
    this.createPlayer();
    this.createCreatures();

    this.lootBags = this.physics.add.group();
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.setBackgroundColor('#008899');
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

    // 2. Mana Regeneration: +1 Mana every 1 second (1 Mana/s)
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.playerMana < this.playerMaxMana) {
          this.playerMana = Math.min(this.playerMaxMana, this.playerMana + 1);
          this.updateHud();
        }
      }
    });

    this.updateHud();
    const initialChar = (typeof window !== 'undefined' && (window as any).selectedCharacterName)
      ? (window as any).selectedCharacterName
      : (localStorage.getItem('atnight_active_char') || undefined);

    // Intentar aplicar apariencia inmediatamente desde localStorage si está disponible
    try {
      const cachedData = localStorage.getItem('atnight_active_char_data');
      if (cachedData) {
        const p = JSON.parse(cachedData);
        if (p) this.applyCharacterAppearance(p);
      }
    } catch (_e) {}

    this.loadSavedCharacter(initialChar);

    // Auto-Save Player Progress to Server every 10 seconds
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.savePlayerToServer()
    });
  }

  private currentCharacterName: string = '';
  private currentCharacterData: any = null;

  public async loadSavedCharacter(charName?: string) {
    const targetName = charName 
      || (typeof window !== 'undefined' ? (window as any).selectedCharacterName : undefined) 
      || localStorage.getItem('atnight_active_char')
      || 'Arquera';
    
    this.currentCharacterName = targetName;
    localStorage.setItem('atnight_active_char', targetName);

    try {
      const res = await fetch(`http://localhost:3002/api/player/${encodeURIComponent(this.currentCharacterName)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.player) {
        const p = data.player;
        this.currentCharacterData = p;
        localStorage.setItem('atnight_active_char_data', JSON.stringify(p));
        this.playerLevel = p.level || 1;
        let loadedXp = p.xp || 0;
        const threshold = this.getXpThresholdForLevel(this.playerLevel);
        if (loadedXp < threshold) {
          loadedXp = threshold + loadedXp;
        }
        this.playerXp = loadedXp;
        this.playerHp = p.hp || 100;
        this.playerMaxHp = p.maxHp || 100;
        this.playerMana = p.mana || 10;
        this.playerMaxMana = 10;

        // Cargar inventario guardado en la base de datos entre sesiones (con respaldo en localStorage)
        this.inventory.clear();
        let loadedInventory = p.inventory;
        if (!Array.isArray(loadedInventory) || loadedInventory.length === 0) {
          try {
            const cachedInv = localStorage.getItem(`atnight_inv_${this.currentCharacterName}`);
            if (cachedInv) loadedInventory = JSON.parse(cachedInv);
          } catch (_e) {}
        }

        if (Array.isArray(loadedInventory)) {
          loadedInventory.forEach((item: any) => {
            if (item && item.id) {
              this.inventory.set(item.id, item);
            }
          });
        }

        try {
          localStorage.setItem(`atnight_inv_${this.currentCharacterName}`, JSON.stringify(Array.from(this.inventory.values())));
        } catch (_e) {}

        this.renderInventoryHtml();

        if (typeof window !== 'undefined' && (window as any).characterStats) {
          const stats = (window as any).characterStats;
          stats.name = p.characterName || this.currentCharacterName;
          stats.level = this.playerLevel;
          stats.availablePoints = p.availablePoints || 0;
          if (p.elements) stats.elements = p.elements;
          if (p.specials) stats.specials = p.specials;
          if ((window as any).updateCaracteristicasUI) {
            (window as any).updateCaracteristicasUI();
          }
        }

        const hudName = document.getElementById('hud-player-name');
        if (hudName) hudName.innerText = p.characterName || this.currentCharacterName;

        this.applyCharacterAppearance(p);
        this.updateHud();
        console.log('✅ Personaje e inventario cargados desde la base de datos:', p.characterName, p.inventory?.length || 0, 'ítems');
      }
    } catch (err) {
      console.log('ℹ️ Operando en cliente local para el personaje:', this.currentCharacterName);
    }
  }

  private createGoldDropTexture() {
    if (this.textures.exists('gold')) {
      this.textures.remove('gold');
    }
    const g = this.make.graphics({ x: 0, y: 0 });
    // Anillo Exterior Plateado
    g.fillStyle(0xcbd5e1, 1);
    g.fillCircle(16, 16, 13);
    g.lineStyle(1.5, 0x475569, 1);
    g.strokeCircle(16, 16, 13);

    // Círculo Interior Concéntrico
    g.lineStyle(1.2, 0x64748b, 1);
    g.strokeCircle(16, 16, 9);

    // Fondo del símbolo de dinero
    g.fillStyle(0xf8fafc, 1);
    g.fillCircle(16, 16, 7.5);

    g.generateTexture('gold', 32, 32);
    g.destroy();
  }

  private applyCharacterAppearance(p: any) {
    if (!this.player || !p) return;
    const name = p.characterName || this.currentCharacterName;
    const cls = p.characterClass || 'arquero';
    const gender = p.gender || 'femenino';

    this.currentCharacterName = name;
    this.characterClass = cls;
    this.currentCharacterData = p;
    localStorage.setItem('atnight_active_char', name);
    localStorage.setItem('atnight_active_char_data', JSON.stringify(p));

    console.log(`🎨 Generando textura y apariencia dinámica para: ${name} (${cls}, ${gender})`);

    try {
      if (this.player.anims) this.player.anims.stop();
    } catch (_e) {}

    this.generateCustomPlayerTextures(p);

    // Actualizar textura del jugador en pantalla al instante
    const defaultFrame = `char-${name}-down-0`;
    const idleKey = `char-${name}-idle-down`;
    if (this.textures.exists(defaultFrame)) {
      this.player.setTexture(defaultFrame);
      if (this.anims.exists(idleKey)) {
        try {
          this.player.play(idleKey, true);
        } catch (_e) {}
      }
    }
  }

  private drawRotatedLimbSegment(
    graphics: Phaser.GameObjects.Graphics,
    px: number,
    py: number,
    w: number,
    startH: number,
    endH: number,
    angleRad: number,
    color: number
  ) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const halfW = w / 2;

    const x0 = px + (-halfW * cos - startH * sin);
    const y0 = py + (-halfW * sin + startH * cos);

    const x1 = px + (halfW * cos - startH * sin);
    const y1 = py + (halfW * sin + startH * cos);

    const x2 = px + (halfW * cos - endH * sin);
    const y2 = py + (halfW * sin + endH * cos);

    const x3 = px + (-halfW * cos - endH * sin);
    const y3 = py + (-halfW * sin + endH * cos);

    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(x0, y0);
    graphics.lineTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.lineTo(x3, y3);
    graphics.closePath();
    graphics.fillPath();
  }

  private generateCustomPlayerTextures(p: any) {
    const name = p.characterName || this.currentCharacterName;
    const cls = p.characterClass || 'espadachin';
    const gender = p.gender || 'masculino';
    const skinHex = parseInt((p.skinColor || '#f5c6a5').replace('#', ''), 16);
    const hairHex = parseInt((p.hairColor || '#451a03').replace('#', ''), 16);

    let baseOutfit = '#1d4ed8';
    if (cls === 'arquero') baseOutfit = '#16a34a';
    else if (cls === 'mago') baseOutfit = '#7e22ce';
    else if (cls === 'amigo_sol') baseOutfit = '#ea580c';
    else if (cls === 'amigo_luna') baseOutfit = '#0284c7';

    const outfitHex = parseInt((p.outfitColor || baseOutfit).replace('#', ''), 16);
    const isFemale = gender === 'femenino';

    const directions = ['down', 'up', 'right', 'left', 'down-right', 'down-left', 'up-right', 'up-left'];
    const graphics = this.make.graphics({ x: 0, y: 0 });

    directions.forEach(dir => {
      for (let frame = 0; frame < 4; frame++) {
        const texKey = `char-${name}-${dir}-${frame}`;
        if (this.textures.exists(texKey)) {
          this.textures.remove(texKey);
        }
        graphics.clear();

        if (cls === 'arquero' && isFemale) {
          // RENDERIZADOR DEDICADO EXCLUSIVO PARA LA ARQUERA FEMENINA (PROTAGONISTA)
          this.drawFemaleArcherCharacter(graphics, skinHex, hairHex, outfitHex, dir, frame);
        } else if (cls === 'arquero' && !isFemale) {
          // RENDERIZADOR DEDICADO EXCLUSIVO PARA EL ARQUERO MASCULINO (ELFO MANGA Y PANTALÓN LARGO)
          this.drawMaleArcherCharacter(graphics, skinHex, hairHex, outfitHex, dir, frame);
        } else if (cls === 'espadachin' && isFemale) {
          // RENDERIZADOR DEDICADO EXCLUSIVO PARA LA GUERRERA FEMENINA (ESPADACHÍN)
          this.drawFemaleWarriorCharacter(graphics, skinHex, hairHex, outfitHex, dir, frame);
        } else if (cls === 'espadachin' && !isFemale) {
          // RENDERIZADOR DEDICADO EXCLUSIVO PARA EL ESPADACHÍN MASCULINO (GUERRERO)
          this.drawMaleWarriorCharacter(graphics, skinHex, hairHex, outfitHex, dir, frame);
        } else if (cls === 'mago') {
          // RENDERIZADOR DEDICADO EXCLUSIVO PARA EL MAGO SABIO ANCIANO (TÚNICA & BÁCULO)
          this.drawWizardCharacter(graphics, skinHex, hairHex, outfitHex, isFemale, dir, frame);
        } else {
          // Renderizador base modular para otras combinaciones futuras
          this.drawGenericCharacter(graphics, skinHex, hairHex, outfitHex, cls, isFemale, dir, frame);
        }

        graphics.generateTexture(texKey, 64, 112);
      }
    });

    // Registrar animaciones personalizadas para la clave char-
    directions.forEach(d => {
      const walkKey = `char-${name}-walk-${d}`;
      const idleKey = `char-${name}-idle-${d}`;

      if (this.anims.exists(walkKey)) this.anims.remove(walkKey);
      if (this.anims.exists(idleKey)) this.anims.remove(idleKey);

      this.anims.create({
        key: walkKey,
        frames: [
          { key: `char-${name}-${d}-1` },
          { key: `char-${name}-${d}-2` },
          { key: `char-${name}-${d}-3` },
          { key: `char-${name}-${d}-0` }
        ],
        frameRate: 9,
        repeat: -1
      });

      this.anims.create({
        key: idleKey,
        frames: [{ key: `char-${name}-${d}-0` }],
        frameRate: 1,
        repeat: -1
      });
    });
  }

  // =========================================================================
  // 🧝‍♀️ RENDERIZADOR BLINDADO DEDICADO DE LA ARQUERA FEMENINA (DISEÑO DEFINITIVO)
  // =========================================================================
  private drawFemaleArcherCharacter(
    graphics: Phaser.GameObjects.Graphics,
    skinHex: number,
    hairHex: number,
    outfitHex: number,
    dir: string,
    frame: number
  ) {
    const isFrontOrBack = dir === 'down' || dir === 'up';
    const isSide = dir.includes('left') || dir.includes('right');
    const isLeft = dir.includes('left');

    let leftLegAngle = 0;
    let rightLegAngle = 0;
    let leftLegEndH = 36;
    let rightLegEndH = 36;

    let leftArmAngle = 0;
    let rightArmAngle = 0;
    let leftArmHMod = 0;
    let rightArmHMod = 0;

    if (isFrontOrBack) {
      if (frame === 1) {
        leftLegEndH = 38;
        rightLegEndH = 32;
        leftArmHMod = -2;
        rightArmHMod = 2;
      } else if (frame === 3) {
        leftLegEndH = 32;
        rightLegEndH = 38;
        leftArmHMod = 2;
        rightArmHMod = -2;
      }
    } else {
      if (frame === 1) {
        leftLegAngle = -0.25;
        rightLegAngle = 0.25;
        leftArmAngle = 0.28;
        rightArmAngle = -0.28;
      } else if (frame === 3) {
        leftLegAngle = 0.25;
        rightLegAngle = -0.25;
        leftArmAngle = -0.28;
        rightArmAngle = 0.28;
      }
    }

    // Sombra Base Proyectada
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(32, 86, 34, 10);

    // 1. Piernas y Botas (Articuladas desde la Cadera: hipY = 48)
    const legW = 5;
    const hipY = 48;

    if (isSide) {
      const backHipX = 32;
      const frontHipX = 32;
      const backAngle = isLeft ? -leftLegAngle : leftLegAngle;
      const frontAngle = isLeft ? -rightLegAngle : rightLegAngle;

      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW, 0, 22, backAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 2, 18, 34, backAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 3, 34, 38, backAngle, 0x1c1917);

      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW, 0, 22, frontAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 2, 18, 34, frontAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 4, 34, 38, frontAngle, 0x1c1917);
    } else {
      const leftHipX = 26;
      const rightHipX = 38;

      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW, 0, 22, leftLegAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 2, 18, leftLegEndH - 4, leftLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 3, leftLegEndH - 4, leftLegEndH, leftLegAngle, 0x1c1917);

      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW, 0, 22, rightLegAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 2, 18, rightLegEndH - 4, rightLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 3, rightLegEndH - 4, rightLegEndH, rightLegAngle, 0x1c1917);
    }

    // 2. Corset & Faldita de Cazadora
    graphics.fillStyle(outfitHex, 1);
    graphics.beginPath();
    graphics.moveTo(24, 28);
    graphics.lineTo(26, 42);
    graphics.lineTo(38, 42);
    graphics.lineTo(40, 28);
    graphics.closePath();
    graphics.fillPath();

    // Escote / Pechera Femenina (Solo en vista frontal/lateral)
    if (!dir.includes('up')) {
      graphics.fillStyle(skinHex, 1);
      graphics.fillTriangle(32, 35, 26, 28, 38, 28);
    }

    graphics.fillStyle(0x78350f, 1);
    graphics.beginPath();
    graphics.moveTo(25, 42);
    graphics.lineTo(21, 56);
    graphics.lineTo(43, 56);
    graphics.lineTo(39, 42);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0xfbbf24, 1);
    graphics.fillRect(25, 41, 14, 3);

    // 3. Carcaj de Flechas en Vistas Frontal/Lateral
    if (!dir.includes('up')) {
      this.drawElvenQuiverAndStrap(graphics, dir);
    }

    // 4. Cuello Anclado
    graphics.fillStyle(skinHex, 1);
    graphics.fillRect(29, 21, 6, 8);

    // 5. Brazos Adheridos al Torso
    const armW = 5;
    const shoulderY = 28;

    if (isSide) {
      const armX = 32;
      const armAngle = isLeft ? -leftArmAngle : leftArmAngle;
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW, 0, 20, armAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW + 1, 10, 17, armAngle, 0x78350f);
    } else {
      const leftShoulderX = 21;
      const rightShoulderX = 43;

      const armLeftEndH = 20 + leftArmHMod;
      const armRightEndH = 20 + rightArmHMod;

      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW, 0, armLeftEndH, leftArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW + 1, 10, 17, leftArmAngle, 0x78350f);

      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW, 0, armRightEndH, rightArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW + 1, 10, 17, rightArmAngle, 0x78350f);
    }

    // 6. Cabeza y Orejas Elfas (Visibles ÚNICAMENTE en Vista Frontal y Posterior)
    graphics.fillStyle(skinHex, 1);
    graphics.fillEllipse(32, 17, 17, 19);

    if (dir === 'down' || dir === 'up') {
      graphics.fillTriangle(20, 16, 14, 11, 22, 20);
      graphics.fillTriangle(44, 16, 50, 11, 42, 20);
    }

    if (dir === 'down' || dir.includes('down')) {
      graphics.fillStyle(0x27140a, 1);
      graphics.fillRect(25, 16, 4, 1.5); graphics.fillRect(35, 16, 4, 1.5);
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillRect(26, 18, 3, 3.5); graphics.fillRect(35, 18, 3, 3.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(27, 18, 1.5, 1.5); graphics.fillRect(36, 18, 1.5, 1.5);
    }

    // 7. Melena Larga Dinámica según la Dirección del Personaje
    graphics.fillStyle(hairHex, 1);
    graphics.fillEllipse(32, 12, 22, 11);

    if (dir === 'up' || dir === 'up-left' || dir === 'up-right') {
      graphics.fillEllipse(32, 24, 20, 24);
      graphics.fillRect(22, 14, 20, 22);
    } else if (dir === 'right' || dir === 'down-right') {
      graphics.beginPath();
      graphics.moveTo(18, 12);
      graphics.lineTo(24, 12);
      graphics.lineTo(34, 34);
      graphics.lineTo(26, 34);
      graphics.closePath();
      graphics.fillPath();
    } else if (dir === 'left' || dir === 'down-left') {
      graphics.beginPath();
      graphics.moveTo(46, 12);
      graphics.lineTo(40, 12);
      graphics.lineTo(30, 34);
      graphics.lineTo(38, 34);
      graphics.closePath();
      graphics.fillPath();
    } else {
      graphics.fillRect(18, 12, 5, 24);
      graphics.fillRect(39, 12, 5, 24);
    }

    // 8. Carcaj en Vista Posterior: Se dibuja SOBRE la cabeza y la espalda en vista trasera
    if (dir.includes('up')) {
      this.drawElvenQuiverAndStrap(graphics, dir);
    }
  }

  // =========================================================================
  // 🧝‍♂️ RENDERIZADOR BLINDADO DEDICADO DEL ARQUERO MASCULINO (ELFO DE MANGA Y PANTALÓN LARGO)
  // =========================================================================
  private drawMaleArcherCharacter(
    graphics: Phaser.GameObjects.Graphics,
    skinHex: number,
    hairHex: number,
    outfitHex: number,
    dir: string,
    frame: number
  ) {
    const isFrontOrBack = dir === 'down' || dir === 'up';
    const isSide = dir.includes('left') || dir.includes('right');
    const isLeft = dir.includes('left');

    let leftLegAngle = 0;
    let rightLegAngle = 0;
    let leftLegEndH = 36;
    let rightLegEndH = 36;

    let leftArmAngle = 0;
    let rightArmAngle = 0;
    let leftArmHMod = 0;
    let rightArmHMod = 0;

    if (isFrontOrBack) {
      if (frame === 1) {
        leftLegEndH = 38;
        rightLegEndH = 32;
        leftArmHMod = -2;
        rightArmHMod = 2;
      } else if (frame === 3) {
        leftLegEndH = 32;
        rightLegEndH = 38;
        leftArmHMod = 2;
        rightArmHMod = -2;
      }
    } else {
      if (frame === 1) {
        leftLegAngle = -0.25;
        rightLegAngle = 0.25;
        leftArmAngle = 0.28;
        rightArmAngle = -0.28;
      } else if (frame === 3) {
        leftLegAngle = 0.25;
        rightLegAngle = -0.25;
        leftArmAngle = -0.28;
        rightArmAngle = 0.28;
      }
    }

    // Sombra Base Proyectada
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(32, 86, 36, 10);

    // 1. Pantalones Largos y Botas del Elfo (Mismo color de ropa outfitHex para pantalones)
    const legW = 5;
    const hipY = 48;

    if (isSide) {
      const backHipX = 32;
      const frontHipX = 32;
      const backAngle = isLeft ? -leftLegAngle : leftLegAngle;
      const frontAngle = isLeft ? -rightLegAngle : rightLegAngle;

      // Pantalón largo de elfo (outfitHex) + Bota recortada (0x451a03) + Suela (0x1c1917)
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW, 0, 22, backAngle, outfitHex);
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 2, 18, 34, backAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 3, 34, 38, backAngle, 0x1c1917);

      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW, 0, 22, frontAngle, outfitHex);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 2, 18, 34, frontAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 4, 34, 38, frontAngle, 0x1c1917);
    } else {
      const leftHipX = 26;
      const rightHipX = 38;

      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW, 0, 22, leftLegAngle, outfitHex);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 2, 18, leftLegEndH - 4, leftLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 3, leftLegEndH - 4, leftLegEndH, leftLegAngle, 0x1c1917);

      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW, 0, 22, rightLegAngle, outfitHex);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 2, 18, rightLegEndH - 4, rightLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 3, rightLegEndH - 4, rightLegEndH, rightLegAngle, 0x1c1917);
    }

    // 2. Túnica Elfa de Manga Larga (Mismo grosor y altura estilizada)
    graphics.fillStyle(outfitHex, 1);
    graphics.beginPath();
    graphics.moveTo(24, 28);
    graphics.lineTo(26, 42);
    graphics.lineTo(38, 42);
    graphics.lineTo(40, 28);
    graphics.closePath();
    graphics.fillPath();

    // Pechera/Cuello de Túnica Elfa Noble (Solo en vista frontal/lateral)
    if (!dir.includes('up')) {
      graphics.fillStyle(skinHex, 1);
      graphics.fillTriangle(32, 33, 28, 28, 36, 28);
    }

    // Faldón de Túnica Elfa Masculina (Mismo color outfitHex)
    graphics.fillStyle(outfitHex, 1);
    graphics.beginPath();
    graphics.moveTo(25, 42);
    graphics.lineTo(22, 54);
    graphics.lineTo(42, 54);
    graphics.lineTo(39, 42);
    graphics.closePath();
    graphics.fillPath();

    // Cinturón Táctico Dorado de Arquero
    graphics.fillStyle(0xfbbf24, 1);
    graphics.fillRect(25, 41, 14, 3);

    // 3. Carcaj de Flechas en Vistas Frontal/Lateral
    if (!dir.includes('up')) {
      this.drawElvenQuiverAndStrap(graphics, dir);
    }

    // 4. Cuello Anclado Conectando Torso y Cabeza
    graphics.fillStyle(skinHex, 1);
    graphics.fillRect(29, 21, 6, 8);

    // 5. Brazos de Manga Larga (Mismo color outfitHex) + Guardabrazos de Cuero
    const armW = 5;
    const shoulderY = 28;

    if (isSide) {
      const armX = 32;
      const armAngle = isLeft ? -leftArmAngle : leftArmAngle;
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW, 0, 16, armAngle, outfitHex); // Manga larga
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW, 16, 20, armAngle, skinHex);   // Mano
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW + 1, 10, 17, armAngle, 0x78350f); // Guardabrazos
    } else {
      const leftShoulderX = 21;
      const rightShoulderX = 43;

      const armLeftEndH = 20 + leftArmHMod;
      const armRightEndH = 20 + rightArmHMod;

      // Brazo Izquierdo (Manga larga outfitHex)
      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW, 0, armLeftEndH - 4, leftArmAngle, outfitHex);
      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW, armLeftEndH - 4, armLeftEndH, leftArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW + 1, 10, 17, leftArmAngle, 0x78350f);

      // Brazo Derecho (Manga larga outfitHex)
      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW, 0, armRightEndH - 4, rightArmAngle, outfitHex);
      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW, armRightEndH - 4, armRightEndH, rightArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW + 1, 10, 17, rightArmAngle, 0x78350f);
    }

    // 6. Cabeza y Orejas Elfas Estilizadas (Visibles ÚNICAMENTE en Vista Frontal y Posterior)
    graphics.fillStyle(skinHex, 1);
    graphics.fillEllipse(32, 17, 17, 19);

    if (dir === 'down' || dir === 'up') {
      graphics.fillTriangle(20, 16, 14, 11, 22, 20); // Oreja Elfa Izquierda
      graphics.fillTriangle(44, 16, 50, 11, 42, 20); // Oreja Elfa Derecha
    }

    // Rostro Expresivo y Fino
    if (dir === 'down' || dir.includes('down')) {
      graphics.fillStyle(0x27140a, 1);
      graphics.fillRect(25, 16, 4, 1.5); graphics.fillRect(35, 16, 4, 1.5);
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillRect(26, 18, 3, 3.5); graphics.fillRect(35, 18, 3, 3.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(27, 18, 1.5, 1.5); graphics.fillRect(36, 18, 1.5, 1.5);
    }

    // 7. Cabello Corto Elfo Dinámico según la Orientación (8 Direcciones)
    graphics.fillStyle(hairHex, 1);
    if (dir === 'up' || dir === 'up-left' || dir === 'up-right') {
      // VISTA POSTERIOR (Corte elfo limpio en la nuca)
      graphics.fillEllipse(32, 14, 20, 12);
      graphics.fillRect(24, 14, 16, 8);
    } else if (dir === 'right' || dir === 'down-right') {
      // GIRO A LA DERECHA (Peinado estilizado a la derecha con flequillo)
      graphics.fillEllipse(32, 13, 20, 11);
      graphics.beginPath();
      graphics.moveTo(22, 12);
      graphics.lineTo(38, 12);
      graphics.lineTo(36, 21);
      graphics.lineTo(26, 18);
      graphics.closePath();
      graphics.fillPath();
    } else if (dir === 'left' || dir === 'down-left') {
      // GIRO A LA IZQUIERDA (Peinado estilizado a la izquierda con flequillo)
      graphics.fillEllipse(32, 13, 20, 11);
      graphics.beginPath();
      graphics.moveTo(42, 12);
      graphics.lineTo(26, 12);
      graphics.lineTo(28, 21);
      graphics.lineTo(38, 18);
      graphics.closePath();
      graphics.fillPath();
    } else {
      // VISTA FRONTAL (Corte noble elfo con flequillo perfilado)
      graphics.fillEllipse(32, 13, 22, 11);
      graphics.beginPath();
      graphics.moveTo(22, 12);
      graphics.lineTo(34, 12);
      graphics.lineTo(28, 20);
      graphics.closePath();
      graphics.fillPath();
    }

    // 8. Carcaj en Vista Posterior: Se dibuja SOBRE la cabeza y la espalda en vista trasera
    if (dir.includes('up')) {
      this.drawElvenQuiverAndStrap(graphics, dir);
    }
  }

  // =========================================================================
  // ⚔️ RENDERIZADOR BLINDADO DEDICADO DE LA GUERRERA FEMENINA (ESPADACHÍN)
  // =========================================================================
  private drawFemaleWarriorCharacter(
    graphics: Phaser.GameObjects.Graphics,
    skinHex: number,
    hairHex: number,
    outfitHex: number,
    dir: string,
    frame: number
  ) {
    const isFrontOrBack = dir === 'down' || dir === 'up';
    const isPureSide = dir === 'left' || dir === 'right';
    const isDiagonal = dir.includes('up-') || dir.includes('down-');
    const isSide = isPureSide || isDiagonal;
    const isLeft = dir.includes('left');

    let leftLegAngle = 0;
    let rightLegAngle = 0;
    let leftLegEndH = 31; // Estatura recortada 3px (31px en lugar de 34px)
    let rightLegEndH = 31;

    let leftArmAngle = 0;
    let rightArmAngle = 0;
    let leftArmHMod = 0;
    let rightArmHMod = 0;

    if (isFrontOrBack) {
      if (frame === 1) {
        leftLegEndH = 33;
        rightLegEndH = 27;
        leftArmHMod = -2;
        rightArmHMod = 2;
      } else if (frame === 3) {
        leftLegEndH = 27;
        rightLegEndH = 33;
        leftArmHMod = 2;
        rightArmHMod = -2;
      }
    } else {
      if (frame === 1) {
        leftLegAngle = -0.24;
        rightLegAngle = 0.24;
        leftArmAngle = 0.26;
        rightArmAngle = -0.26;
      } else if (frame === 3) {
        leftLegAngle = 0.24;
        rightLegAngle = -0.24;
        leftArmAngle = -0.26;
        rightArmAngle = 0.26;
      }
    }

    // Sombra Base Proyectada Anclada 3px más arriba (Asentada perfectamente sin flotar)
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(32, 83, 38, 10);

    // 1. Piernas Fornidas 3px más cortas (Piel hasta h=15, bota h=11 a h=29, suela h=29 a h=33)
    const legW = 6;
    const hipY = 48;

    if (isSide) {
      const backHipX = 32;
      const frontHipX = 32;
      const backAngle = isLeft ? -leftLegAngle : leftLegAngle;
      const frontAngle = isLeft ? -rightLegAngle : rightLegAngle;

      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW, 0, 15, backAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 2, 11, 29, backAngle, 0x451a03); // Bota de cuero
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 3, 29, 33, backAngle, 0x1c1917); // Suela acero

      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW, 0, 15, frontAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 2, 11, 29, frontAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 4, 29, 33, frontAngle, 0x1c1917);
    } else {
      const leftHipX = 26;
      const rightHipX = 38;

      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW, 0, 15, leftLegAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 2, 11, leftLegEndH - 4, leftLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 3, leftLegEndH - 4, leftLegEndH, leftLegAngle, 0x1c1917);

      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW, 0, 15, rightLegAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 2, 11, rightLegEndH - 4, rightLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 3, rightLegEndH - 4, rightLegEndH, rightLegAngle, 0x1c1917);
    }

    // 2. Coraza de Cuero Fornida + Cota de Malla en Pecho y Espalda
    if (isPureSide) {
      // VISTA DE PERFIL PURO: +5px más grueso que el anterior (Profundidad = 17px: x=23.5 a x=40.5)
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRect(23.5, 28, 17, 16);

      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(25, 30, 2, 2); graphics.fillRect(29, 30, 2, 2); graphics.fillRect(33, 30, 2, 2); graphics.fillRect(37, 30, 2, 2);
      graphics.fillRect(27, 33, 2, 2); graphics.fillRect(31, 33, 2, 2); graphics.fillRect(35, 33, 2, 2);

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(23.5, 28);
      graphics.lineTo(25.5, 42); // Cintura 13px
      graphics.lineTo(38.5, 42);
      graphics.lineTo(40.5, 28);
      graphics.closePath();
      graphics.fillPath();

      const cupX = isLeft ? 28 : 36;
      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillCircle(cupX, 33, 4.8);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(cupX - (isLeft ? 1 : -1), 31, 1.5);

      // Falda en perfil puro
      graphics.fillStyle(0x451a03, 1);
      graphics.beginPath();
      graphics.moveTo(25, 42);
      graphics.lineTo(21, 62);
      graphics.lineTo(43, 62);
      graphics.lineTo(39, 42);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(23, 44, 4, 17);
      graphics.fillRect(29, 44, 4, 18);
      graphics.fillRect(35, 44, 4, 17);

      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(24, 59, 2, 2); graphics.fillRect(30, 60, 2, 2); graphics.fillRect(36, 59, 2, 2);

      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(25, 41, 14, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(30, 40, 4, 5);

    } else if (isDiagonal) {
      // VISTAS DIAGONALES (arriba/abajo a derecha/izquierda): Reducido 7px (Ancho estilizado = 20px: x=22 a x=42)
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRect(22, 28, 20, 16);

      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(24, 30, 2, 2); graphics.fillRect(28, 30, 2, 2); graphics.fillRect(32, 30, 2, 2); graphics.fillRect(36, 30, 2, 2); graphics.fillRect(40, 30, 2, 2);
      graphics.fillRect(26, 33, 2, 2); graphics.fillRect(30, 33, 2, 2); graphics.fillRect(34, 33, 2, 2); graphics.fillRect(38, 33, 2, 2);

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(22, 28);
      graphics.lineTo(24, 42); // Cintura curva 16px en diagonal
      graphics.lineTo(40, 42);
      graphics.lineTo(42, 28);
      graphics.closePath();
      graphics.fillPath();

      if (!dir.includes('up')) {
        // 2 Copas esculpidas en perspectiva diagonal ajustada
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillCircle(27, 33, 4.8);
        graphics.fillCircle(37, 33, 4.8);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(26, 31, 1.6);
        graphics.fillCircle(36, 31, 1.6);
      } else {
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillRect(25, 30, 14, 10);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(26, 31, 12, 2);
      }

      // Falda en vistas diagonales estilizada
      graphics.fillStyle(0x451a03, 1);
      graphics.beginPath();
      graphics.moveTo(22, 42);
      graphics.lineTo(18, 63);
      graphics.lineTo(46, 63);
      graphics.lineTo(42, 42);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(20, 44, 4, 18);
      graphics.fillRect(26, 44, 4, 19);
      graphics.fillRect(32, 44, 4, 19);
      graphics.fillRect(38, 44, 4, 18);

      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(21, 60, 2, 2); graphics.fillRect(27, 61, 2, 2); graphics.fillRect(33, 61, 2, 2); graphics.fillRect(39, 60, 2, 2);

      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(22, 41, 20, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(30, 40, 4, 5);

    } else {
      // VISTAS FRONTAL Y POSTERIOR: Ancho completo (24px: x=20 a x=44)
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRect(20, 28, 24, 16);

      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(22, 30, 2, 2); graphics.fillRect(26, 30, 2, 2); graphics.fillRect(30, 30, 2, 2); graphics.fillRect(34, 30, 2, 2); graphics.fillRect(38, 30, 2, 2); graphics.fillRect(42, 30, 2, 2);
      graphics.fillRect(24, 33, 2, 2); graphics.fillRect(28, 33, 2, 2); graphics.fillRect(32, 33, 2, 2); graphics.fillRect(36, 33, 2, 2); graphics.fillRect(40, 33, 2, 2);

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(20, 28);
      graphics.lineTo(24, 42);
      graphics.lineTo(40, 42);
      graphics.lineTo(44, 28);
      graphics.closePath();
      graphics.fillPath();

      if (!dir.includes('up')) {
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillCircle(26, 33, 5.5);
        graphics.fillCircle(38, 33, 5.5);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(25, 31, 2);
        graphics.fillCircle(37, 31, 2);
      } else {
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillRect(25, 30, 14, 10);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(26, 31, 12, 2);
      }

      graphics.fillStyle(0x451a03, 1);
      graphics.beginPath();
      graphics.moveTo(23, 42);
      graphics.lineTo(18, 64);
      graphics.lineTo(46, 64);
      graphics.lineTo(41, 42);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(20, 44, 4, 18);
      graphics.fillRect(26, 44, 4, 19);
      graphics.fillRect(32, 44, 4, 19);
      graphics.fillRect(38, 44, 4, 18);

      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(21, 60, 2, 2); graphics.fillRect(27, 61, 2, 2); graphics.fillRect(33, 61, 2, 2); graphics.fillRect(39, 60, 2, 2);

      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(23, 41, 18, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(30, 40, 4, 5);
    }

    // 5. Cuello Anclado Conectando Torso y Cabeza
    graphics.fillStyle(skinHex, 1);
    graphics.fillRect(29, 21, 6, 8);

    // 6. Brazos Atléticos con Guardabrazos de Acero (Pivote shoulderY = 28)
    const armW = 5;
    const shoulderY = 28;

    if (isPureSide) {
      const armX = 32;
      const armAngle = isLeft ? -leftArmAngle : leftArmAngle;
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW, 0, 18, armAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW + 1, 8, 16, armAngle, 0x94a3b8);

      // Hombrera de Acero en Perfil Puro (x=32)
      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillCircle(32, 27, 4.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(31, 25.5, 1.5);
    } else if (isDiagonal) {
      const mainShoulderX = isLeft ? 24 : 40;
      const subShoulderX = isLeft ? 42 : 22;
      const armAngle = isLeft ? -leftArmAngle : leftArmAngle;

      this.drawRotatedLimbSegment(graphics, mainShoulderX, shoulderY, armW, 0, 18, armAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, mainShoulderX, shoulderY, armW + 1, 8, 16, armAngle, 0x94a3b8);

      // Hombrera principal en diagonal
      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillCircle(mainShoulderX, 27, 4.5);
      graphics.fillCircle(subShoulderX, 27, 3.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(mainShoulderX - (isLeft ? 1 : -1), 25.5, 1.5);
    } else {
      const leftShoulderX = 20;
      const rightShoulderX = 44;

      const armLeftEndH = 18 + leftArmHMod;
      const armRightEndH = 18 + rightArmHMod;

      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW, 0, armLeftEndH, leftArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW + 1, 8, 16, leftArmAngle, 0x94a3b8);

      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW, 0, armRightEndH, rightArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW + 1, 8, 16, rightArmAngle, 0x94a3b8);

      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillCircle(20, 27, 4);
      graphics.fillCircle(44, 27, 4);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(19, 25.5, 1.5);
      graphics.fillCircle(43, 25.5, 1.5);
    }

    // 7. Cabeza Humana con Orejas Pequeñas Pegadas (SOLO en vistas Frontal y Posterior)
    graphics.fillStyle(skinHex, 1);
    graphics.fillEllipse(32, 17, 18, 20);

    // Orejas Normales Humanas Pequeñas y Pegadas a la Cabeza (Visibles ÚNICAMENTE en Vista Frontal y Posterior)
    if (isFrontOrBack) {
      graphics.fillCircle(22.5, 18, 1.8);
      graphics.fillCircle(41.5, 18, 1.8);
    }

    // Rostro Noble e Intenso de Guerrera
    if (dir === 'down' || dir.includes('down')) {
      graphics.fillStyle(0x27140a, 1);
      graphics.fillRect(25, 15, 4, 1.8); graphics.fillRect(35, 15, 4, 1.8); // Cejas marcadas de guerrera
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillRect(26, 18, 3, 3.5); graphics.fillRect(35, 18, 3, 3.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(27, 18, 1.5, 1.5); graphics.fillRect(36, 18, 1.5, 1.5);
    }

    // 8. Cabello Trenzado 3D Dinámico según la Orientación
    graphics.fillStyle(hairHex, 1);
    graphics.fillEllipse(32, 12, 22, 11);

    if (dir === 'up' || dir === 'up-left' || dir === 'up-right') {
      // ESPALDA: Trenza guerrera gruesa cayendo por el centro de la espalda
      graphics.fillRect(30, 16, 4, 28);
      // Eslabones de la trenza
      graphics.fillStyle(0x27140a, 0.4);
      graphics.fillCircle(32, 20, 2.5); graphics.fillCircle(32, 26, 2.5); graphics.fillCircle(32, 32, 2.5); graphics.fillCircle(32, 38, 2.5);
      // Cuenta de oro de la trenza
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(30, 42, 4, 3);
    } else if (dir === 'right' || dir === 'down-right') {
      // DERECHA: Trenza sobre el hombro izquierdo inclinada
      graphics.beginPath();
      graphics.moveTo(22, 14);
      graphics.lineTo(26, 14);
      graphics.lineTo(32, 34);
      graphics.lineTo(28, 34);
      graphics.closePath();
      graphics.fillPath();
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(28, 33, 4, 3);
    } else if (dir === 'left' || dir === 'down-left') {
      // IZQUIERDA: Trenza sobre el hombro derecho inclinada
      graphics.beginPath();
      graphics.moveTo(42, 14);
      graphics.lineTo(38, 14);
      graphics.lineTo(32, 34);
      graphics.lineTo(36, 34);
      graphics.closePath();
      graphics.fillPath();
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(32, 33, 4, 3);
    } else {
      // FRONTAL: Trenza de guerrera cayendo por el frente sobre un lado del pecho
      graphics.beginPath();
      graphics.moveTo(22, 14);
      graphics.lineTo(26, 14);
      graphics.lineTo(28, 36);
      graphics.lineTo(24, 36);
      graphics.closePath();
      graphics.fillPath();
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(24, 35, 4, 3);
    }
  }

  // =========================================================================
  // ⚔️ RENDERIZADOR BLINDADO DEDICADO DEL ESPADACHÍN MASCULINO (GUERRERO)
  // =========================================================================
  private drawMaleWarriorCharacter(
    graphics: Phaser.GameObjects.Graphics,
    skinHex: number,
    hairHex: number,
    outfitHex: number,
    dir: string,
    frame: number
  ) {
    const isFrontOrBack = dir === 'down' || dir === 'up';
    const isPureSide = dir === 'left' || dir === 'right';
    const isDiagonal = dir.includes('up-') || dir.includes('down-');
    const isSide = isPureSide || isDiagonal;
    const isLeft = dir.includes('left');

    let leftLegAngle = 0;
    let rightLegAngle = 0;
    let leftLegEndH = 31;
    let rightLegEndH = 31;

    let leftArmAngle = 0;
    let rightArmAngle = 0;
    let leftArmHMod = 0;
    let rightArmHMod = 0;

    if (isFrontOrBack) {
      if (frame === 1) {
        leftLegEndH = 33;
        rightLegEndH = 27;
        leftArmHMod = -2;
        rightArmHMod = 2;
      } else if (frame === 3) {
        leftLegEndH = 27;
        rightLegEndH = 33;
        leftArmHMod = 2;
        rightArmHMod = -2;
      }
    } else {
      if (frame === 1) {
        leftLegAngle = -0.24;
        rightLegAngle = 0.24;
        leftArmAngle = 0.26;
        rightArmAngle = -0.26;
      } else if (frame === 3) {
        leftLegAngle = 0.24;
        rightLegAngle = -0.24;
        leftArmAngle = -0.26;
        rightArmAngle = 0.26;
      }
    }

    // Sombra Base Proyectada Robustos (y = 83, sin flotar)
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(32, 83, 42, 11);

    // 1. Pantalones de Cuero de Guerrero Robustos (0x451a03 / outfitHex) + Botas de Cuero
    const legW = 7;
    const hipY = 48;

    if (isSide) {
      const backHipX = 32;
      const frontHipX = 32;
      const backAngle = isLeft ? -leftLegAngle : leftLegAngle;
      const frontAngle = isLeft ? -rightLegAngle : rightLegAngle;

      // Pantalones de cuero ajustados y robustos (h=0 a h=20)
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 1, 0, 20, backAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 2, 16, 29, backAngle, 0x1c1917); // Bota de guerrero
      this.drawRotatedLimbSegment(graphics, backHipX, hipY, legW + 3, 29, 33, backAngle, 0x64748b); // Suela/Refuerzo de acero

      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 1, 0, 20, frontAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 2, 16, 29, frontAngle, 0x1c1917);
      this.drawRotatedLimbSegment(graphics, frontHipX, hipY, legW + 4, 29, 33, frontAngle, 0x64748b);
    } else {
      const leftHipX = 25;
      const rightHipX = 39;

      // Pantalones de cuero ajustados robustos (h=0 a h=20)
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 1, 0, 18, leftLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 2, 14, leftLegEndH - 4, leftLegAngle, 0x1c1917);
      this.drawRotatedLimbSegment(graphics, leftHipX, hipY, legW + 3, leftLegEndH - 4, leftLegEndH, leftLegAngle, 0x64748b);

      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 1, 0, 18, rightLegAngle, 0x451a03);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 2, 14, rightLegEndH - 4, rightLegAngle, 0x1c1917);
      this.drawRotatedLimbSegment(graphics, rightHipX, hipY, legW + 3, rightLegEndH - 4, rightLegEndH, rightLegAngle, 0x64748b);
    }

    // 2. Peto / Armadura de Pecho de Acero Esculpida V-Taper Musculosa y Robusta + Cota de Malla
    if (isPureSide) {
      // PERFIL PURO ROBUSTO (19px de profundidad: x=22.5 a x=41.5)
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRect(22.5, 27, 19, 16);

      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(24, 29, 2, 2); graphics.fillRect(28, 29, 2, 2); graphics.fillRect(32, 29, 2, 2); graphics.fillRect(36, 29, 2, 2); graphics.fillRect(40, 29, 2, 2);

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(22.5, 27);
      graphics.lineTo(24.5, 42);
      graphics.lineTo(39.5, 42);
      graphics.lineTo(41.5, 27);
      graphics.closePath();
      graphics.fillPath();

      // Placa de Pecho Grande de Acero Musculosa en perfil
      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillRect(isLeft ? 23 : 33, 29, 8, 10);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(isLeft ? 24 : 34, 30, 6, 2);

      // Faldón corto táctico de cuero sobre pantalones
      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(24, 42, 16, 6);
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(24, 41, 16, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(30, 40, 4, 5);

    } else if (isDiagonal) {
      // VISTAS DIAGONALES ROBUSTAS (23px de ancho: x=20.5 a x=43.5)
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRect(20.5, 27, 23, 16);

      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(22, 29, 2, 2); graphics.fillRect(26, 29, 2, 2); graphics.fillRect(30, 29, 2, 2); graphics.fillRect(34, 29, 2, 2); graphics.fillRect(38, 29, 2, 2); graphics.fillRect(42, 29, 2, 2);

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(20.5, 27);
      graphics.lineTo(23, 42);
      graphics.lineTo(41, 42);
      graphics.lineTo(43.5, 27);
      graphics.closePath();
      graphics.fillPath();

      if (!dir.includes('up')) {
        // Gran Placa de Peto de Acero de Guerrero Robusto Esculpida en diagonal
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillRect(22.5, 29, 19, 10);
        graphics.fillStyle(0xe2e8f0, 1);
        graphics.fillRect(23.5, 30, 17, 8);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(24.5, 30, 15, 2);
        // División pectoral esculpida
        graphics.fillStyle(0x64748b, 1);
        graphics.fillRect(31.5, 30, 1, 8);
      } else {
        // Espaldar metálico en diagonal
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillRect(23.5, 29, 17, 10);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(24.5, 30, 15, 2);
      }

      // Faldón de túnica corta sobre pantalones de cuero
      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(22, 42, 20, 6);
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(21, 41, 22, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(30, 40, 4, 5);

    } else {
      // VISTA FRONTAL Y POSTERIOR ROBUSTA V-TAPER (26px de hombros x=19..45 tapering a 20px de cintura x=22..42)
      graphics.fillStyle(0x94a3b8, 1);
      graphics.fillRect(19, 27, 26, 16);

      graphics.fillStyle(0x64748b, 1);
      graphics.fillRect(21, 29, 2, 2); graphics.fillRect(25, 29, 2, 2); graphics.fillRect(29, 29, 2, 2); graphics.fillRect(33, 29, 2, 2); graphics.fillRect(37, 29, 2, 2); graphics.fillRect(41, 29, 2, 2);

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(19, 27);
      graphics.lineTo(22, 42); // Cintura firme atletica 20px
      graphics.lineTo(42, 42);
      graphics.lineTo(45, 27);
      graphics.closePath();
      graphics.fillPath();

      if (!dir.includes('up')) {
        // Gran Placa de Peto de Acero Esculpida con Pectorales Musculosos de Guerrero (Frontal)
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillRect(21, 29, 22, 10);
        graphics.fillStyle(0xe2e8f0, 1);
        graphics.fillRect(22, 30, 20, 8);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(23, 30, 18, 2);
        // Línea media pectoral musculosa esculpida
        graphics.fillStyle(0x475569, 1);
        graphics.fillRect(31.5, 30, 1, 8);
        // Reborde/Bisel del peto
        graphics.fillStyle(0x64748b, 1);
        graphics.fillRect(21, 38, 22, 1);
      } else {
        // Placa de Espaldar de Acero de Guerrero (Posterior)
        graphics.fillStyle(0xcbd5e1, 1);
        graphics.fillRect(23, 29, 18, 10);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(24, 30, 16, 2);
      }

      // Faldón táctico corto de cuero sobre pantalones
      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(21, 42, 22, 6);
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(21, 41, 22, 3);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(30, 40, 4, 5);
    }

    // 3. Cuello Robusto Anclado Conectando Torso y Cabeza
    graphics.fillStyle(skinHex, 1);
    graphics.fillRect(28, 20, 8, 8);

    // 4. Brazos Musculosos Masculinos con Guardabrazos de Acero (Pivote shoulderY = 27)
    const armW = 6;
    const shoulderY = 27;

    if (isPureSide) {
      const armX = 32;
      const armAngle = isLeft ? -leftArmAngle : leftArmAngle;
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW, 0, 18, armAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, armX, shoulderY, armW + 1, 8, 16, armAngle, 0x94a3b8);

      // Hombrera de Acero Angosta Verticalmente y Pegada Arriba al Hombro
      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillEllipse(32, 26, 11, 6.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillEllipse(31, 25, 6, 3);
    } else if (isDiagonal) {
      const mainShoulderX = isLeft ? 22 : 42;
      const subShoulderX = isLeft ? 44 : 20;
      const armAngle = isLeft ? -leftArmAngle : leftArmAngle;

      this.drawRotatedLimbSegment(graphics, mainShoulderX, shoulderY, armW, 0, 18, armAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, mainShoulderX, shoulderY, armW + 1, 8, 16, armAngle, 0x94a3b8);

      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillEllipse(mainShoulderX, 26, 11, 6.5);
      graphics.fillEllipse(subShoulderX, 26, 8, 5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillEllipse(mainShoulderX - (isLeft ? 1 : -1), 25, 6, 3);
    } else {
      const leftShoulderX = 18;
      const rightShoulderX = 46;

      const armLeftEndH = 18 + leftArmHMod;
      const armRightEndH = 18 + rightArmHMod;

      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW, 0, armLeftEndH, leftArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, leftShoulderX, shoulderY, armW + 1, 8, 16, leftArmAngle, 0x94a3b8);

      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW, 0, armRightEndH, rightArmAngle, skinHex);
      this.drawRotatedLimbSegment(graphics, rightShoulderX, shoulderY, armW + 1, 8, 16, rightArmAngle, 0x94a3b8);

      // Hombreras de Acero Angostas Verticalmente y Pegadas Arriba a los Hombros
      graphics.fillStyle(0xcbd5e1, 1);
      graphics.fillEllipse(18, 26, 11, 6.5);
      graphics.fillEllipse(46, 26, 11, 6.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillEllipse(17, 25, 6, 3);
      graphics.fillEllipse(45, 25, 6, 3);
    }

    // 5. Cabeza Humana con Orejas Pequeñas Pegadas (Visibles ÚNICAMENTE en Vista Frontal y Posterior)
    graphics.fillStyle(skinHex, 1);
    graphics.fillEllipse(32, 17, 18, 20);

    if (isFrontOrBack) {
      graphics.fillCircle(22.5, 18, 1.8);
      graphics.fillCircle(41.5, 18, 1.8);
    }

    // Rostro Firme e Intenso de Guerrero Masculino
    if (dir === 'down' || dir.includes('down')) {
      graphics.fillStyle(0x27140a, 1);
      graphics.fillRect(25, 15, 4, 1.8); graphics.fillRect(35, 15, 4, 1.8); // Cejas rectas de guerrero
      graphics.fillStyle(0x0f172a, 1);
      graphics.fillRect(26, 18, 3, 3.5); graphics.fillRect(35, 18, 3, 3.5);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(27, 18, 1.5, 1.5); graphics.fillRect(36, 18, 1.5, 1.5);
    }

    // 6. Cabello Parado Hacia Arriba Mochado de Tajo como una Meseta (Flat Top Plateau Cut)
    graphics.fillStyle(hairHex, 1);

    if (isFrontOrBack) {
      // FRONTAL Y POSTERIOR: Bloque rectangular vertical elevado y cortado recto en meseta arriba
      graphics.fillRect(22, 4, 20, 11); // Meseta principal
      graphics.fillRect(23, 2, 18, 2);  // Plano superior horizontal mochado de tajo
      // Patillas masculinas limpias
      graphics.fillRect(21, 10, 2, 6);
      graphics.fillRect(41, 10, 2, 6);
    } else if (isPureSide) {
      // PERFIL PURO: Meseta inclinada limpiamente
      const px = isLeft ? 23 : 25;
      graphics.fillRect(px, 4, 16, 11);
      graphics.fillRect(px + 1, 2, 14, 2);
      graphics.fillRect(isLeft ? 22 : 38, 10, 2, 6); // Patilla
    } else {
      // VISTAS DIAGONALES: Meseta en perspectiva 3D
      const px = isLeft ? 22 : 24;
      graphics.fillRect(px, 4, 18, 11);
      graphics.fillRect(px + 1, 2, 16, 2);
      graphics.fillRect(isLeft ? 21 : 40, 10, 2, 6); // Patilla
    }
  }

  // =========================================================================
  // 🔮 RENDERIZADOR BLINDADO DEDICADO DEL MAGO SABIO ANCIANO (TÚNICA & BÁCULO)
  // =========================================================================
  private drawWizardCharacter(
    graphics: Phaser.GameObjects.Graphics,
    skinHex: number,
    hairHex: number,
    outfitHex: number,
    isFemale: boolean,
    dir: string,
    frame: number
  ) {
    const isFrontOrBack = dir === 'down' || dir === 'up';
    const isPureSide = dir === 'left' || dir === 'right';
    const isDiagonal = dir.includes('up-') || dir.includes('down-');
    const isSide = isPureSide || isDiagonal;
    const isLeft = dir.includes('left');

    let leftArmAngle = 0;
    let rightArmAngle = 0;
    let robeSway = 0;

    if (isFrontOrBack) {
      if (frame === 1) robeSway = -1.5;
      else if (frame === 3) robeSway = 1.5;
    } else {
      if (frame === 1) {
        leftArmAngle = 0.22;
        rightArmAngle = -0.22;
        robeSway = -2;
      } else if (frame === 3) {
        leftArmAngle = -0.22;
        rightArmAngle = 0.22;
        robeSway = 2;
      }
    }

    // Sombra Base Proyectada Bajo la Túnica (y = 83)
    graphics.fillStyle(0x000000, 0.38);
    graphics.fillEllipse(32, 83, 44, 12);

    // 1. Zapatos / Pies bajo el dobladillo de la túnica (y = 74..79)
    graphics.fillStyle(0x1c1917, 1);
    if (isSide) {
      this.drawRotatedLimbSegment(graphics, 32, 60, 6, 12, 20, isLeft ? -leftArmAngle * 0.5 : leftArmAngle * 0.5, 0x1c1917);
    } else {
      graphics.fillRect(25, 74, 5, 5);
      graphics.fillRect(34, 74, 5, 5);
    }

    // 2. Túnica Orgánica Mística de Mago (Forma Fluida no rectangular)
    // Fondo/Pliegues Oscuros de la Túnica
    graphics.fillStyle(0x0f172a, 1);

    if (isPureSide) {
      // PERFIL PURO: Túnica fluida de 19px de ancho
      graphics.beginPath();
      graphics.moveTo(23, 27);
      graphics.lineTo(21 + robeSway, 76);
      graphics.lineTo(43 + robeSway, 76);
      graphics.lineTo(41, 27);
      graphics.closePath();
      graphics.fillPath();

      // Capa exterior de la túnica (outfitHex)
      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(24, 27);
      graphics.lineTo(22 + robeSway, 50);
      graphics.lineTo(23 + robeSway, 75);
      graphics.lineTo(41 + robeSway, 75);
      graphics.lineTo(42 + robeSway, 50);
      graphics.lineTo(40, 27);
      graphics.closePath();
      graphics.fillPath();

    } else if (isDiagonal) {
      // DIAGONAL: Túnica fluida 3D de 23px de ancho
      graphics.beginPath();
      graphics.moveTo(20.5, 27);
      graphics.lineTo(18.5 + robeSway, 76);
      graphics.lineTo(45.5 + robeSway, 76);
      graphics.lineTo(43.5, 27);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(21.5, 27);
      graphics.lineTo(19.5 + robeSway, 50);
      graphics.lineTo(20.5 + robeSway, 75);
      graphics.lineTo(43.5 + robeSway, 75);
      graphics.lineTo(44.5 + robeSway, 50);
      graphics.lineTo(42.5, 27);
      graphics.closePath();
      graphics.fillPath();

    } else {
      // FRONTAL Y POSTERIOR: Túnica Orgánica Completa de 26px de ancho con pliegues
      graphics.beginPath();
      graphics.moveTo(19, 27);
      graphics.lineTo(16 + robeSway, 76);
      graphics.lineTo(48 + robeSway, 76);
      graphics.lineTo(45, 27);
      graphics.closePath();
      graphics.fillPath();

      graphics.fillStyle(outfitHex, 1);
      graphics.beginPath();
      graphics.moveTo(20, 27);
      graphics.lineTo(17 + robeSway, 50);
      graphics.lineTo(18 + robeSway, 75);
      graphics.lineTo(46 + robeSway, 75);
      graphics.lineTo(47 + robeSway, 50);
      graphics.lineTo(44, 27);
      graphics.closePath();
      graphics.fillPath();

      // Pliegues místicos de la túnica en frontal
      if (!dir.includes('up')) {
        graphics.fillStyle(0x0f172a, 0.4);
        graphics.beginPath();
        graphics.moveTo(32, 42);
        graphics.lineTo(26 + robeSway, 75);
        graphics.lineTo(38 + robeSway, 75);
        graphics.closePath();
        graphics.fillPath();
      }
    }

    // Cinturón Rúnico Dorado con Hebilla Mística
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(isPureSide ? 24 : 21, 41, isPureSide ? 16 : 22, 4);
    graphics.fillStyle(0xfbbf24, 1);
    graphics.fillRect(29, 40, 6, 6);
    graphics.fillStyle(0x38bdf8, 1); // Gema central azul arcano
    graphics.fillCircle(32, 43, 1.8);

    // Manto / Capa Superior de los Hombros
    graphics.fillStyle(0x1e1b4b, 1);
    graphics.beginPath();
    graphics.moveTo(isPureSide ? 23 : 19, 27);
    graphics.lineTo(isPureSide ? 21 : 17, 36);
    graphics.lineTo(isPureSide ? 41 : 47, 36);
    graphics.lineTo(isPureSide ? 39 : 45, 27);
    graphics.closePath();
    graphics.fillPath();

    // Borde rúnico dorado del manto
    graphics.fillStyle(0xfbbf24, 1);
    graphics.fillRect(isPureSide ? 21 : 17, 35, isPureSide ? 20 : 30, 2);

    // 3. Cuello de Mago
    graphics.fillStyle(skinHex, 1);
    graphics.fillRect(29, 20, 6, 8);

    // 4. Mangas Anchas de Campana, Brazo y Báculo Mágico en Perspectiva 3D
    const shoulderY = 27;
    const isBackView = dir === 'up' || dir.includes('up');
    const isFrontView = dir === 'down' || dir.includes('down');

    // El báculo es sostenido por el brazo según la perspectiva 3D:
    // En vista frontal (down) y frontales diagonales (down-left, down-right) -> Brazo Derecho en pantalla (staffX = 44)
    // En perfil puro a la izquierda (left) -> Brazo Izquierdo (staffX = 20)
    // En vista posterior de espalda (up, up-left) -> Pantalla Izquierda (staffX = 18)
    let staffX = 44;
    if (dir === 'left') {
      staffX = 20;
    } else if (dir === 'up' || dir === 'up-left') {
      staffX = 18;
    } else {
      staffX = 44;
    }
    const handY = 42;

    if (isFrontView) {
      // VISTA FRONTAL / FRONTAL-DIAGONAL
      if (isPureSide) {
        if (isLeft) {
          // CAMINANDO A LA IZQUIERDA: Manga orientada en diagonal hacia adelante alcanzando el báculo en x=20
          graphics.fillStyle(outfitHex, 1);
          graphics.beginPath();
          graphics.moveTo(32, 27);
          graphics.lineTo(36, 29);
          graphics.lineTo(23, 42);
          graphics.lineTo(19, 39);
          graphics.closePath();
          graphics.fillPath();
        } else {
          // CAMINANDO A LA DERECHA: Manga orientada recto hacia abajo (vertical)
          graphics.fillStyle(outfitHex, 1);
          graphics.fillRect(38, 27, 7, 15);
        }
      } else {
        this.drawRotatedLimbSegment(graphics, 18, shoulderY, 7, 0, 16, leftArmAngle, outfitHex);
        this.drawRotatedLimbSegment(graphics, 18, shoulderY, 5, 12, 16, leftArmAngle, skinHex);

        this.drawRotatedLimbSegment(graphics, 46, shoulderY, 7, 0, 16, rightArmAngle, outfitHex);
        this.drawRotatedLimbSegment(graphics, 46, shoulderY, 5, 12, 16, rightArmAngle, skinHex);
      }

      // 2. Báculo por DELANTE del brazo y cuerpo
      this.drawWizardStaffAsset(graphics, staffX);

      // 3. Mano pequeña empuñando el báculo en el frente
      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(staffX - 1, handY - 3, 6, 2);
      graphics.fillStyle(skinHex, 1);
      graphics.fillRect(staffX - 0.5, handY - 1, 5, 4);
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(staffX - 0.5, handY - 2, 5, 1.5);

    } else {
      // VISTA POSTERIOR / PERFIL PURO LATERAL: El báculo pasa por detrás del cuerpo/brazo
      // 1. Báculo al fondo por detrás de la túnica/brazo
      this.drawWizardStaffAsset(graphics, staffX);

      // 2. Mangas y Brazo en la capa frontal superior tapando el báculo por detrás
      if (isPureSide) {
        if (isLeft) {
          // CAMINANDO A LA IZQUIERDA: Manga orientada en diagonal hacia adelante alcanzando el báculo en x=20
          graphics.fillStyle(outfitHex, 1);
          graphics.beginPath();
          graphics.moveTo(32, 27);
          graphics.lineTo(36, 29);
          graphics.lineTo(23, 42);
          graphics.lineTo(19, 39);
          graphics.closePath();
          graphics.fillPath();
        } else {
          // CAMINANDO A LA DERECHA: Manga orientada recto hacia abajo (vertical)
          graphics.fillStyle(outfitHex, 1);
          graphics.fillRect(38, 27, 7, 15);
        }
      } else {
        this.drawRotatedLimbSegment(graphics, 18, shoulderY, 7, 0, 16, leftArmAngle, outfitHex);
        this.drawRotatedLimbSegment(graphics, 18, shoulderY, 5, 12, 16, leftArmAngle, skinHex);

        this.drawRotatedLimbSegment(graphics, 46, shoulderY, 7, 0, 16, rightArmAngle, outfitHex);
        this.drawRotatedLimbSegment(graphics, 46, shoulderY, 5, 12, 16, rightArmAngle, skinHex);
      }

      // 3. Detalle de sujeción posterior
      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(staffX - 1, handY - 3, 6, 2);
      graphics.fillStyle(skinHex, 1);
      graphics.fillRect(staffX - 0.5, handY - 1, 5, 4);
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(staffX - 0.5, handY - 2, 5, 1.5);
    }

    // 5. Cabeza Humana de Mago/Maga
    graphics.fillStyle(skinHex, 1);
    // Rostro más fino de 15px para la Maga Femenina, 18px para el Mago Masculino
    graphics.fillEllipse(32, 17, isFemale ? 15 : 18, 19);

    // Orejas Sabias (Visibles en frontal y posterior)
    if (isFrontOrBack) {
      graphics.fillCircle(isFemale ? 23.5 : 22.5, 18, 1.6);
      graphics.fillCircle(isFemale ? 40.5 : 41.5, 18, 1.6);
    }

    // Rostro: Cejas y Ojos Místicos (Arqueados y finos para la maga femenina)
    if (dir === 'down' || dir.includes('down')) {
      if (isFemale) {
        // Cejas finas estilizadas femeninas
        graphics.fillStyle(hairHex, 1);
        graphics.fillRect(25, 14, 4, 1.5); graphics.fillRect(34, 14, 4, 1.5);
        // Ojos arcanos femeninos expresivos
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillRect(26, 17, 3, 3); graphics.fillRect(34, 17, 3, 3);
        graphics.fillStyle(0x38bdf8, 1); // Brillo arcano azul
        graphics.fillRect(26.5, 17, 1.5, 1.5); graphics.fillRect(34.5, 17, 1.5, 1.5);
      } else {
        // Cejas ancianas pobladas canosas
        graphics.fillStyle(0xe2e8f0, 1);
        graphics.fillRect(24, 14, 5, 2.2); graphics.fillRect(35, 14, 5, 2.2);
        // Ojos arcanos masculinos
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillRect(26, 17, 3, 3); graphics.fillRect(35, 17, 3, 3);
        graphics.fillStyle(0x38bdf8, 1); // Brillo arcano en ojos
        graphics.fillRect(27, 17, 1.5, 1.5); graphics.fillRect(36, 17, 1.5, 1.5);
      }
    }

    // 6. Cabello y Barba (Barba SOLO para el Mago Masculino)
    const beardColor = 0xf8fafc; // Barba blanca para el mago viejo

    if (!isFemale) {
      if (dir === 'down' || dir.includes('down')) {
        // FRONTAL: Barba Sabia Masculina Distinguida (Mediana)
        graphics.fillStyle(beardColor, 1);
        graphics.beginPath();
        graphics.moveTo(24, 20);
        graphics.lineTo(21, 28);
        graphics.lineTo(26, 36);
        graphics.lineTo(32, 39); // Punta masculina bien definida
        graphics.lineTo(38, 36);
        graphics.lineTo(43, 28);
        graphics.lineTo(40, 20);
        graphics.closePath();
        graphics.fillPath();

        // Bigote masculino bien poblado
        graphics.fillStyle(0xe2e8f0, 1);
        graphics.fillRect(25, 20, 14, 3);
      }
    }

    // 7. Largo Cabello Místico (Blanco sabio para el mago masculino, hairHex para la maga femenina)
    const hairColor = isFemale ? hairHex : 0xf8fafc;
    graphics.fillStyle(hairColor, 1);

    if (dir === 'down' || dir.includes('down')) {
      // FRONTAL: Melena superior y cabello largo cayendo a los lados de los hombros
      graphics.fillEllipse(32, 11, 20, 10);
      graphics.fillRect(19, 13, 5, isFemale ? 24 : 20);
      graphics.fillRect(39, 13, 5, isFemale ? 24 : 20);
    } else if (dir === 'up' || dir.includes('up')) {
      // POSTERIOR / ESPALDA: Cabello largo completo cayendo por la espalda sobre la túnica
      graphics.fillEllipse(32, 11, 22, 10);
      graphics.fillRect(20, 13, 24, isFemale ? 26 : 24);
    } else {
      // PERFIL LATERAL: Cabello largo cayendo por la parte posterior de la cabeza sobre la espalda
      graphics.fillEllipse(32, 11, 20, 10);
      graphics.fillRect(isLeft ? 28 : 20, 13, 12, 22);

      if (!isFemale) {
        // Perfil de la barba masculina media
        graphics.fillStyle(beardColor, 1);
        graphics.beginPath();
        graphics.moveTo(isLeft ? 23 : 32, 20);
        graphics.lineTo(isLeft ? 19 : 38, 33);
        graphics.lineTo(isLeft ? 29 : 37, 33);
        graphics.lineTo(isLeft ? 33 : 41, 20);
        graphics.closePath();
        graphics.fillPath();
      }
    }
  }

  // Helper para renderizar el Báculo Mágico de Mago (Staff + Orbe Radiante)
  private drawWizardStaffAsset(graphics: Phaser.GameObjects.Graphics, staffX: number) {
    graphics.fillStyle(0x78350f, 1); // Madera mística
    graphics.fillRect(staffX, 10, 4, 72);
    // Cabeza del báculo de madera torcida
    graphics.fillCircle(staffX + 2, 12, 5);
    // Gema Mística Flotante Radiante en la cima del báculo
    graphics.fillStyle(0x38bdf8, 1); // Orbe arcano cian radiante
    graphics.fillCircle(staffX + 2, 8, 4.5);
    graphics.fillStyle(0xffffff, 1); // Destello de energía
    graphics.fillCircle(staffX + 1, 6.5, 1.8);
  }

  // Helper para renderizar el Carcaj de Flechas Elfo y Tirante Cruzado (Frontal o Invertido en Espalda)
  private drawElvenQuiverAndStrap(
    graphics: Phaser.GameObjects.Graphics,
    dir: string
  ) {
    const isBack = dir === 'up' || dir.includes('up');

    if (isBack) {
      // VISTA DE ESPALDA (Perspectiva 3D: El personaje nos da la espalda, el carcaj va montado SOBRE SU ESPALDA x=22..31):
      // 1. Carcaj Principal de Cuero sobre el omóplato derecho (x=22..31)
      graphics.fillStyle(0x5c2c16, 1);
      graphics.fillRect(22, 16, 9, 28); // Cuerpo del Carcaj de Cuero sobre la túnica de la espalda
      graphics.fillStyle(0x78350f, 1);
      graphics.fillRect(21, 15, 11, 3);  // Borde superior de cuero reforzado

      // 3 Flechas con Plumas Doradas sobresaliendo del Carcaj (Sobre el hombro)
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(23, 7, 2, 9);
      graphics.fillRect(26, 5, 2, 11);
      graphics.fillRect(29, 8, 2, 8);

      // Plumas Doradas de Flechas
      graphics.fillStyle(0xfde047, 1);
      graphics.fillTriangle(23, 7, 21, 10, 23, 10);
      graphics.fillTriangle(26, 5, 24, 8, 26, 8);
      graphics.fillTriangle(29, 8, 27, 11, 29, 11);

      // 2. Tirante en la Espalda: Cruza en la espalda desde Hombro Izquierdo (x=24) a Cadera Derecha (x=40)
      graphics.fillStyle(0x451a03, 1);
      graphics.beginPath();
      graphics.moveTo(24, 28);
      graphics.lineTo(40, 44);
      graphics.lineTo(38, 46);
      graphics.lineTo(22, 30);
      graphics.closePath();
      graphics.fillPath();

      // SIN HEBILLA / PUNTO DORADO EN LA ESPALDA
    } else {
      // VISTA FRONTAL / LATERAL:
      // Carcaj asomándose por detrás del hombro derecho (Lado Derecho de la pantalla x=38)
      graphics.fillStyle(0x5c2c16, 1);
      graphics.fillRect(38, 16, 6, 26);
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(39, 8, 2, 8);
      graphics.fillRect(41, 6, 2, 10);

      // Tirante Cruzado Frontal (De Hombro Izquierdo x=24 a Cadera Derecha x=40)
      graphics.fillStyle(0x451a03, 1);
      graphics.beginPath();
      graphics.moveTo(24, 30);
      graphics.lineTo(40, 44);
      graphics.lineTo(38, 46);
      graphics.lineTo(22, 32);
      graphics.closePath();
      graphics.fillPath();

      // Hebilla Dorada en el Pecho (Únicamente en vista frontal)
      graphics.fillStyle(0xfbbf24, 1);
      graphics.fillRect(30, 36, 4, 4);
    }
  }



  private drawGenericCharacter(
    graphics: Phaser.GameObjects.Graphics,
    skinHex: number,
    hairHex: number,
    outfitHex: number,
    cls: string,
    isFemale: boolean,
    dir: string,
    frame: number
  ) {
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(32, 86, 38, 10);

    const legW = isFemale ? 5 : 8;
    const hipY = 48;
    this.drawRotatedLimbSegment(graphics, 25, hipY, legW, 0, 22, 0, skinHex);
    this.drawRotatedLimbSegment(graphics, 25, hipY, legW + 2, 18, 34, 0, 0x451a03);
    this.drawRotatedLimbSegment(graphics, 39, hipY, legW, 0, 22, 0, skinHex);
    this.drawRotatedLimbSegment(graphics, 39, hipY, legW + 2, 18, 34, 0, 0x451a03);

    graphics.fillStyle(outfitHex, 1);
    graphics.fillRect(20, 28, 24, 28);

    graphics.fillStyle(skinHex, 1);
    graphics.fillRect(29, 21, 6, 8);
    graphics.fillEllipse(32, 17, 18, 20);

    graphics.fillStyle(hairHex, 1);
    graphics.fillEllipse(32, 12, 22, 10);
  }

  public async savePlayerToServer() {
    if (!this.currentCharacterName) return;
    try {
      const stats = (typeof window !== 'undefined' && (window as any).characterStats) ? (window as any).characterStats : {};
      const activeUser = (typeof window !== 'undefined' && (window as any).activeUser) ? (window as any).activeUser : null;

      const payload = {
        ...(this.currentCharacterData || {}),
        characterName: this.currentCharacterName,
        ownerEmail: activeUser ? activeUser.email : (this.currentCharacterData?.ownerEmail || ''),
        characterClass: this.currentCharacterData?.characterClass || 'arquero',
        gender: this.currentCharacterData?.gender || 'femenino',
        skinColor: this.currentCharacterData?.skinColor || '#f5c6a5',
        hairColor: this.currentCharacterData?.hairColor || '#451a03',
        outfitColor: this.currentCharacterData?.outfitColor || '#16a34a',
        level: this.playerLevel,
        xp: this.playerXp,
        availablePoints: stats.availablePoints || 0,
        elements: stats.elements || {},
        specials: stats.specials || {},
        hp: this.playerHp,
        maxHp: this.playerMaxHp,
        mana: Math.min(10, this.playerMana),
        maxMana: 10,
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
    if (this.isSceneTransitioning) return;

    this.handlePlayerMovement();
    this.updateCreaturesAI(time);
    this.updateDepthSorting();
    this.animateOceanWaves(time);

    // Transición de Escena al llegar a la Puerta del Templo
    if (this.pendingTempleEnter && this.templeDoorZone.x !== 0) {
      const distToDoor = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.templeDoorZone.x, this.templeDoorZone.y);
      if (distToDoor < 45) {
        this.isSceneTransitioning = true;
        this.pendingTempleEnter = false;
        this.player.setVelocity(0, 0);
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.time.delayedCall(500, () => {
          this.scene.start('TempleInteriorScene');
        });
      }
    }
  }

  private createIslandMap() {
    this.waterTiles = this.physics.add.staticGroup();
    this.animatedWaterObjects = [];

    const islandCenterIndex = 27;
    const templeCenterX = 16;
    const templeCenterY = 38;
    const minMapIndex = -45;
    const maxMapIndex = 100;
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale; // ~85.333px
    const tileH = 64 * tileScale;  // ~42.667px

    this.islandCenterIsoX = 0;
    this.islandCenterIsoY = (islandCenterIndex + islandCenterIndex) * (tileH / 2);

    for (let x = minMapIndex; x <= maxMapIndex; x++) {
      for (let y = minMapIndex; y <= maxMapIndex; y++) {
        const dx = x - islandCenterIndex;
        const dy = y - islandCenterIndex;
        const distFromMain = Math.sqrt(dx * dx + dy * dy);

        // Extensión Peninsular del Templo hacia la Izquierda
        const tDx = x - templeCenterX;
        const tDy = y - templeCenterY;
        const distFromTempleCenter = Math.sqrt(tDx * tDx + tDy * tDy);

        // Conector de tierra continuo entre la isla principal y el templo
        const lineVal = Math.abs((x - 27) + (y - 27));
        const bridgeProgress = Math.sqrt(dx * dx + dy * dy);
        const isConnectorBridge = (x <= 27 && y >= 27 && lineVal <= 3.5 && bridgeProgress <= 17);

        let isGrass = false;
        let isSand = false;

        if (distFromMain <= 15.3 || distFromTempleCenter <= 11.0 || (isConnectorBridge && bridgeProgress <= 14.5)) {
          isGrass = true;
        } else if (distFromMain <= 21.5 || distFromTempleCenter <= 15.0 || isConnectorBridge) {
          isSand = true;
        }

        // Precision subpixel floating point coordinates
        const baseIsoX = (x - y) * (tileW / 2);
        const baseIsoY = (x + y) * (tileH / 2);

        if (isGrass) {
          // Prado verde elevado en nivel alto (-13.33px)
          const isoY = baseIsoY - 13.333;
          const tile = this.add.image(baseIsoX, isoY, 'tile-grass');
          tile.setOrigin(0.5, 0);
          tile.setScale(tileScale);
          tile.setDepth(-5000 + baseIsoY);
        } else if (isSand) {
          // Arena de playa de la isla (100% tierra caminable sin colisionadores de agua)
          const isoY = baseIsoY - 6.667;
          const tile = this.add.image(baseIsoX, isoY, 'tile-sand');
          tile.setOrigin(0.5, 0);
          tile.setScale(tileScale);
          tile.setDepth(-5000 + baseIsoY);
        } else {
          // Océano al nivel del mar (0px) - Agua y Colisionadores Marítimos
          const isoY = baseIsoY;

          // Fondo marino de arena bajo el agua cerca de la orilla
          if (distFromMain <= 25.0 || distFromTempleCenter <= 17.5) {
            const seaBed = this.add.image(baseIsoX, baseIsoY - 6.667, 'tile-sand');
            seaBed.setOrigin(0.5, 0);
            seaBed.setScale(tileScale);
            seaBed.setDepth(-6000 + baseIsoY);

            // Colisionador marítimo ubicado estrictamente dentro de casillas de agua
            const waterCollider = this.waterTiles.create(baseIsoX, baseIsoY + 16, 'tile-water') as Phaser.Physics.Arcade.Sprite;
            waterCollider.setVisible(false);
            const wBody = waterCollider.body as Phaser.Physics.Arcade.StaticBody;
            if (wBody) {
              wBody.setSize(44, 14);
              wBody.setOffset(20, 20);
            }
            waterCollider.refreshBody();
          }

          const waterTile = this.add.image(baseIsoX, isoY, 'tile-water');
          waterTile.setOrigin(0.5, 0);
          waterTile.setScale(tileScale);
          waterTile.setDepth(-5000 + baseIsoY);

          if (distFromMain <= 45 || distFromTempleCenter <= 25) {
            this.animatedWaterObjects.push({
              sprite: waterTile,
              baseIsoY,
              phaseOffset: (x * 0.3) + (y * 0.2)
            });
          }
        }
      }
    }
  }

  private createTempleBuilding() {
    const templeCenterX = 16;
    const templeCenterY = 38;
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale;
    const tileH = 64 * tileScale;

    // Coordenadas mundiales exactas en la Península Izquierda del Templo
    const templeX = (templeCenterX - templeCenterY) * (tileW / 2);
    const templeY = (templeCenterX + templeCenterY) * (tileH / 2) - 13.333;

    // Sprite del Templo de la Natividad (Asset vectorial de alta resolución de la Catedral Románica sin líneas negras)
    const temple = this.add.sprite(templeX, templeY, 'temple-building');
    temple.setOrigin(0.5, 0.85);
    temple.setScale(0.85);
    temple.setDepth(templeY - 25);

    // Zona de Interacción y Resaltado Dorado EXCLUSIVAMENTE para la Puerta de Entrada
    const doorZoneX = templeX + 45;
    const doorZoneY = templeY + 25;
    this.templeDoorZone = { x: doorZoneX, y: doorZoneY };

    // Arco Dorado Resaltado sobre la Puerta (NO resalta todo el templo, solo el arco de madera)
    const doorHighlight = this.add.graphics();
    doorHighlight.setPosition(doorZoneX, doorZoneY);
    doorHighlight.setDepth(templeY + 1100);
    doorHighlight.setVisible(false);

    doorHighlight.lineStyle(3.5, 0xffea00, 1);
    doorHighlight.fillStyle(0xfde047, 0.40);
    doorHighlight.beginPath();
    doorHighlight.arc(0, -25, 22, Math.PI, 0, false);
    doorHighlight.lineTo(22, 10);
    doorHighlight.lineTo(-22, 10);
    doorHighlight.closePath();
    doorHighlight.fillPath();
    doorHighlight.strokePath();

    const doorLabel = this.add.text(doorZoneX, doorZoneY - 75, '🚪 Entrar al Templo de la Natividad', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#fef08a',
      backgroundColor: 'rgba(15, 23, 42, 0.90)',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(templeY + 1200).setVisible(false);

    // Zona interactiva del ratón en la puerta
    const doorHitZone = this.add.zone(doorZoneX, doorZoneY - 10, 65, 85);
    doorHitZone.setInteractive({ useHandCursor: true });

    doorHitZone.on('pointerover', () => {
      doorHighlight.setVisible(true); // Resalta ÚNICA Y EXCLUSIVAMENTE el portal de madera
      doorLabel.setVisible(true);
    });

    doorHitZone.on('pointerout', () => {
      doorHighlight.setVisible(false);
      doorLabel.setVisible(false);
    });

    doorHitZone.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: any) => {
      if (event && event.stopPropagation) event.stopPropagation();
      this.clickTarget = new Phaser.Math.Vector2(doorZoneX, doorZoneY);
      this.pendingTempleEnter = true;
    });

    // Cargar Offsets de Piedras Guardadas en localStorage (Conserva las piedras organizadas por el usuario)
    let perimeterRockOffsets: Array<{ dx: number; dy: number }> = [
      // Frente y Escaleras de Entrada (Abajo-Derecha)
      { dx: 100, dy: 35 }, { dx: 82, dy: 45 }, { dx: 64, dy: 52 }, { dx: 46, dy: 58 },
      { dx: 28, dy: 62 }, { dx: 10, dy: 62 }, { dx: -8, dy: 58 },
      
      // Muro Frontal Izquierdo (Abajo-Izquierda)
      { dx: -26, dy: 52 }, { dx: -44, dy: 44 }, { dx: -62, dy: 35 }, { dx: -80, dy: 26 },
      { dx: -98, dy: 17 }, { dx: -116, dy: 8 }, { dx: -134, dy: -2 }, { dx: -148, dy: -14 },

      // Muro Trasero e Izquierdo (Arriba-Izquierda y Arriba)
      { dx: -156, dy: -30 }, { dx: -158, dy: -50 }, { dx: -152, dy: -70 }, { dx: -140, dy: -88 },
      { dx: -124, dy: -104 }, { dx: -104, dy: -118 }, { dx: -82, dy: -128 }, { dx: -60, dy: -132 },
      { dx: -38, dy: -128 }, { dx: -16, dy: -118 },

      // Fachada Derecha y Campanario (Arriba-Derecha)
      { dx: 6, dy: -106 }, { dx: 28, dy: -92 }, { dx: 50, dy: -76 }, { dx: 70, dy: -58 },
      { dx: 86, dy: -38 }, { dx: 98, dy: -16 }, { dx: 104, dy: 10 },

      // 2 Piedras Adicionales Solicitadas sobre Césped Verde
      { dx: -120, dy: 60 }, { dx: 110, dy: 50 }
    ];

    try {
      const savedRocks = localStorage.getItem('atnight_temple_rock_offsets');
      if (savedRocks) {
        const parsed = JSON.parse(savedRocks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          perimeterRockOffsets = parsed;
        }
      }
    } catch (e) {
      // Fallback a defecto
    }

    // Etiqueta flotante para mostrar las coordenadas en tiempo real al arrastrar con el ratón
    const dragLabel = this.add.text(templeX, templeY - 180, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#fde047',
      backgroundColor: 'rgba(0,0,0,0.85)',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(templeY + 1000).setVisible(false);

    const activeRockSprites: Phaser.Physics.Arcade.Sprite[] = [];

    perimeterRockOffsets.forEach(pos => {
      const rx = templeX + pos.dx;
      const ry = templeY + pos.dy;
      const rock = this.rockGroup.create(rx, ry, 'small-rock') as Phaser.Physics.Arcade.Sprite;
      rock.setVisible(true);
      rock.setDepth(ry + 10);
      const rBody = rock.body as Phaser.Physics.Arcade.StaticBody;
      if (rBody) {
        rBody.setSize(22, 16);
        rBody.setOffset(5, 10);
      }
      rock.refreshBody();

      // Permitir Arrastre Interactivo Directo con el Mouse
      rock.setInteractive({ useHandCursor: true });
      this.input.setDraggable(rock);
      activeRockSprites.push(rock);
    });

    // Escuchador de Eventos de Arrastre con el Ratón (Guarda la posición organizada en localStorage automáticamente)
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: any, dragX: number, dragY: number) => {
      gameObject.setPosition(dragX, dragY);
      gameObject.setDepth(dragY + 10);
      if (gameObject.body) {
        gameObject.body.updateFromGameObject();
      }
      const relX = Math.round(gameObject.x - templeX);
      const relY = Math.round(gameObject.y - templeY);

      dragLabel.setPosition(gameObject.x, gameObject.y - 30);
      dragLabel.setText(`Piedra Movida: { dx: ${relX}, dy: ${relY} }`);
      dragLabel.setVisible(true);

      // Guardar arreglo actualizado de posiciones en localStorage
      const updatedOffsets = activeRockSprites.map(r => ({
        dx: Math.round(r.x - templeX),
        dy: Math.round(r.y - templeY)
      }));
      localStorage.setItem('atnight_temple_rock_offsets', JSON.stringify(updatedOffsets));

      console.log(`[POSICIÓN GUARDADA PERMANENTEMENTE]`, JSON.stringify(updatedOffsets));
    });

    this.input.on('dragend', () => {
      this.time.delayedCall(2000, () => dragLabel.setVisible(false));
    });

    // Colisionadores Físicos Estáticos Compuestos de Respaldo para la Base
    const templeBackCollider = this.rockGroup.create(templeX, templeY, 'small-rock') as Phaser.Physics.Arcade.Sprite;
    templeBackCollider.setVisible(false);
    const cBodyBack = templeBackCollider.body as Phaser.Physics.Arcade.StaticBody;
    if (cBodyBack) {
      cBodyBack.setSize(260, 120);
      cBodyBack.setOffset(-160, -110);
    }
    templeBackCollider.refreshBody();

    const templeCenterCollider = this.rockGroup.create(templeX, templeY, 'small-rock') as Phaser.Physics.Arcade.Sprite;
    templeCenterCollider.setVisible(false);
    const cBodyCenter = templeCenterCollider.body as Phaser.Physics.Arcade.StaticBody;
    if (cBodyCenter) {
      cBodyCenter.setSize(290, 150);
      cBodyCenter.setOffset(-145, -80);
    }
    templeCenterCollider.refreshBody();

    // 3. Fachada Frontal y Muro Derecho (Bloquea en el verde antes del zócalo de piedra)
    const templeFrontCollider = this.rockGroup.create(templeX, templeY, 'small-rock') as Phaser.Physics.Arcade.Sprite;
    templeFrontCollider.setVisible(false);
    const cBodyFront = templeFrontCollider.body as Phaser.Physics.Arcade.StaticBody;
    if (cBodyFront) {
      cBodyFront.setSize(240, 110);
      cBodyFront.setOffset(-100, -25);
    }
    templeFrontCollider.refreshBody();

    // 4. Escaleras de Entrada y Portal (Bloquea en el césped frente a los escalones)
    const templeStairsCollider = this.rockGroup.create(templeX, templeY, 'small-rock') as Phaser.Physics.Arcade.Sprite;
    templeStairsCollider.setVisible(false);
    const cBodyStairs = templeStairsCollider.body as Phaser.Physics.Arcade.StaticBody;
    if (cBodyStairs) {
      cBodyStairs.setSize(150, 90);
      cBodyStairs.setOffset(0, 0);
    }
    templeStairsCollider.refreshBody();

    // Antorchas Místicas flanqueando la entrada orientada hacia abajo a la derecha
    const torchLeft = this.add.circle(templeX + 30, templeY + 20, 7, 0xf59e0b, 0.7);
    torchLeft.setDepth(templeY + 130);
    this.tweens.add({
      targets: torchLeft,
      alpha: 0.35,
      scale: 1.3,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const torchRight = this.add.circle(templeX + 65, templeY + 40, 7, 0xf59e0b, 0.7);
    torchRight.setDepth(templeY + 130);
    this.tweens.add({
      targets: torchRight,
      alpha: 0.35,
      scale: 1.3,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
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
    const activeData = this.currentCharacterData || (function() {
      try {
        const raw = localStorage.getItem('atnight_active_char_data');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    })() || {
      characterName: this.currentCharacterName || 'Leonhard1',
      characterClass: 'arquero',
      gender: 'femenino',
      skinColor: '#f5c6a5',
      hairColor: '#451a03',
      outfitColor: '#16a34a'
    };

    this.currentCharacterName = activeData.characterName || 'Leonhard1';
    this.currentCharacterData = activeData;
    this.characterClass = activeData.characterClass || 'arquero';
    this.playerLevel = activeData.level || 1;
    let loadedXp = activeData.xp || 0;
    const baseLevelThreshold = this.getXpThresholdForLevel(this.playerLevel);
    if (loadedXp < baseLevelThreshold) {
      loadedXp = baseLevelThreshold + loadedXp;
    }
    this.playerXp = loadedXp;
    this.playerMaxMana = 10;
    this.playerMana = Math.min(10, activeData.mana !== undefined ? activeData.mana : 10);

    if (typeof window !== 'undefined') {
      if ((window as any).characterStats) {
        (window as any).characterStats.level = this.playerLevel;
        if (activeData.availablePoints !== undefined) {
          (window as any).characterStats.availablePoints = activeData.availablePoints;
        }
        if (activeData.elements) {
          (window as any).characterStats.elements = activeData.elements;
        }
        if ((window as any).updateCaracteristicasUI) {
          (window as any).updateCaracteristicasUI();
        }
      }

      if (typeof (window as any).loadSavedSpellsState === 'function') {
        (window as any).loadSavedSpellsState();
      }
      if (typeof (window as any).syncSpellPointsWithLevel === 'function') {
        (window as any).syncSpellPointsWithLevel();
      }
      if (typeof (window as any).renderHotbarUI === 'function') {
        (window as any).renderHotbarUI();
      }
      if (typeof (window as any).updatePoderesUI === 'function') {
        (window as any).updatePoderesUI();
      }
    }

    this.generateCustomPlayerTextures(activeData);

    const initialFrame = `char-${this.currentCharacterName}-down-0`;
    this.player = this.physics.add.sprite(this.islandCenterIsoX, this.islandCenterIsoY, initialFrame);
    this.player.setOrigin(0.5, 0.77);
    this.player.setCollideWorldBounds(false);
    this.player.body?.setSize(26, 18);
    this.player.body?.setOffset(19, 66);
    this.player.setDepth(this.islandCenterIsoY);
    this.player.play(`char-${this.currentCharacterName}-idle-down`, true);
  }

  private getPolloLevelData(level: number) {
    switch (level) {
      case 1:
        return { maxHp: 60, scale: 0.81, xp: 50 };
      case 2:
        return { maxHp: 70, scale: 0.90, xp: 75 };
      case 3:
      default:
        return { maxHp: 80, scale: 1.00, xp: 100 };
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

      // Check if clicking directly on a creature to select target or attack
      let clickedCreature: Creature | null = null;
      this.creatures.forEach(c => {
        if (c.sprite.active && c.sprite.getBounds().contains(worldPoint.x, worldPoint.y)) {
          clickedCreature = c;
        }
      });

      if (clickedCreature) {
        this.selectedCreature = clickedCreature;
      } else {
        // Set Click Target Destination snapped dead-center to tile
        const snappedTarget = this.updateTileGridMarker(worldPoint.x, worldPoint.y);
        this.clickTarget = snappedTarget;
      }
    });

    // Pointer Move: Hover Tile Fine Outline Highlight
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.updateHoverTileMarker(worldPoint.x, worldPoint.y);
    });

    // Keyboard Shortcuts
    this.wasdKeys.gather.on('down', () => this.handleGathering());

    // Hotbar numeric keys 1, 2, 3, 4, 5, 6, 7, 8, 9, 0
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea') return;

      const key = event.key;
      if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(key)) {
        this.triggerHotbarSlot(key);
      }
    });
  }

  // --- Target Selection Visual Reticle ---
  public selectedCreature: Creature | null = null;
  public targetReticleGraphic: Phaser.GameObjects.Graphics | null = null;

  private updateTargetReticle() {
    try {
      if (!this.selectedCreature || !this.selectedCreature.sprite.active || this.selectedCreature.hp <= 0) {
        if (this.targetReticleGraphic) {
          this.targetReticleGraphic.clear();
        }
        this.selectedCreature = null;
        return;
      }

      if (!this.targetReticleGraphic) {
        this.targetReticleGraphic = this.add.graphics();
      }

      const c = this.selectedCreature;
      const cx = c.sprite.x;
      const cy = c.sprite.y + 6;

      const pulse = Math.sin(this.time.now * 0.008) * 3;
      const w = (24 + pulse) * 2;
      const h = (12 + pulse * 0.5) * 2;

      this.targetReticleGraphic.clear();
      this.targetReticleGraphic.lineStyle(2, 0xef4444, 0.95);
      this.targetReticleGraphic.fillStyle(0xef4444, 0.25);
      this.targetReticleGraphic.strokeEllipse(cx, cy, w, h);
      this.targetReticleGraphic.fillEllipse(cx, cy, w, h);
      this.targetReticleGraphic.setDepth(cy - 2);
    } catch (_e) {}
  }

  // --- Hotbar & Spell Execution System ---
  public triggerHotbarSlot(slotKey: string) {
    const spellState = (window as any).playerSpellsState;
    if (!spellState || !spellState.hotbar) return;

    const spellId = spellState.hotbar[slotKey];
    if (!spellId) {
      this.showFloatingText(this.player.x, this.player.y - 45, `Casilla ${slotKey} Vacía`, '#94a3b8');
      return;
    }

    if (spellId === 'flecha_punzante') {
      this.castSpellFlechaPunzante();
    }
  }

  public castSpellFlechaPunzante() {
    const time = this.time.now;
    if (time - this.lastPlayerAttackTime < 450) return;

    // Check player class (Elfo/arquero)
    if (this.characterClass !== 'arquero') {
      this.showFloatingText(this.player.x, this.player.y - 45, 'Sólo la clase Elfo puede usar este poder', '#ef4444');
      return;
    }

    const state = (window as any).playerSpellsState;
    const spellData = (window as any).spellDatabase?.flecha_punzante;
    const spellLevel = state?.spells?.flecha_punzante?.level || 1;
    const lvlInfo = spellData?.levels?.[spellLevel] || { minDamage: 15, maxDamage: 18, manaCost: 4, range: 5 };

    // Check Mana Cost
    if (this.playerMana < lvlInfo.manaCost) {
      this.showFloatingText(this.player.x, this.player.y - 45, '¡Maná Insuficiente!', '#3b82f6');
      return;
    }

    this.lastPlayerAttackTime = time;
    this.playerMana -= lvlInfo.manaCost;

    // Determine target location (selected creature, pointer position, or facing direction)
    let targetX = 0;
    let targetY = 0;

    if (this.selectedCreature && this.selectedCreature.sprite.active && this.selectedCreature.hp > 0) {
      targetX = this.selectedCreature.sprite.x;
      targetY = this.selectedCreature.sprite.y - 12;
    } else {
      const pointer = this.input.activePointer;
      if (pointer && (pointer.worldX !== undefined && pointer.worldY !== undefined)) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        targetX = worldPoint.x;
        targetY = worldPoint.y;
      } else {
        const dirOffset: Record<string, {x: number, y: number}> = {
          'right': {x: 250, y: 0},
          'down-right': {x: 180, y: 180},
          'down': {x: 0, y: 250},
          'down-left': {x: -180, y: 180},
          'left': {x: -250, y: 0},
          'up-left': {x: -180, y: -180},
          'up': {x: 0, y: -250},
          'up-right': {x: 180, y: -180}
        };
        const offset = dirOffset[this.lastDirection] || {x: 0, y: 250};
        targetX = this.player.x + offset.x;
        targetY = this.player.y - 20 + offset.y;
      }
    }

    // Stop player movement for shooting animation
    this.clickTarget = null;
    if (this.player.body) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    // Calculate 8-directional orientation to face target
    const dx = targetX - this.player.x;
    const dy = targetY - (this.player.y - 20);
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = Phaser.Math.RadToDeg(angleRad);

    let currentDir = 'down';
    if (angleDeg >= -22.5 && angleDeg < 22.5) currentDir = 'right';
    else if (angleDeg >= 22.5 && angleDeg < 67.5) currentDir = 'down-right';
    else if (angleDeg >= 67.5 && angleDeg < 112.5) currentDir = 'down';
    else if (angleDeg >= 112.5 && angleDeg < 157.5) currentDir = 'down-left';
    else if (angleDeg >= 157.5 || angleDeg < -157.5) currentDir = 'left';
    else if (angleDeg >= -157.5 && angleDeg < -112.5) currentDir = 'up-left';
    else if (angleDeg >= -112.5 && angleDeg < -67.5) currentDir = 'up';
    else if (angleDeg >= -67.5 && angleDeg < -22.5) currentDir = 'up-right';

    this.lastDirection = currentDir;
    this.player.setFlipX(false);

    // Play Elfo archery pose frame
    const idleKey = `char-${this.currentCharacterName}-idle-${currentDir}`;
    if (this.anims.exists(idleKey)) {
      this.player.play(idleKey, true);
    }

    // Spawn 8-Directional Bow Visual Container at Player Hand
    const bowContainer = this.add.container(this.player.x, this.player.y - 20);
    bowContainer.setDepth(this.player.y + 15);
    bowContainer.setRotation(angleRad);

    const isAimingLeft = Math.abs(angleRad) > Math.PI / 2;
    if (isAimingLeft) {
      bowContainer.setScale(1, -1);
    }

    const bowGraphic = this.add.graphics();
    bowGraphic.lineStyle(2.5, 0xd97706, 1);
    bowGraphic.beginPath();
    bowGraphic.arc(0, 0, 14, -Math.PI / 3, Math.PI / 3, false);
    bowGraphic.strokePath();

    bowGraphic.lineStyle(1.5, 0xef4444, 0.9);
    bowGraphic.lineBetween(-10, 0, 8, 0);

    bowContainer.add(bowGraphic);

    this.tweens.add({
      targets: bowContainer,
      scaleX: isAimingLeft ? 1.25 : 1.25,
      scaleY: isAimingLeft ? -1.25 : 1.25,
      duration: 120,
      yoyo: true,
      onComplete: () => bowContainer.destroy()
    });

    // Range Check Calculation: Max 5 tiles (Lvl 1 & 2) or 6 tiles (Lvl 3) ALWAYS
    const maxRangeTiles = lvlInfo.range || 5;
    const tileStepPx = 47.7; // Distancia exacta en píxeles de 1 casilla isométrica
    const maxRangePx = maxRangeTiles * tileStepPx; // 5 casillas = ~238.5px, 6 casillas = ~286.2px
    const distToTarget = Phaser.Math.Distance.Between(this.player.x, this.player.y - 20, targetX, targetY);

    const isTargetHitDirectly = !!(this.selectedCreature && this.selectedCreature.sprite.active && this.selectedCreature.hp > 0 && distToTarget <= maxRangePx);
    const flyDistance = Math.min(distToTarget, maxRangePx);
    const finalDestX = this.player.x + Math.cos(angleRad) * flyDistance;
    const finalDestY = (this.player.y - 20) + Math.sin(angleRad) * flyDistance;

    const flyDuration = Math.max(160, Math.min(600, (flyDistance / 650) * 1000));

    // Spawn Red Flaming Arrow Projectile 🔥🏹
    const arrowContainer = this.add.container(this.player.x, this.player.y - 20);
    arrowContainer.setDepth(5000);

    const arrowGraphic = this.add.graphics();
    arrowGraphic.lineStyle(3, 0xef4444, 1);
    arrowGraphic.lineBetween(-14, 0, 10, 0);
    arrowGraphic.fillStyle(0xf87171, 1);
    arrowGraphic.fillTriangle(14, 0, 8, -4, 8, 4);
    arrowGraphic.fillStyle(0xf97316, 0.9);
    arrowGraphic.fillCircle(12, 0, 4);

    arrowContainer.add(arrowGraphic);
    arrowContainer.setRotation(angleRad);

    // Trail particles
    const trailTimer = this.time.addEvent({
      delay: 25,
      repeat: Math.floor(flyDuration / 25),
      callback: () => {
        if (arrowContainer.active) {
          const particle = this.add.circle(arrowContainer.x, arrowContainer.y, Phaser.Math.Between(2, 4), 0xf97316, 0.8);
          particle.setDepth(arrowContainer.y - 2);
          this.tweens.add({
            targets: particle,
            alpha: 0,
            scale: 0.1,
            duration: 180,
            onComplete: () => particle.destroy()
          });
        }
      }
    });

    // Fly Tween
    this.tweens.add({
      targets: arrowContainer,
      x: finalDestX,
      y: finalDestY,
      duration: flyDuration,
      ease: 'Linear',
      onComplete: () => {
        trailTimer.destroy();

        // Check if there is an actual creature hit at finalDestX, finalDestY
        let hitCreature: Creature | null = null;
        if (isTargetHitDirectly) {
          hitCreature = this.selectedCreature;
        } else {
          this.creatures.forEach(c => {
            if (c.sprite.active && c.hp > 0) {
              const d = Phaser.Math.Distance.Between(finalDestX, finalDestY, c.sprite.x, c.sprite.y);
              if (d <= 45) hitCreature = c;
            }
          });
        }

        if (hitCreature && hitCreature.sprite.active && hitCreature.hp > 0) {
          // --- IMPACTA A UNA CRIATURA ---
          const spark = this.add.circle(finalDestX, finalDestY, 16, 0xef4444, 0.85);
          spark.setDepth(finalDestY + 10);
          this.tweens.add({
            targets: spark,
            scale: 2.2,
            alpha: 0,
            duration: 160,
            onComplete: () => spark.destroy()
          });

          const minDmg = lvlInfo.minDamage || 15;
          const maxDmg = lvlInfo.maxDamage || 18;
          const baseDamage = Phaser.Math.Between(minDmg, maxDmg);

          const fuegoStat = ((window as any).characterStats?.elements?.fuego?.equip || 0) + ((window as any).characterStats?.elements?.fuego?.base || 0);
          const statMultiplier = 1 + (fuegoStat * 0.001);
          const finalDamage = Math.max(1, Math.round(baseDamage * statMultiplier));

          hitCreature.hp -= finalDamage;
          if (!hitCreature.isAggro) {
            hitCreature.isAggro = true;
            hitCreature.state = 'PURSUIT';
          }
          this.showFloatingText(hitCreature.sprite.x, hitCreature.sprite.y - 35, `-${finalDamage} 🔥`, '#ef4444');
          hitCreature.sprite.setTint(0xff0000);
          this.time.delayedCall(150, () => hitCreature?.sprite.clearTint());

          if (hitCreature.hp <= 0) {
            this.killCreature(hitCreature);
          }

          arrowContainer.destroy();
        } else {
          // --- SIN OBJETIVO O FUERA DE ALCANCE: LA FLECHA CAE AL SUELO Y DESAPARECE (SIN DAÑO) ---
          this.tweens.add({
            targets: arrowContainer,
            y: finalDestY + 14,
            rotation: arrowContainer.rotation + 0.35,
            alpha: 0,
            duration: 260,
            ease: 'Quad.easeIn',
            onComplete: () => arrowContainer.destroy()
          });
        }
      }
    });
  }

  private getTileElevation(gridX: number, gridY: number): number {
    const center = 27;
    const templeCenterX = 16;
    const templeCenterY = 38;

    const dx = gridX - center;
    const dy = gridY - center;
    const distFromMain = Math.sqrt(dx * dx + dy * dy);

    const tDx = gridX - templeCenterX;
    const tDy = gridY - templeCenterY;
    const distFromTempleCenter = Math.sqrt(tDx * tDx + tDy * tDy);

    const lineVal = Math.abs((gridX - 27) + (gridY - 27));
    const bridgeProgress = Math.sqrt(dx * dx + dy * dy);
    const isConnectorBridge = (gridX <= 27 && gridY >= 27 && lineVal <= 3.5 && bridgeProgress <= 17);

    const tileScale = 2 / 3;

    if (distFromMain <= 15.3 || distFromTempleCenter <= 11.0 || (isConnectorBridge && bridgeProgress <= 14.5)) {
      return -20 * tileScale; // Prado verde elevado: -13.333px
    } else if (distFromMain <= 21.5 || distFromTempleCenter <= 15.0 || isConnectorBridge) {
      return -10 * tileScale; // Arena de playa elevada: -6.667px
    } else {
      return 0;               // Nivel del mar océano: 0px
    }
  }

  private hoverTileGraphic: Phaser.GameObjects.Graphics | null = null;

  private updateHoverTileMarker(worldX: number, worldY: number) {
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale; // ~85.333px
    const tileH = 64 * tileScale;  // ~42.667px
    const halfW = tileW / 2;       // ~42.667px
    const halfH = tileH / 2;       // ~21.333px

    const gridX = Math.round((worldX / halfW + worldY / halfH) / 2);
    const gridY = Math.round((worldY / halfH - worldX / halfW) / 2);

    const elevation = this.getTileElevation(gridX, gridY);
    const cellX = (gridX - gridY) * halfW;
    const cellY = (gridX + gridY) * halfH + elevation;

    if (!this.hoverTileGraphic) {
      this.hoverTileGraphic = this.add.graphics();
    }

    // Contorno fino refinado adaptado dinámicamente a la elevación de cada suelo
    this.hoverTileGraphic.clear();
    this.hoverTileGraphic.lineStyle(1.2, 0x38bdf8, 0.85);
    this.hoverTileGraphic.fillStyle(0x38bdf8, 0.15);

    this.hoverTileGraphic.beginPath();
    this.hoverTileGraphic.moveTo(cellX, cellY);
    this.hoverTileGraphic.lineTo(cellX + halfW, cellY + halfH);
    this.hoverTileGraphic.lineTo(cellX, cellY + tileH);
    this.hoverTileGraphic.lineTo(cellX - halfW, cellY + halfH);
    this.hoverTileGraphic.closePath();
    this.hoverTileGraphic.fillPath();
    this.hoverTileGraphic.strokePath();

    this.hoverTileGraphic.setDepth(cellY - 48);
  }

  private updateTileGridMarker(worldX: number, worldY: number): { x: number; y: number } {
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale; // ~85.333px
    const tileH = 64 * tileScale;  // ~42.667px
    const halfW = tileW / 2;       // ~42.667px
    const halfH = tileH / 2;       // ~21.333px

    const gridX = Math.round((worldX / halfW + worldY / halfH) / 2);
    const gridY = Math.round((worldY / halfH - worldX / halfW) / 2);

    const elevation = this.getTileElevation(gridX, gridY);
    const cellX = (gridX - gridY) * halfW;
    const cellY = (gridX + gridY) * halfH + elevation;
    const tileCenterY = cellY + halfH;

    if (!this.targetTileGraphic) {
      this.targetTileGraphic = this.add.graphics();
    }

    // Resaltado cian de destino adaptado dinámicamente a la elevación del suelo
    this.targetTileGraphic.clear();
    this.targetTileGraphic.lineStyle(2, 0x00f2fe, 0.95);
    this.targetTileGraphic.fillStyle(0x00f2fe, 0.3);

    this.targetTileGraphic.beginPath();
    this.targetTileGraphic.moveTo(cellX, cellY);
    this.targetTileGraphic.lineTo(cellX + halfW, cellY + halfH);
    this.targetTileGraphic.lineTo(cellX, cellY + tileH);
    this.targetTileGraphic.lineTo(cellX - halfW, cellY + halfH);
    this.targetTileGraphic.closePath();
    this.targetTileGraphic.fillPath();
    this.targetTileGraphic.strokePath();

    this.targetTileGraphic.setDepth(cellY - 50);

    return { x: cellX, y: tileCenterY };
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

      if (dist > 6 && !isBlocked) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.clickTarget.x, this.clickTarget.y);
        vx = Math.cos(angle);
        vy = Math.sin(angle);
      } else {
        // Arrived at destination tile OR blocked! Align player dead-center on tile
        if (!isBlocked) {
          this.player.setPosition(this.clickTarget.x, this.clickTarget.y);
        }
        this.clickTarget = null;
        if (this.targetTileGraphic) {
          this.targetTileGraphic.clear();
        }
      }
    }

    this.player.setVelocity(vx * speed, vy * speed);
    this.player.setFlipX(false);

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
      const walkKey = `char-${this.currentCharacterName}-walk-${currentDir}`;
      if (this.anims.exists(walkKey)) {
        this.player.play(walkKey, true);
      }
    } else {
      // Idle Stance / Reposo en las 8 direcciones
      const idleKey = `char-${this.currentCharacterName}-idle-${this.lastDirection}`;
      if (this.anims.exists(idleKey)) {
        this.player.play(idleKey, true);
      }
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

    this.updateTargetReticle();
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
        const fuerzaStat = ((window as any).characterStats?.stats?.fuerza || 0);
        const statMultiplier = 1 + (fuerzaStat * 0.001);
        const baseDmg = isCrit ? Math.round(this.playerAttackPower * 1.8) : this.playerAttackPower;
        const damage = Math.max(1, Math.round(baseDmg * statMultiplier));

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

  public calculateTotalInventoryWeight(): number {
    let totalWeight = 0;
    this.inventory.forEach(item => {
      const meta = getItemMetadata(item.id);
      const weightPerUnit = item.weight !== undefined ? item.weight : meta.weight;
      totalWeight += (weightPerUnit * (item.count || 1));
    });
    return totalWeight;
  }

  private addInventoryItem(id: string, name: string, icon: string, count: number) {
    const meta = getItemMetadata(id);
    const itemWeight = meta.weight;
    const currentWeight = this.calculateTotalInventoryWeight();
    const addedWeight = itemWeight * count;

    if (currentWeight + addedWeight > 1000) {
      this.showFloatingText(this.player.x, this.player.y - 40, '⚠️ ¡LÍMITE DE PESO EXCEDIDO (1000 kg)!', '#ef4444');
      this.showLootNotification('⚠️ Inventario lleno (Capacidad máxima de 1000 kg alcanzada)');
      return;
    }

    if (this.inventory.has(id)) {
      const existing = this.inventory.get(id)!;
      existing.count += count;
      existing.category = existing.category || meta.category;
      existing.weight = existing.weight !== undefined ? existing.weight : meta.weight;
    } else {
      this.inventory.set(id, {
        id,
        name,
        icon,
        count,
        category: meta.category,
        weight: meta.weight
      });
    }

    this.savePlayerToServer();
    this.renderInventoryHtml();
  }

  public getXpThresholdForLevel(lvl: number): number {
    if (lvl <= 1) return 0;
    let totalXp = 0;
    let req = 1000;
    for (let l = 1; l < lvl; l++) {
      totalXp += req;
      req = Math.round(req * 1.10);
    }
    return totalXp;
  }

  private gainXp(amount: number) {
    this.playerXp += amount; // Cumulative total XP!

    let leveledUp = false;
    while (this.playerLevel < 50) {
      const nextThreshold = this.getXpThresholdForLevel(this.playerLevel + 1);
      if (this.playerXp >= nextThreshold) {
        this.playerLevel++;
        this.playerMaxHp += 25;
        this.playerHp = this.playerMaxHp;
        this.playerMaxMana = 10;
        this.playerMana = 10;
        this.playerAttackPower += 8;
        leveledUp = true;

        // Otorgar +5 Puntos de Características y +1 Punto de Poder por cada nivel ganado
        if (typeof window !== 'undefined') {
          if ((window as any).characterStats) {
            const stats = (window as any).characterStats;
            stats.level = this.playerLevel;
            stats.availablePoints += 5;
            if ((window as any).updateCaracteristicasUI) {
              (window as any).updateCaracteristicasUI();
            }
          }

          if ((window as any).playerSpellsState) {
            if (typeof (window as any).syncSpellPointsWithLevel === 'function') {
              (window as any).syncSpellPointsWithLevel();
            }
            if (typeof (window as any).updatePoderesUI === 'function') {
              (window as any).updatePoderesUI();
            }
          }

          if (typeof (window as any).showLevelUpModal === 'function') {
            (window as any).showLevelUpModal(this.playerLevel);
          }
        }
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

    // 3. Cumulative Experience Bar & Tooltip Update (Muestra rango acumulado y XP faltante al pasar el mouse)
    if (bottomXpFill && bottomXpText) {
      const hudXpRow = document.getElementById('hud-xp-row');

      if (this.playerLevel >= 50) {
        bottomXpFill.style.width = '100%';
        bottomXpText.innerText = `Niv. 50 (MÁX) - ${Math.floor(this.playerXp)} XP Total`;
        if (hudXpRow) hudXpRow.title = `¡Nivel Máximo Alcanzado (Niv. 50)! (${Math.floor(this.playerXp)} XP Total)`;
      } else {
        const prevThreshold = this.getXpThresholdForLevel(this.playerLevel);
        const nextThreshold = this.getXpThresholdForLevel(this.playerLevel + 1);
        const neededInLevel = nextThreshold - prevThreshold;
        const currentInLevel = Math.max(0, this.playerXp - prevThreshold);
        const xpRemaining = Math.max(0, nextThreshold - this.playerXp);

        const pct = Math.max(0, Math.min(100, (currentInLevel / neededInLevel) * 100));
        bottomXpFill.style.width = `${pct}%`;

        const currentXpFormatted = Math.floor(this.playerXp);
        bottomXpText.innerText = `${currentXpFormatted} / ${nextThreshold} XP`;
        
        const tooltipString = `Faltan ${Math.ceil(xpRemaining)} XP para el Nivel ${this.playerLevel + 1} (${currentXpFormatted} / ${nextThreshold} XP Acumulado)`;
        if (hudXpRow) hudXpRow.title = tooltipString;
        bottomXpText.title = tooltipString;
      }
    }
  }

  private getTextureSrc(key: string): string {
    if (!key || !this.textures || !this.textures.exists(key)) return '';
    try {
      const texture = this.textures.get(key);
      if (!texture) return '';
      const image = texture.getSourceImage();
      if (!image) return '';
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
      // Safe Silent Catch
    }
    return '';
  }

  public renderInventoryHtml() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    const currentTab = (typeof window !== 'undefined' && (window as any).currentInventoryTab)
      ? (window as any).currentInventoryTab
      : 'recursos';

    // 1. Filtrar ítems pertenecientes a la pestaña activa del navegador (excluyendo monedas de oro)
    const tabItems: Array<{ id: string; name: string; count: number; category: string; weight: number }> = [];
    let totalGold = 0;

    this.inventory.forEach(item => {
      if (item.id === 'gold') {
        totalGold += (item.count || 0);
        return; // Excluir monedas de los slots normales
      }

      const meta = getItemMetadata(item.id);
      const cat = item.category || meta.category;
      if (cat === currentTab) {
        tabItems.push({
          id: item.id,
          name: item.name,
          count: item.count,
          category: cat,
          weight: item.weight !== undefined ? item.weight : meta.weight
        });
      }
    });

    // Actualizar contadores de Monedas de Aro Plateadas en Ubicación 1 (Equipo) y Ubicación 2 (Inventario)
    const equipoGoldVal = document.getElementById('equipo-gold-val');
    const invGoldVal = document.getElementById('inv-gold-val');
    if (equipoGoldVal) equipoGoldVal.innerText = totalGold.toLocaleString();
    if (invGoldVal) invGoldVal.innerText = totalGold.toLocaleString();

    grid.innerHTML = '';

    // 2. Renderizar casillas de 48x48px con ítems existentes
    tabItems.forEach(item => {
      const slot = document.createElement('div');
      slot.className = 'inv-slot-48';
      const totalItemWeight = item.weight * item.count;
      slot.title = `${item.name} | Cantidad: ${item.count} | Peso: ${totalItemWeight} kg (${item.weight} kg/u)`;

      const imgSrc = this.getTextureSrc(item.id);
      let imgHtml = '';
      if (imgSrc) {
        imgHtml = `<img src="${imgSrc}" alt="${item.name}" style="width: 32px; height: 32px; object-fit: contain;" />`;
      } else {
        imgHtml = `<span style="font-size: 10px; color: #cbd5e1; text-align: center; line-height: 1.1;">${item.name}</span>`;
      }

      slot.innerHTML = `
        ${imgHtml}
        <span class="inv-slot-count">${item.count}</span>
      `;
      grid.appendChild(slot);
    });

    // 3. Garantizar siempre como mínimo 54 casillas por pestaña (6 columnas x 9 filas)
    const baseSlots = 54; // 6 columnas x 9 filas de 48x48px
    const neededEmptySlots = Math.max(0, baseSlots - tabItems.length);

    for (let i = 0; i < neededEmptySlots; i++) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'inv-slot-48 empty';
      grid.appendChild(emptySlot);
    }

    // 4. Actualizar Barra de Peso / Capacidad Total (Compartida por todas las pestañas, Máximo 1000 kg)
    const totalWeight = this.calculateTotalInventoryWeight();
    const weightText = document.getElementById('inv-weight-text');
    const weightFill = document.getElementById('inv-weight-fill');

    if (weightText) {
      weightText.innerText = `${totalWeight} / 1000 kg`;
      weightText.style.color = totalWeight >= 900 ? '#ef4444' : (totalWeight >= 700 ? '#eab308' : '#10b981');
    }

    if (weightFill) {
      const pct = Math.min(100, (totalWeight / 1000) * 100);
      weightFill.style.width = `${pct}%`;
      if (pct >= 90) {
        weightFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
        weightFill.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.7)';
      } else if (pct >= 70) {
        weightFill.style.background = 'linear-gradient(90deg, #eab308, #f97316)';
        weightFill.style.boxShadow = '0 0 10px rgba(234, 179, 8, 0.7)';
      } else {
        weightFill.style.background = 'linear-gradient(90deg, #10b981, #06b6d4)';
        weightFill.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.7)';
      }
    }
  }
}

function getItemMetadata(id: string): { category: 'equipo' | 'recursos' | 'consumibles' | 'mision' | 'especiales'; weight: number } {
  switch (id) {
    case 'wood':
      return { category: 'recursos', weight: 5 }; // Madera / Tronco: 5 de peso por unidad
    case 'chicken_feather':
    case 'chicken_egg':
    case 'chicken_beak':
    case 'chicken_eye':
      return { category: 'recursos', weight: 1 }; // Drops de plumas, huevos, picos, ojos: Recursos, 1 de peso
    case 'apple':
      return { category: 'consumibles', weight: 1 }; // Manzana: Consumibles, 1 de peso
    case 'gold':
      return { category: 'especiales', weight: 0 }; // Oro: Especiales, 0 de peso
    default:
      if (id.startsWith('eq_') || id.startsWith('weapon_') || id.startsWith('armor_')) {
        return { category: 'equipo', weight: 1 };
      }
      if (id.startsWith('quest_')) {
        return { category: 'mision', weight: 1 };
      }
      return { category: 'recursos', weight: 1 };
  }
}

function m_fillRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillRect(x, y, w, h);
}
