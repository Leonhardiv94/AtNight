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
    const activeData = (function() {
      try {
        const raw = localStorage.getItem('atnight_active_char_data');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    })() || {
      characterName: (window as any).selectedCharacterName || localStorage.getItem('atnight_active_char') || 'Arquera',
      characterClass: (window as any).selectedCharacterClass || 'arquero',
      gender: 'femenino',
      skinColor: '#f5c6a5',
      hairColor: '#451a03',
      outfitColor: '#16a34a'
    };

    this.currentCharacterName = activeData.characterName || (window as any).selectedCharacterClass || 'Arquera';

    this.cameras.main.fadeIn(500, 0, 0, 0);

    // 1. Crear Mapa Isométrico de la Nave del Templo (3x Profundo = 10 casillas de ancho x 36 casillas de profundidad)
    this.createSanctuaryMap();

    // 2. Spawn del Personaje: Si es personaje nuevo o resucitado tras morir, nace en la Tina Sagrada; si entra por la puerta, nace junto al umbral de salida
    const isBirthOrRespawn = data?.isRespawn || data?.isNewCharacter || !data?.fromTempleDoor;
    
    // Coordenadas exactas de la Tina Sagrada de Nacimiento
    const fountainScale = 2 / 3;
    const tileW = 128 * fountainScale;
    const halfW = tileW / 2;
    const halfH = (64 * fountainScale) / 2;
    const fountainGx = 2.5;
    const fountainGy = 4.5;
    const fountainX = (fountainGx - fountainGy) * halfW;
    const fountainY = (fountainGx + fountainGy) * halfH - 13.333;

    let startX = this.exitCarpetPos.x - 30;
    let startY = this.exitCarpetPos.y - 30;
    let initialDir = 'up-left';

    if (isBirthOrRespawn) {
      startX = fountainX;
      startY = fountainY + 20;
      initialDir = 'down-right';
    }

    this.lastDirection = initialDir;

    // Cargar clave de textura válida (evitando claves de animación que provocan cuadros negros)
    let initialTexture = `char-${this.currentCharacterName}-${initialDir}-0`;
    if (!this.textures.exists(initialTexture)) {
      initialTexture = `char-${this.currentCharacterName}-down-0`;
    }
    if (!this.textures.exists(initialTexture)) {
      initialTexture = 'espadachin_male_hd';
    }

    this.player = this.physics.add.sprite(startX, startY, initialTexture);
    this.player.setOrigin(0.5, 0.8);
    this.player.setScale(0.75);
    this.player.setDepth(startY);

    const idleKey = `char-${this.currentCharacterName}-idle-${initialDir}`;
    if (this.anims.exists(idleKey)) {
      this.player.play(idleKey, true);
    }

    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (pBody) {
      pBody.setSize(26, 18);
      pBody.setOffset(19, 66);
      pBody.setCollideWorldBounds(false);
    }

    // Efecto de Explosión de Luz Dorada y Cartel de Nacimiento/Resurrección si nace en la Tina
    if (isBirthOrRespawn) {
      const bannerText = data?.isRespawn 
        ? '✨ ¡Has Resucitado en la Tina Sagrada de la Natividad!'
        : '✨ ¡Bienvenido! Has Nacido en la Tina Sagrada de la Natividad';

      const banner = this.add.text(fountainX, fountainY - 80, bannerText, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#fef08a',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setDepth(fountainY + 300);

      this.tweens.add({
        targets: banner,
        y: fountainY - 110,
        alpha: 0,
        duration: 3500,
        delay: 1000,
        onComplete: () => banner.destroy()
      });

      // Partículas de nacimiento girando alrededor del cuerpo del personaje
      for (let i = 0; i < 40; i++) {
        const p = this.add.circle(fountainX + Phaser.Math.Between(-30, 30), fountainY + Phaser.Math.Between(-15, 15), Phaser.Math.Between(2, 5), 0xfbbf24, 0.9);
        p.setDepth(fountainY + 100);
        this.tweens.add({
          targets: p,
          y: fountainY - Phaser.Math.Between(40, 100),
          alpha: 0,
          scale: 0.2,
          duration: Phaser.Math.Between(800, 2000),
          onComplete: () => p.destroy()
        });
      }
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
    // Trasposición del Mapa: Profundidad de 24 casillas orientada hacia ARRIBA-IZQUIERDA (En la caja dibujada por el usuario)
    const mapWidth = 24;
    const mapHeight = 10;
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale;
    const tileH = 64 * tileScale;
    const halfW = tileW / 2;
    const halfH = tileH / 2;

    const wallGroup = this.physics.add.staticGroup();

    // Posición del portón de salida (Mantenido en el umbral sin mover la alfombra)
    const exitGx = mapWidth - 1;
    const exitGy = 5;

    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const baseIsoX = (x - y) * halfW;
        const baseIsoY = (x + y) * halfH;

        const isExitDoor = (x === exitGx && y === 5);
        const isWall = (x === 0 || y === 0 || y === mapHeight - 1 || (x === mapWidth - 1 && !isExitDoor));

        if (isExitDoor) {
          // ÚNICA Alfombra Pequeña de Salida en el Portón Abajo-Derecha
          const carpet = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-carpet');
          carpet.setOrigin(0.5, 0);
          carpet.setScale(tileScale);
          carpet.setDepth(-5000 + baseIsoY);
          carpet.setInteractive({ useHandCursor: true });

          this.exitCarpetSprite = carpet;
          this.exitCarpetPos = { x: baseIsoX, y: baseIsoY + 20 };

          // Etiqueta Emergente al pasar el ratón por el umbral de salida
          this.exitLabel = this.add.text(baseIsoX, baseIsoY - 35, '🚪 Salir a la Isla', {
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

        } else {
          // Suelo de Madera Pulida Descubierto del Santuario (100% Madera sin pasillos de alfombra)
          const floor = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-wood');
          floor.setOrigin(0.5, 0);
          floor.setScale(tileScale);
          floor.setDepth(-5000 + baseIsoY);
        }

        // Columnas y Antorchas Místicas a los Lados del Pasillo Central
        if (!isWall && (y === 2 || y === 7) && x % 4 === 0 && x > 2 && x < mapWidth - 2) {
          const torch = this.add.circle(baseIsoX, baseIsoY, 6, 0xf59e0b, 0.8);
          torch.setDepth(baseIsoY + 10);
          this.tweens.add({
            targets: torch,
            alpha: 0.35,
            scale: 1.4,
            duration: 400 + (y * 50),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // ⛲ TINA SAGRADA GRANDE DE BAUTISMO (BAUTISTERIO) Y HAZ DE LUZ DIVINO
    // -------------------------------------------------------------------------
    const fountainGx = 2.5;
    const fountainGy = 4.5; // Exactamente equidistante entre el muro izquierdo (y=0) y el derecho (y=9)
    const fountainX = (fountainGx - fountainGy) * halfW; // -85.333px (Centro exacto del pasillo)
    const fountainY = (fountainGx + fountainGy) * halfH - 13.333;

    // 1. Tina Sagrada Grande de Mármol Blanco Esculpido
    const tubBase = this.add.graphics();
    tubBase.setPosition(fountainX, fountainY);
    tubBase.setDepth(fountainY - 10);

    // Borde Exterior de la Tina (Mármol Blanco con Bisel Dorado)
    tubBase.fillStyle(0xf8fafc, 1);
    tubBase.lineStyle(4, 0xfbbf24, 0.95);
    tubBase.fillEllipse(0, 0, 150, 75);
    tubBase.strokeEllipse(0, 0, 150, 75);

    // Pared Interior de la Tina
    tubBase.fillStyle(0xe2e8f0, 1);
    tubBase.lineStyle(2, 0xcbd5e1, 1);
    tubBase.fillEllipse(0, 2, 134, 65);
    tubBase.strokeEllipse(0, 2, 134, 65);

    // Estanque de Agua Cristalina Sagrada (Profundo)
    tubBase.fillStyle(0x0284c7, 0.95);
    tubBase.fillEllipse(0, 4, 120, 56);
    tubBase.fillStyle(0x38bdf8, 0.85);
    tubBase.fillEllipse(0, 6, 100, 46);
    tubBase.fillStyle(0x7dd3fc, 0.70);
    tubBase.fillEllipse(0, 8, 80, 36);

    // Olas y Ondulaciones del Agua Cristalina dentro de la Tina
    const ripples = this.add.graphics();
    ripples.setPosition(fountainX, fountainY);
    ripples.setDepth(fountainY + 5);

    ripples.lineStyle(1.8, 0xffffff, 0.75);
    ripples.strokeEllipse(0, 6, 90, 40);
    ripples.strokeEllipse(0, 6, 50, 22);

    this.tweens.add({
      targets: ripples,
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: 0.25,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Orbe/Cristal de Vida Dorado Flotante dentro de la Tina (Lugar de Nacimiento)
    const lifeOrb = this.add.circle(fountainX, fountainY - 18, 14, 0xfbbf24, 0.95);
    lifeOrb.setDepth(fountainY + 30);

    const lifeOrbInner = this.add.circle(fountainX, fountainY - 18, 8, 0xffffff, 1);
    lifeOrbInner.setDepth(fountainY + 31);

    this.tweens.add({
      targets: [lifeOrb, lifeOrbInner],
      y: fountainY - 28,
      scale: 1.25,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // -------------------------------------------------------------------------
    // ☀️ HAZ DE LUZ DIVINO DE DIRECCIÓN APUNTANDO A LA TINA (DIRECTIONAL LIGHT)
    // -------------------------------------------------------------------------
    const lightBeam = this.add.graphics();
    lightBeam.setDepth(fountainY + 200);

    // Polígono Trapezoidal del Haz de Luz Celestial Proyectado desde el Rosedal
    const sourceLeftX = fountainX - 120;
    const sourceRightX = fountainX - 20;
    const sourceY = fountainY - 480;

    const targetLeftX = fountainX - 75;
    const targetRightX = fountainX + 75;
    const targetY = fountainY + 30;

    lightBeam.fillStyle(0xfef08a, 0.20);
    lightBeam.beginPath();
    lightBeam.moveTo(sourceLeftX, sourceY);
    lightBeam.lineTo(sourceRightX, sourceY);
    lightBeam.lineTo(targetRightX, targetY);
    lightBeam.lineTo(targetLeftX, targetY);
    lightBeam.closePath();
    lightBeam.fillPath();

    // Núcleo Blanco Puro Intenso del Haz (Directional Light Core)
    lightBeam.fillStyle(0xffffff, 0.28);
    lightBeam.beginPath();
    lightBeam.moveTo(sourceLeftX + 25, sourceY);
    lightBeam.lineTo(sourceRightX - 25, sourceY);
    lightBeam.lineTo(targetRightX - 25, targetY);
    lightBeam.lineTo(targetLeftX + 25, targetY);
    lightBeam.closePath();
    lightBeam.fillPath();

    // Animación Mística del Haz de Luz Celestial
    this.tweens.add({
      targets: lightBeam,
      alpha: 0.70,
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Partículas de Motes de Luz Flotando en el Haz Divino sobre la Tina
    for (let i = 0; i < 35; i++) {
      const px = fountainX + Phaser.Math.Between(-70, 70);
      const py = fountainY + Phaser.Math.Between(-320, 30);
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
