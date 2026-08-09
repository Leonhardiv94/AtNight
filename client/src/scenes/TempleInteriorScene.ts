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
  private lastDirection: string = 'down';
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

    // 1. Build Isometric Sanctuary Interior Map (10x12 Hall Grid)
    this.createSanctuaryMap();

    // 2. Spawn Player at Sanctuary Entrance
    const startX = this.exitCarpetPos.x;
    const startY = this.exitCarpetPos.y - 40;
    this.player = this.physics.add.sprite(startX, startY, `char-${this.currentCharacterName}-idle-up`);
    this.player.setOrigin(0.5, 0.8);
    this.player.setScale(0.75);
    this.player.setDepth(startY);

    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (pBody) {
      pBody.setSize(26, 18);
      pBody.setOffset(19, 66);
      pBody.setCollideWorldBounds(true);
    }

    // 3. Camera Follow & Controls
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

    // Click to move inside Sanctuary
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isTransitioning) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.clickTarget = new Phaser.Math.Vector2(worldPoint.x, worldPoint.y);
    });

    // Ambient Floating Mystic Light Particles
    for (let i = 0; i < 15; i++) {
      const px = startX + Phaser.Math.Between(-300, 300);
      const py = startY + Phaser.Math.Between(-400, 100);
      const spark = this.add.circle(px, py, Phaser.Math.Between(2, 4), 0xfef08a, 0.6);
      spark.setDepth(py + 50);
      this.tweens.add({
        targets: spark,
        y: py - Phaser.Math.Between(30, 70),
        alpha: 0.1,
        duration: Phaser.Math.Between(2000, 4500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // Ambient UI Header Text
    const titleText = this.add.text(1920 / 2, 40, '🏛️ Santuario de la Natividad', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#fef08a',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
  }

  private createSanctuaryMap() {
    const mapWidth = 10;
    const mapHeight = 12;
    const tileScale = 2 / 3;
    const tileW = 128 * tileScale;
    const tileH = 64 * tileScale;

    const mapGroup = this.add.group();
    const wallGroup = this.physics.add.staticGroup();

    // Center sanctuary hall
    const centerX = 0;
    const centerY = 0;

    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const baseIsoX = (x - y) * (tileW / 2);
        const baseIsoY = (x + y) * (tileH / 2);

        const isWall = (x === 0 || y === 0 || x === mapWidth - 1 || (y === mapHeight - 1 && x !== 5));
        const isExitCarpet = (y === mapHeight - 1 && x === 5);

        if (isExitCarpet) {
          // Carpet Tile at Entrance Threshold
          const carpet = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-carpet');
          carpet.setOrigin(0.5, 0);
          carpet.setScale(tileScale);
          carpet.setDepth(-5000 + baseIsoY);
          carpet.setInteractive({ useHandCursor: true });

          this.exitCarpetSprite = carpet;
          this.exitCarpetPos = { x: baseIsoX, y: baseIsoY + 20 };

          // Label Floating over Exit Carpet
          this.exitLabel = this.add.text(baseIsoX, baseIsoY - 15, '🚪 Salir a la Isla', {
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: '#ffffff',
            backgroundColor: 'rgba(185, 28, 28, 0.85)',
            padding: { x: 8, y: 4 }
          }).setOrigin(0.5).setDepth(baseIsoY + 100).setVisible(false);

          // Carpet Hover & Click Interaction
          carpet.on('pointerover', () => {
            carpet.setTint(0xffea00);
            this.exitLabel.setVisible(true);
          });

          carpet.on('pointerout', () => {
            carpet.clearTint();
            this.exitLabel.setVisible(false);
          });

          carpet.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: any) => {
            event.stopPropagation();
            this.clickTarget = new Phaser.Math.Vector2(baseIsoX, baseIsoY + 20);
            this.pendingExit = true;
          });

        } else if (isWall) {
          // Stone Wall Perimeter Tile
          const wall = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-temple-wall');
          wall.setOrigin(0.5, 0);
          wall.setScale(tileScale);
          wall.setDepth(-5000 + baseIsoY);

          // Wall Static Physics Body
          const wallCol = wallGroup.create(baseIsoX, baseIsoY + 16, 'small-rock') as Phaser.Physics.Arcade.Sprite;
          wallCol.setVisible(false);
          const wBody = wallCol.body as Phaser.Physics.Arcade.StaticBody;
          if (wBody) {
            wBody.setSize(70, 35);
            wBody.setOffset(29, 24);
          }
          wallCol.refreshBody();

        } else {
          // Polished Hardwood Sanctuary Floor
          const floor = this.add.image(baseIsoX, baseIsoY - 13.333, 'tile-wood');
          floor.setOrigin(0.5, 0);
          floor.setScale(tileScale);
          floor.setDepth(-5000 + baseIsoY);
        }
      }
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
