import Phaser from 'phaser';

export class TempleInteriorScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private clickTarget: Phaser.Math.Vector2 | null = null;
  private currentCharacterName: string = 'espadachin';
  private lastDirection: string = 'up-left';
  private isTransitioning: boolean = false;
  private pendingExit: boolean = false;

  private exitCarpetSprite!: Phaser.GameObjects.Image;
  private exitCarpetPos: { x: number; y: number } = { x: 0, y: 0 };
  private exitLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TempleInteriorScene' });
  }

  create(data?: any) {
    this.isTransitioning = false;
    this.pendingExit = false;
    this.currentCharacterName = (window as any).selectedCharacterClass || 'espadachin';

    this.cameras.main.fadeIn(500, 0, 0, 0);

    // 1. Crear Mapa Isométrico de la Nave del Templo (3x Profundo = 10 casillas de ancho x 36 casillas de profundidad)
    this.createSanctuaryMap();

    // 2. Spawn del Personaje junto al Portón de Salida (Ubicado en el muro abajo-derecha)
    const startX = this.exitCarpetPos.x - 30;
    const startY = this.exitCarpetPos.y - 30;
    this.player = this.physics.add.sprite(startX, startY, `char-${this.currentCharacterName}-idle-up-left`);
    this.player.setOrigin(0.5, 0.8);
    this.player.setScale(0.75);
    this.player.setDepth(startY);

    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (pBody) {
      pBody.setSize(26, 18);
      pBody.setOffset(19, 66);
      pBody.setCollideWorldBounds(false);
    }

    // 3. Cámara y Controles
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Movimiento por clic en la nave del santuario
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isTransitioning) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.clickTarget = new Phaser.Math.Vector2(worldPoint.x, worldPoint.y);
    });

    // Título UI del Santuario
    this.add.text(1920 / 2, 40, '🏛️ Santuario de la Natividad — Fuente de la Vida', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#fef08a',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
  }

  private createSanctuaryMap() {
    // Reorientado: Profundidad reducida a 2/3 (24 casillas de largo) orientada hacia arriba-izquierda
    const mapWidth = 10;
    const mapHeight = 24;
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale;
    const tileH = 64 * tileScale;
    const halfW = tileW / 2;
    const halfH = tileH / 2;

    const wallGroup = this.physics.add.staticGroup();

    // Posición del portón de salida (Muro Abajo-Derecha: x = 9, y = 33)
    const exitGx = mapWidth - 1;
    const exitGy = mapHeight - 3;

    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const baseIsoX = (x - y) * halfW;
        const baseIsoY = (x + y) * halfH;

        const isExitDoor = (x === exitGx && y === exitGy);
        const isWall = (x === 0 || y === 0 || y === mapHeight - 1 || (x === mapWidth - 1 && !isExitDoor));
        const isCentralAisle = (x >= 4 && x <= 5 && y > 2 && y < mapHeight - 1);

        if (isExitDoor) {
          // Umbral de Alfombra Roja en el Portón Abajo-Derecha
          const carpet = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-carpet');
          carpet.setOrigin(0.5, 0);
          carpet.setScale(tileScale);
          carpet.setDepth(-5000 + baseIsoY);
          carpet.setInteractive({ useHandCursor: true });

          this.exitCarpetSprite = carpet;
          this.exitCarpetPos = { x: baseIsoX, y: baseIsoY + 20 };

          // Marco del Portón de Salida Abajo-Derecha
          const exitArch = this.add.graphics();
          exitArch.setPosition(baseIsoX, baseIsoY);
          exitArch.setDepth(baseIsoY + 50);
          exitArch.lineStyle(3, 0xb91c1c, 0.9);
          exitArch.fillStyle(0xef4444, 0.35);
          exitArch.strokeRect(-25, -35, 50, 45);
          exitArch.fillRect(-25, -35, 50, 45);

          // Etiqueta Emergente
          this.exitLabel = this.add.text(baseIsoX, baseIsoY - 45, '🚪 Salir a la Isla', {
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#ffffff',
            backgroundColor: 'rgba(185, 28, 28, 0.90)',
            padding: { x: 8, y: 4 }
          }).setOrigin(0.5).setDepth(baseIsoY + 100).setVisible(false);

          carpet.on('pointerover', () => {
            carpet.setTint(0xffea00);
            this.exitLabel.setVisible(true);
          });

          carpet.on('pointerout', () => {
            carpet.clearTint();
            this.exitLabel.setVisible(false);
          });

          carpet.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: any) => {
            if (event && event.stopPropagation) event.stopPropagation();
            this.clickTarget = new Phaser.Math.Vector2(baseIsoX, baseIsoY + 20);
            this.pendingExit = true;
          });

        } else if (isWall) {
          // Muro de Piedra del Santuario
          const wall = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-temple-wall');
          wall.setOrigin(0.5, 0);
          wall.setScale(tileScale);
          wall.setDepth(-5000 + baseIsoY);

          // Colisionador Estático
          const wallCol = wallGroup.create(baseIsoX, baseIsoY + 16, 'small-rock') as Phaser.Physics.Arcade.Sprite;
          wallCol.setVisible(false);
          const wBody = wallCol.body as Phaser.Physics.Arcade.StaticBody;
          if (wBody) {
            wBody.setSize(70, 35);
            wBody.setOffset(29, 24);
          }
          wallCol.refreshBody();

        } else if (isCentralAisle) {
          // Pasillo Central de Alfombra Imperial Roja
          const carpet = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-carpet');
          carpet.setOrigin(0.5, 0);
          carpet.setScale(tileScale);
          carpet.setDepth(-5000 + baseIsoY);
        } else {
          // Suelo de Madera Pulida del Santuario
          const floor = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-wood');
          floor.setOrigin(0.5, 0);
          floor.setScale(tileScale);
          floor.setDepth(-5000 + baseIsoY);
        }

        // Columnas y Antorchas Místicas a los Lados del Pasillo Central
        if (!isWall && (x === 2 || x === 7) && y % 5 === 0 && y > 3 && y < mapHeight - 3) {
          const torch = this.add.circle(baseIsoX, baseIsoY, 6, 0xf59e0b, 0.8);
          torch.setDepth(baseIsoY + 10);
          this.tweens.add({
            targets: torch,
            alpha: 0.35,
            scale: 1.4,
            duration: 400 + (x * 50),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // ⛲ FUENTE SAGRADA DE LA NATIVIDAD Y HAZ DE LUZ DIVINO (DIRECTIONAL LIGHT)
    // -------------------------------------------------------------------------
    const fountainGx = 4;
    const fountainGy = 2;
    const fountainX = (fountainGx - fountainGy) * halfW;
    const fountainY = (fountainGx + fountainGy) * halfH - 13.333;

    // 1. Estanque Base de Mármol de la Fuente
    const fountainBase = this.add.graphics();
    fountainBase.setPosition(fountainX, fountainY);
    fountainBase.setDepth(fountainY - 10);

    // Mármol Exterior
    fountainBase.fillStyle(0xf8fafc, 1);
    fountainBase.lineStyle(3, 0xcbd5e1, 1);
    fountainBase.fillEllipse(0, 0, 110, 55);
    fountainBase.strokeEllipse(0, 0, 110, 55);

    // Estanque de Agua Cristalina Sagrada
    fountainBase.fillStyle(0x0284c7, 0.95);
    fountainBase.fillEllipse(0, 0, 92, 44);
    fountainBase.fillStyle(0x38bdf8, 0.85);
    fountainBase.fillEllipse(0, 0, 76, 36);

    // 2. Pedestal Esculpido y Copa Superior
    const pedestal = this.add.graphics();
    pedestal.setPosition(fountainX, fountainY);
    pedestal.setDepth(fountainY + 15);

    // Pilar de Mármol
    pedestal.fillStyle(0xe2e8f0, 1);
    pedestal.fillRect(-12, -45, 24, 45);
    pedestal.fillStyle(0xffffff, 1);
    pedestal.fillRect(-8, -45, 6, 45);

    // Copa Superior rebosando agua
    pedestal.fillStyle(0xf8fafc, 1);
    pedestal.lineStyle(2, 0x94a3b8, 1);
    pedestal.fillEllipse(0, -45, 54, 26);
    pedestal.strokeEllipse(0, -45, 54, 26);

    pedestal.fillStyle(0x38bdf8, 0.9);
    pedestal.fillEllipse(0, -45, 42, 18);

    // Cascadas de Agua Cayendo
    const cascadeLeft = this.add.rectangle(fountainX - 16, fountainY - 25, 5, 25, 0x7dd3fc, 0.85);
    const cascadeRight = this.add.rectangle(fountainX + 16, fountainY - 25, 5, 25, 0x7dd3fc, 0.85);
    cascadeLeft.setDepth(fountainY + 20);
    cascadeRight.setDepth(fountainY + 20);

    this.tweens.add({
      targets: [cascadeLeft, cascadeRight],
      alpha: 0.4,
      duration: 350,
      yoyo: true,
      repeat: -1
    });

    // Orbe/Cristal de Vida Dorado Flotante (Donde nacen los nuevos personajes)
    const lifeOrb = this.add.circle(fountainX, fountainY - 68, 11, 0xfbbf24, 0.95);
    lifeOrb.setDepth(fountainY + 30);

    this.tweens.add({
      targets: lifeOrb,
      y: fountainY - 76,
      scale: 1.2,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Etiqueta Flotante sobre la Fuente de la Vida
    this.add.text(fountainX, fountainY - 105, '✨ Fuente de la Natividad (Nacimiento)', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#fef08a',
      backgroundColor: 'rgba(15, 23, 42, 0.90)',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(fountainY + 100);

    // -------------------------------------------------------------------------
    // ☀️ HAZ DE LUZ DIVINO DE DIRECCIÓN (DIRECTIONAL LIGHT BEAM)
    // -------------------------------------------------------------------------
    const lightBeam = this.add.graphics();
    lightBeam.setDepth(fountainY + 200);

    // Polígono Trapezoidal del Haz de Luz Proyectado desde el Rosedal Superior hasta la Fuente
    const sourceLeftX = fountainX - 140;
    const sourceRightX = fountainX - 40;
    const sourceY = fountainY - 450;

    const targetLeftX = fountainX - 55;
    const targetRightX = fountainX + 55;
    const targetY = fountainY + 20;

    lightBeam.fillStyle(0xfef08a, 0.18);
    lightBeam.beginPath();
    lightBeam.moveTo(sourceLeftX, sourceY);
    lightBeam.lineTo(sourceRightX, sourceY);
    lightBeam.lineTo(targetRightX, targetY);
    lightBeam.lineTo(targetLeftX, targetY);
    lightBeam.closePath();
    lightBeam.fillPath();

    // Núcleo Intenso del Haz de Luz Divina (Directional Light Core)
    lightBeam.fillStyle(0xffffff, 0.22);
    lightBeam.beginPath();
    lightBeam.moveTo(sourceLeftX + 25, sourceY);
    lightBeam.lineTo(sourceRightX - 25, sourceY);
    lightBeam.lineTo(targetRightX - 20, targetY);
    lightBeam.lineTo(targetLeftX + 20, targetY);
    lightBeam.closePath();
    lightBeam.fillPath();

    // Animación Mística del Haz de Luz Celestial (Directional Light Pulse)
    this.tweens.add({
      targets: lightBeam,
      alpha: 0.65,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Partículas de Motes de Luz Flotando en el Haz Divino
    for (let i = 0; i < 30; i++) {
      const px = fountainX + Phaser.Math.Between(-60, 60);
      const py = fountainY + Phaser.Math.Between(-300, 20);
      const mote = this.add.circle(px, py, Phaser.Math.Between(2, 4.5), 0xfffbeb, 0.85);
      mote.setDepth(fountainY + 250);

      this.tweens.add({
        targets: mote,
        y: py - Phaser.Math.Between(40, 100),
        x: px + Phaser.Math.Between(-20, 20),
        alpha: 0.1,
        duration: Phaser.Math.Between(1800, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  update(_time: number, _delta: number) {
    if (this.isTransitioning) return;

    this.handlePlayerMovement();
    this.checkExitTrigger();
  }

  private handlePlayerMovement() {
    let vx = 0;
    let vy = 0;

    if (this.cursors) {
      if (this.cursors.left.isDown || this.wasd?.A?.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.wasd?.D?.isDown) vx += 1;
      if (this.cursors.up.isDown || this.wasd?.W?.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.wasd?.S?.isDown) vy += 1;
    }

    if (vx !== 0 || vy !== 0) {
      this.clickTarget = null;
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len;
      vy /= len;
    } else if (this.clickTarget) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.clickTarget.x, this.clickTarget.y);
      if (dist > 12) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.clickTarget.x, this.clickTarget.y);
        vx = Math.cos(angle);
        vy = Math.sin(angle);
      } else {
        this.player.setPosition(this.clickTarget.x, this.clickTarget.y);
        this.clickTarget = null;
      }
    }

    const speed = 210;
    this.player.setVelocity(vx * speed, vy * speed);
    this.player.setDepth(this.player.y);

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
      const idleKey = `char-${this.currentCharacterName}-idle-${this.lastDirection}`;
      if (this.anims.exists(idleKey)) {
        this.player.play(idleKey, true);
      }
    }
  }

  private checkExitTrigger() {
    const distToExit = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitCarpetPos.x, this.exitCarpetPos.y);

    if ((this.pendingExit || distToExit < 24) && !this.isTransitioning) {
      if (distToExit < 32) {
        this.isTransitioning = true;
        this.player.setVelocity(0, 0);

        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.time.delayedCall(500, () => {
          this.scene.start('GameScene', { fromTempleInterior: true });
        });
      }
    }
  }
}
