import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
  }

  create() {
    // Generate clean procedural high-definition HD textures
    this.createProceduralTextures();
    this.scene.start('GameScene');
  }

  private createProceduralTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // 1. Isometric Grass Tile with 3D Cliff Wall (Bright Daytime HD 128x84)
    graphics.clear();
    graphics.fillStyle(0x3f2212, 1);
    graphics.beginPath();
    graphics.moveTo(0, 32);
    graphics.lineTo(64, 64);
    graphics.lineTo(64, 84);
    graphics.lineTo(0, 52);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0x27140a, 1);
    graphics.beginPath();
    graphics.moveTo(64, 64);
    graphics.lineTo(128, 32);
    graphics.lineTo(128, 52);
    graphics.lineTo(64, 84);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0x1b4d2e, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);
    graphics.fillStyle(0x2d8a4e, 1);
    graphics.fillTriangle(64, 2, 124, 32, 64, 62);
    graphics.fillTriangle(64, 2, 4, 32, 64, 62);

    graphics.fillStyle(0x52b788, 0.85);
    graphics.fillRect(40, 20, 3, 6);
    graphics.fillRect(80, 28, 4, 7);
    graphics.fillRect(56, 38, 3, 6);
    graphics.fillRect(72, 14, 3, 5);

    graphics.generateTexture('tile-grass', 128, 84);

    // 2. Isometric Shoreline Sand Tile with 3D Sand Wall & Rich Sand Texture (Bright Daytime HD 128x76)
    graphics.clear();
    graphics.fillStyle(0xb39868, 1);
    graphics.beginPath();
    graphics.moveTo(0, 32);
    graphics.lineTo(64, 64);
    graphics.lineTo(64, 76);
    graphics.lineTo(0, 44);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0x8a7249, 1);
    graphics.beginPath();
    graphics.moveTo(64, 64);
    graphics.lineTo(128, 32);
    graphics.lineTo(128, 44);
    graphics.lineTo(64, 76);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0xd4b886, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);
    graphics.fillStyle(0xf5e6c8, 1);
    graphics.fillTriangle(64, 2, 124, 32, 64, 62);
    graphics.fillTriangle(64, 2, 4, 32, 64, 62);

    // --- BEACH SAND TEXTURE, RIPPLES & DETAILS ---

    // 1. Soft Dune Ripple Lines (Ondulaciones de arena de playa)
    graphics.lineStyle(1.5, 0xdfc494, 0.65);
    graphics.beginPath();
    graphics.moveTo(30, 20);
    graphics.lineTo(50, 25);
    graphics.lineTo(75, 22);
    graphics.strokePath();

    graphics.lineStyle(1.5, 0xcfa970, 0.5);
    graphics.beginPath();
    graphics.moveTo(48, 34);
    graphics.lineTo(70, 40);
    graphics.lineTo(95, 36);
    graphics.strokePath();

    graphics.lineStyle(1, 0xfff4d6, 0.7);
    graphics.beginPath();
    graphics.moveTo(25, 32);
    graphics.lineTo(45, 36);
    graphics.lineTo(65, 34);
    graphics.strokePath();

    // 2. Sand Grains (Grano y texturizado de arena disperso)
    const sandGrains = [
      { x: 42, y: 15, color: 0xcfa970, size: 2 },
      { x: 78, y: 18, color: 0xfff4d6, size: 2.5 },
      { x: 34, y: 28, color: 0xb3945b, size: 2 },
      { x: 62, y: 24, color: 0xe6cd9c, size: 3 },
      { x: 88, y: 28, color: 0xcfa970, size: 2 },
      { x: 50, y: 44, color: 0xfff4d6, size: 2.5 },
      { x: 74, y: 40, color: 0xb3945b, size: 2 },
      { x: 96, y: 46, color: 0xe6cd9c, size: 2 },
      { x: 30, y: 40, color: 0xcfa970, size: 2 },
      { x: 64, y: 52, color: 0xfff4d6, size: 3 },
      { x: 80, y: 50, color: 0xb3945b, size: 2 },
      { x: 20, y: 24, color: 0xe6cd9c, size: 2 },
    ];

    sandGrains.forEach(g => {
      graphics.fillStyle(g.color, 0.85);
      graphics.fillRect(g.x, g.y, g.size, g.size);
    });

    // 3. Tiny Beach Seashells & Golden Pebbles (Conchitas y piedritas de playa)
    graphics.fillStyle(0xffedd5, 0.95);
    graphics.fillCircle(54, 18, 2.5);
    graphics.fillStyle(0xfb7185, 0.7);
    graphics.fillRect(53, 18, 2, 1);

    graphics.fillStyle(0xfde047, 0.9);
    graphics.fillCircle(82, 34, 2);

    graphics.fillStyle(0x94a3b8, 0.85);
    graphics.fillEllipse(40, 48, 4, 2.5);

    graphics.generateTexture('tile-sand', 128, 76);

    // 3. Isometric Ocean Water Tile (Bright Daytime HD 128x64)
    graphics.clear();
    graphics.fillStyle(0x0f5257, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);
    graphics.fillStyle(0x0b7a75, 1);
    graphics.fillTriangle(64, 2, 124, 32, 64, 62);
    graphics.fillTriangle(64, 2, 4, 32, 64, 62);
    graphics.lineStyle(2, 0x70e4ef, 0.7);
    graphics.beginPath();
    graphics.moveTo(32, 16);
    graphics.lineTo(64, 8);
    graphics.lineTo(96, 16);
    graphics.strokePath();
    graphics.generateTexture('tile-water', 128, 64);

    // 4. Male Swordsman / Espadachín Hombre (HD Hand-Painted Style - Athletic Build, Medieval Blue Tunic, Unarmed, 8 Directions x 4 Frames)
    const directions = ['down', 'up', 'right', 'left', 'down-right', 'down-left', 'up-right', 'up-left'];

    directions.forEach(dir => {
      for (let frame = 0; frame < 4; frame++) {
        graphics.clear();

        let legStep = 0;
        let armPendulumX = 0;
        let armPendulumY = 0;

        // Frame 0: Reposo / Static Idle Mode (Respiración natural)
        if (frame === 0) {
          legStep = 0;
          armPendulumX = 0;
          armPendulumY = 0;
        } else if (frame === 1) {
          legStep = -7;
          armPendulumX = 8;  // Arm Swing Forward
          armPendulumY = -2;
        } else if (frame === 2) {
          legStep = 0;
          armPendulumX = 0;
          armPendulumY = 1;  // Mid-stride vertical bounce
        } else if (frame === 3) {
          legStep = 7;
          armPendulumX = -8; // Arm Swing Backward
          armPendulumY = 2;
        }

        // Shadow Base (Sombra proyectada en el suelo)
        graphics.fillStyle(0x000000, 0.35);
        graphics.fillEllipse(32, 104, 46, 14);

        const isSide = dir.includes('left') || dir.includes('right');
        const isLeft = dir.includes('left');

        // ----------------------------------------------------
        // 1. LEGS & LEATHER COMBAT BOOTS (Pantalones Marrones + Botas de Cuero)
        // ----------------------------------------------------
        if (isSide) {
          const backX = 32 - (isLeft ? -legStep : legStep);
          const frontX = 32 + (isLeft ? -legStep : legStep);

          // A. BACK LEG (Pantalón de Cuero Marrón #78350f)
          graphics.fillStyle(0x5c2c16, 1);
          graphics.fillEllipse(backX, 68, 10, 20);
          graphics.fillStyle(0x292524, 1); // Bota de Cuero Oscuro
          graphics.fillRect(backX - 4, 84, 8, 8);
          graphics.fillRect(isLeft ? backX : backX - 6, 90, 6, 7);
          graphics.fillRect(isLeft ? backX - 7 : backX - 1, 90, 8, 7);

          // B. FRONT LEG (Atláta Musculoso, Pantalón Marrón #78350f)
          graphics.fillStyle(0x78350f, 1);
          graphics.fillEllipse(frontX, 68, 11, 20);
          graphics.fillStyle(0x5c2c16, 1);
          graphics.fillCircle(frontX, 75, 4.5);

          // Botas de Combate con Dobladillo y Cordones
          graphics.fillStyle(0x292524, 1);
          graphics.fillRect(frontX - 5, 84, 10, 8);
          graphics.fillStyle(0x44403c, 1); // Dobladillo
          graphics.fillRect(frontX - 6, 83, 12, 3);

          // Talón y Suela
          graphics.fillStyle(0x1c1917, 1);
          graphics.fillRect(isLeft ? frontX + 1 : frontX - 7, 90, 6, 7);
          graphics.fillStyle(0x292524, 1);
          graphics.fillRect(isLeft ? frontX - 7 : frontX - 1, 90, 8, 7);

          // Cordones de las Botas
          graphics.lineStyle(1, 0xa8a29e, 0.8);
          graphics.beginPath();
          graphics.moveTo(frontX - 2, 85); graphics.lineTo(frontX - 2, 92);
          graphics.moveTo(frontX + 2, 85); graphics.lineTo(frontX + 2, 92);
          graphics.strokePath();

        } else {
          // FRONT / BACK VIEW LEGS
          const leftX = 22;
          const rightX = 42;
          const leftY = 66 + legStep;
          const rightY = 66 - legStep;

          graphics.fillStyle(0x78350f, 1);
          graphics.fillEllipse(leftX, leftY, 11, 18);
          graphics.fillEllipse(rightX, rightY, 11, 18);

          graphics.fillStyle(0x5c2c16, 1);
          graphics.fillEllipse(leftX, leftY + 9, 11, 6);
          graphics.fillEllipse(rightX, rightY + 9, 11, 6);

          graphics.fillStyle(0x292524, 1);
          graphics.fillRect(leftX - 5, leftY + 18, 10, 10);
          graphics.fillRect(rightX - 5, rightY + 18, 10, 10);

          graphics.fillStyle(0x44403c, 1);
          graphics.fillRect(leftX - 6, leftY + 17, 12, 3);
          graphics.fillRect(rightX - 6, rightY + 17, 12, 3);

          graphics.lineStyle(1, 0xa8a29e, 0.8);
          graphics.beginPath();
          graphics.moveTo(leftX, leftY + 19); graphics.lineTo(leftX, leftY + 26);
          graphics.moveTo(rightX, rightY + 19); graphics.lineTo(rightX, rightY + 26);
          graphics.strokePath();
        }

        // ----------------------------------------------------
        // 2. TORSO & TÚNICA MEDIEVAL NOBLE BORDADA (Azul Real #1d4ed8)
        // ----------------------------------------------------
        if (dir === 'down' || dir === 'down-left' || dir === 'down-right') {
          // Torso Masculino Fornido / Hombros Anchos V-Taper
          graphics.fillStyle(0x1d4ed8, 1); // Túnica Azul Real
          graphics.beginPath();
          graphics.moveTo(16, 36);
          graphics.lineTo(48, 36);
          graphics.lineTo(43, 64);
          graphics.lineTo(21, 64);
          graphics.closePath();
          graphics.fillPath();

          // Bordado de Plata/Gris en el Cuello y Falda de la Túnica
          graphics.lineStyle(2, 0xe2e8f0, 0.95);
          graphics.beginPath();
          graphics.moveTo(21, 63); graphics.lineTo(43, 63); // Ribete inferior
          graphics.moveTo(32, 40); graphics.lineTo(32, 63); // Costura central
          graphics.strokePath();

          // Hombreras de Cuero con Anclajes de Bronce
          graphics.fillStyle(0x78350f, 1);
          graphics.fillRect(13, 34, 7, 12);
          graphics.fillRect(44, 34, 7, 12);
          graphics.fillStyle(0xfbbf24, 1);
          graphics.fillRect(15, 38, 3, 3);
          graphics.fillRect(46, 38, 3, 3);

          // Cinturón de Cuero Marrón con Hebilla de León Dorado
          graphics.fillStyle(0x451a03, 1);
          graphics.fillRect(20, 52, 24, 6);
          graphics.fillRect(34, 58, 4, 8); // Correa colgante
          graphics.fillStyle(0xfbbf24, 1); // Hebilla de León
          graphics.fillRect(28, 51, 8, 8);
          graphics.fillStyle(0xd97706, 1);
          graphics.fillRect(30, 53, 4, 4);

          // Blasón Heraldico del León Dorado en el Pecho
          graphics.fillStyle(0x1e3a8a, 1);
          graphics.beginPath();
          graphics.moveTo(28, 40); graphics.lineTo(36, 40); graphics.lineTo(36, 47); graphics.lineTo(32, 50); graphics.lineTo(28, 47);
          graphics.closePath();
          graphics.fillPath();
          graphics.fillStyle(0xfbbf24, 1);
          graphics.fillCircle(32, 44, 2.5);

        } else if (dir === 'up' || dir === 'up-left' || dir === 'up-right') {
          // Espalda de la Túnica Noble
          graphics.fillStyle(0x1d4ed8, 1);
          graphics.beginPath();
          graphics.moveTo(16, 36);
          graphics.lineTo(48, 36);
          graphics.lineTo(43, 64);
          graphics.lineTo(21, 64);
          graphics.closePath();
          graphics.fillPath();

          graphics.lineStyle(2, 0xe2e8f0, 0.95);
          graphics.beginPath();
          graphics.moveTo(21, 63); graphics.lineTo(43, 63);
          graphics.strokePath();

          graphics.fillStyle(0x78350f, 1);
          graphics.fillRect(13, 34, 7, 12);
          graphics.fillRect(44, 34, 7, 12);

          graphics.fillStyle(0x451a03, 1);
          graphics.fillRect(20, 52, 24, 6);
        } else {
          // Vista Lateral Torso Túnica Noble
          graphics.fillStyle(0x1d4ed8, 1);
          graphics.fillEllipse(32, 48, 22, 26);
          graphics.lineStyle(2, 0xe2e8f0, 0.95);
          graphics.beginPath();
          graphics.moveTo(21, 61); graphics.lineTo(43, 61);
          graphics.strokePath();

          graphics.fillStyle(0x78350f, 1);
          graphics.fillCircle(32, 38, 7);
          graphics.fillStyle(0x451a03, 1);
          graphics.fillRect(22, 52, 20, 6);
        }

        // ----------------------------------------------------
        // 3. BRAZOS DESARMADOS (UNARMED - SIN ESPADA EN MANO)
        // ----------------------------------------------------
        graphics.fillStyle(0xf5c6a5, 1); // Piel humana
        if (dir === 'left' || dir === 'up-left' || dir === 'down-left') {
          graphics.fillEllipse(28, 44, 8, 12);
          const forearmX = 28 - armPendulumX;
          graphics.fillEllipse(forearmX, 54, 8, 14);
          graphics.fillStyle(0x1d4ed8, 1); // Manga azul
          graphics.fillRect(forearmX - 4, 48, 8, 6);
          graphics.fillStyle(0xf5c6a5, 1); // Puño cerrado desarmado
          graphics.fillCircle(forearmX, 61, 4.5);

        } else if (dir === 'right' || dir === 'up-right' || dir === 'down-right') {
          graphics.fillEllipse(36, 44, 8, 12);
          const forearmX = 36 + armPendulumX;
          graphics.fillEllipse(forearmX, 54, 8, 14);
          graphics.fillStyle(0x1d4ed8, 1);
          graphics.fillRect(forearmX - 4, 48, 8, 6);
          graphics.fillStyle(0xf5c6a5, 1);
          graphics.fillCircle(forearmX, 61, 4.5);

        } else {
          // Vista Frontal / Trasera: Ambos brazos relajados a los lados
          graphics.fillEllipse(12, 44, 7, 12);
          graphics.fillEllipse(52, 44, 7, 12);

          const leftForearmY = 52 + armPendulumY;
          const rightForearmY = 52 - armPendulumY;

          graphics.fillEllipse(12, leftForearmY, 7, 14);
          graphics.fillEllipse(52, rightForearmY, 7, 14);

          graphics.fillStyle(0x1d4ed8, 1);
          graphics.fillRect(9, leftForearmY - 4, 7, 6);
          graphics.fillRect(49, rightForearmY - 4, 7, 6);

          graphics.fillStyle(0xf5c6a5, 1);
          graphics.fillCircle(12, leftForearmY + 7, 4.5);
          graphics.fillCircle(52, rightForearmY + 7, 4.5);
        }

        // ----------------------------------------------------
        // 4. CABEZA, PEINADO NOBLE & ROSTRO
        // ----------------------------------------------------
        graphics.fillStyle(0xf5c6a5, 1);
        graphics.fillEllipse(32, 22, 26, 24); // Cabeza masculina limpia
        graphics.fillEllipse(32, 27, 22, 16);

        if (isSide) {
          // Orejas & Perfil
          const earX = isLeft ? 35 : 29;
          graphics.fillStyle(0xf5c6a5, 1); graphics.fillCircle(earX, 24, 3);
          graphics.fillStyle(0xd9a07a, 1); graphics.fillCircle(earX, 24, 1.5);

          // Cabello Castaño Peinado Noble (Como en la imagen de referencia)
          graphics.fillStyle(0x451a03, 1);
          graphics.fillEllipse(32, 16, 24, 12);
          graphics.fillCircle(isLeft ? 36 : 28, 20, 10);
          graphics.fillRect(isLeft ? 24 : 32, 15, 9, 5); // Flequillo

          // Ojo Noble
          graphics.fillStyle(0x0f172a, 1); graphics.fillRect(isLeft ? 25 : 35, 24, 3, 4);
          graphics.fillStyle(0xffffff, 1); graphics.fillRect(isLeft ? 25 : 36, 24, 1, 2);

        } else {
          if (dir === 'down' || dir.includes('down')) {
            // Orejas
            graphics.fillStyle(0xf5c6a5, 1); graphics.fillCircle(19, 24, 3); graphics.fillCircle(45, 24, 3);
            // Cabello Castaño Noble
            graphics.fillStyle(0x451a03, 1);
            graphics.fillEllipse(32, 14, 26, 13);
            graphics.fillRect(19, 14, 26, 6);
            // Flequillo elegante
            graphics.beginPath();
            graphics.moveTo(20, 18); graphics.lineTo(34, 22); graphics.lineTo(26, 25);
            graphics.closePath(); graphics.fillPath();

            // Ojos Expresivos & Cejas Nobles
            graphics.fillStyle(0x27140a, 1);
            graphics.fillRect(23, 21, 6, 2); graphics.fillRect(35, 21, 6, 2); // Cejas
            graphics.fillStyle(0x0f172a, 1);
            graphics.fillRect(24, 24, 4, 4); graphics.fillRect(36, 24, 4, 4); // Ojos
            graphics.fillStyle(0xffffff, 1);
            graphics.fillRect(25, 24, 2, 2); graphics.fillRect(37, 24, 2, 2); // Brillo pupilas

          } else {
            // Vista Posterior Cabello
            graphics.fillStyle(0x451a03, 1);
            graphics.fillCircle(32, 20, 14);
            graphics.fillEllipse(32, 25, 22, 16);
          }
        }

        graphics.generateTexture(`hero-${dir}-${frame}`, 64, 112);
      }
    });

    // 5. Realistic Wild Island Fowl / Chick Creature (HD 64x64, 4 Directions x 3 Frames + 2 Pecking Frames)
    const birdDirs = ['down', 'up', 'right', 'left'];

    birdDirs.forEach(dir => {
      for (let frame = 0; frame < 3; frame++) {
        let legWiggle = (frame === 1) ? -4 : (frame === 2 ? 4 : 0);

        // A. Peaceful Wild Fowl (Gallo Salvaje Pacífico 🐓)
        graphics.clear();
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(32, 58, 38, 12);

        graphics.fillStyle(0x451a03, 1);
        graphics.fillTriangle(14, 26, 8, 42, 24, 38);

        graphics.fillStyle(0xd97706, 1);
        graphics.fillEllipse(32, 38, 36, 26);
        graphics.fillStyle(0xf59e0b, 1);
        graphics.fillCircle(32, 24, 16);

        graphics.fillStyle(0xb45309, 1);
        graphics.fillEllipse(dir === 'right' ? 38 : (dir === 'left' ? 26 : 32), 40, 16, 20);

        graphics.fillStyle(0xdc2626, 1);
        graphics.fillRect(30, 6, 5, 8);
        graphics.fillRect(30, 32, 4, 6);

        graphics.fillStyle(0xf59e0b, 1);
        if (dir === 'right') graphics.fillTriangle(44, 22, 54, 26, 44, 28);
        else if (dir === 'left') graphics.fillTriangle(20, 22, 10, 26, 20, 28);
        else graphics.fillTriangle(28, 26, 36, 26, 32, 32);

        graphics.fillStyle(0x0f172a, 1);
        graphics.fillCircle(dir === 'left' ? 24 : (dir === 'right' ? 40 : 26), 20, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(dir === 'left' ? 25 : (dir === 'right' ? 41 : 27), 19, 1);

        graphics.fillStyle(0xea580c, 1);
        graphics.fillRect(24, 50 + legWiggle, 4, 10);
        graphics.fillRect(36, 50 - legWiggle, 4, 10);

        graphics.generateTexture(`chick-peaceful-${dir}-${frame}`, 64, 64);

        // B. Enraged Wild Fowl (Gallo Salvaje Enojado 🐓💢)
        graphics.clear();
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(32, 58, 42, 14);

        graphics.fillStyle(0x7f1d1d, 1);
        graphics.fillTriangle(10, 18, 4, 44, 24, 38);

        graphics.fillStyle(0xb91c1c, 1);
        graphics.fillEllipse(32, 38, 38, 28);
        graphics.fillStyle(0xef4444, 1);
        graphics.fillCircle(32, 22, 18);

        graphics.fillStyle(0x991b1b, 1);
        graphics.fillEllipse(16, 32, 16, 26);
        graphics.fillEllipse(48, 32, 16, 26);

        graphics.fillStyle(0x991b1b, 1);
        graphics.fillRect(28, 2, 8, 12);
        graphics.fillRect(28, 32, 8, 8);

        graphics.fillStyle(0xd97706, 1);
        if (dir === 'right') graphics.fillTriangle(44, 20, 56, 26, 44, 28);
        else if (dir === 'left') graphics.fillTriangle(20, 20, 8, 26, 20, 28);
        else graphics.fillTriangle(26, 24, 38, 24, 32, 34);

        graphics.fillStyle(0xfef08a, 1);
        graphics.fillCircle(dir === 'left' ? 24 : (dir === 'right' ? 40 : 26), 19, 4);
        graphics.fillStyle(0xdc2626, 1);
        graphics.fillCircle(dir === 'left' ? 24 : (dir === 'right' ? 40 : 26), 19, 2);

        graphics.fillStyle(0xd97706, 1);
        graphics.fillRect(22, 50 + legWiggle, 5, 12);
        graphics.fillRect(37, 50 - legWiggle, 5, 12);

        graphics.generateTexture(`chick-angry-${dir}-${frame}`, 64, 64);
      }

      // C. Pecking / Worm Eating Animation Frames 🪱
      for (let eatFrame = 0; eatFrame < 2; eatFrame++) {
        graphics.clear();
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillEllipse(32, 58, 38, 12);

        graphics.fillStyle(0xd97706, 1);
        graphics.fillEllipse(32, 40, 36, 24);

        const headY = (eatFrame === 0) ? 36 : 44;
        graphics.fillStyle(0xf59e0b, 1);
        graphics.fillCircle(32, headY, 15);

        graphics.fillStyle(0xdc2626, 1);
        graphics.fillRect(30, headY - 14, 5, 7);

        graphics.fillStyle(0xf59e0b, 1);
        graphics.fillTriangle(28, headY, 36, headY, 32, headY + 12);

        if (eatFrame === 1) {
          graphics.fillStyle(0xf472b6, 1);
          graphics.fillCircle(30, headY + 14, 3);
          graphics.fillCircle(34, headY + 16, 2.5);
          graphics.fillCircle(37, headY + 14, 2);
        }

        graphics.fillStyle(0xea580c, 1);
        graphics.fillRect(24, 50, 4, 10);
        graphics.fillRect(36, 50, 4, 10);

        graphics.generateTexture(`chick-eat-${dir}-${eatFrame}`, 64, 64);
      }
    });

    // 6. Realistic Island Apple Tree with HIGHLY VISIBLE PROMINENT BROWN BRANCHES & 2 Apples (HD 112x144) 🍎🌳
    graphics.clear();
    // A. Soft Translucent Ground Shadow
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(56, 134, 88, 24);

    // B. Gnarled Root System
    graphics.fillStyle(0x2d170b, 1);
    graphics.fillTriangle(34, 134, 48, 114, 52, 134);
    graphics.fillTriangle(78, 134, 64, 114, 60, 134);
    graphics.fillTriangle(56, 136, 52, 114, 60, 114);

    // C. DEEP DARK FOREST GREEN LEAF CANOPY (Drawn BEFORE branches so wood stays 100% visible!)
    graphics.fillStyle(0x123824, 1);
    graphics.fillCircle(38, 46, 32);
    graphics.fillCircle(74, 48, 32);
    graphics.fillCircle(56, 30, 30);

    graphics.fillStyle(0x1a452d, 1);
    graphics.fillCircle(32, 38, 22);
    graphics.fillCircle(78, 40, 22);
    graphics.fillCircle(56, 22, 20);

    graphics.fillStyle(0x225438, 0.9);
    graphics.fillCircle(38, 32, 16);
    graphics.fillCircle(74, 34, 16);
    graphics.fillCircle(56, 18, 14);

    // D. HIGHLY VISIBLE PROMINENT BROWN WOODEN TRUNK & BRANCHES (Drawn ON TOP of Leaves!) 🪵
    // Main Trunk
    graphics.fillStyle(0x3d2314, 1);
    graphics.fillRect(46, 76, 20, 52);
    graphics.fillStyle(0x78350f, 1); // Bark Highlight
    graphics.fillRect(50, 78, 8, 48);
    graphics.fillStyle(0x27140a, 1); // Shadow Crevice
    graphics.fillRect(46, 82, 4, 44);

    // Major Wooden Boughs & Branches Extending High Across and OVER the Canopy
    graphics.fillStyle(0x451a03, 1);

    // Left Major Wooden Branch (Thick & Visible)
    graphics.beginPath();
    graphics.moveTo(48, 80);
    graphics.lineTo(20, 48);
    graphics.lineTo(26, 42);
    graphics.lineTo(52, 74);
    graphics.closePath();
    graphics.fillPath();

    // Right Major Wooden Branch (Thick & Visible)
    graphics.beginPath();
    graphics.moveTo(64, 80);
    graphics.lineTo(92, 50);
    graphics.lineTo(86, 44);
    graphics.lineTo(60, 74);
    graphics.closePath();
    graphics.fillPath();

    // Center Top Branch Fork
    graphics.beginPath();
    graphics.moveTo(50, 76);
    graphics.lineTo(54, 28);
    graphics.lineTo(58, 28);
    graphics.lineTo(62, 76);
    graphics.closePath();
    graphics.fillPath();

    // Secondary Branch Twigs Extending Through Foliage
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(20, 44, 16, 5);
    graphics.fillRect(76, 46, 16, 5);

    // E. 2 ASYMMETRICAL 3D RED APPLES (Hanging directly from visible wooden branches) 🍎🍎
    const applePositions = [
      { x: 34, y: 46 }, // Apple 1: Hanging from left wooden branch
      { x: 74, y: 58 }  // Apple 2: Hanging from right wooden branch
    ];

    applePositions.forEach(app => {
      // Wood Stem hanging from branch
      graphics.fillStyle(0x27140a, 1);
      graphics.fillRect(app.x - 0.5, app.y - 8, 1.5, 3);
      // Crimson Apple Body
      graphics.fillStyle(0x991b1b, 1);
      graphics.fillCircle(app.x, app.y, 6.5);
      graphics.fillStyle(0xdc2626, 1);
      graphics.fillCircle(app.x, app.y - 0.5, 5.5);
      // Specular Highlight
      graphics.fillStyle(0xfca5a5, 1);
      graphics.fillCircle(app.x - 2, app.y - 2, 1.5);
    });

    graphics.generateTexture('node-tree', 112, 144);

    // 7. Short Low-Profile Tree Stump without Shadow (HD 112x144) 🪵
    graphics.clear();

    // Spreading Root System
    graphics.fillStyle(0x2d170b, 1);
    graphics.fillTriangle(34, 134, 48, 114, 52, 134);
    graphics.fillTriangle(78, 134, 64, 114, 60, 134);
    graphics.fillTriangle(56, 136, 52, 114, 60, 114);

    // Short Low-Profile Trunk Base Cylinder
    graphics.fillStyle(0x3d2314, 1);
    graphics.fillRect(46, 112, 20, 16);
    graphics.fillStyle(0x5c2c16, 1); // Bark Highlight
    graphics.fillRect(50, 112, 8, 16);
    graphics.fillStyle(0x27140a, 1); // Shadow Crevice
    graphics.fillRect(46, 114, 4, 14);

    // Cut Wood Top Ringed Surface at y=112
    graphics.fillStyle(0x3d2314, 1);
    graphics.fillEllipse(56, 112, 24, 12); // Outer Bark Rim
    graphics.fillStyle(0x9a6a2f, 1);       // Wood Cut Surface
    graphics.fillEllipse(56, 112, 20, 10);
    graphics.fillStyle(0x78350f, 1);       // Ring 1
    graphics.fillEllipse(56, 112, 14, 7);
    graphics.fillStyle(0x5c2c16, 1);       // Core
    graphics.fillEllipse(56, 112, 6, 3);
    graphics.generateTexture('tree-stump', 112, 144);

    // 7.5. Small Decorative Mossy Rock / Piedra Pequeña (HD 32x32) 🪨
    graphics.clear();
    // Ground Shadow
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(16, 24, 24, 8);

    // Base Rock Body (Grey shades #64748b, #475569, #334155)
    graphics.fillStyle(0x475569, 1);
    graphics.fillEllipse(16, 18, 20, 12);
    graphics.fillStyle(0x64748b, 1); // Highlight Top
    graphics.fillEllipse(15, 16, 16, 8);
    graphics.fillStyle(0x334155, 1); // Base Shadow
    graphics.fillEllipse(17, 20, 18, 6);

    // Mossy Patch (#4d7c0f)
    graphics.fillStyle(0x4d7c0f, 0.85);
    graphics.fillEllipse(13, 15, 8, 4);
    graphics.generateTexture('small-rock', 32, 32);

    // 8. Loot Bag / Feather Gold Icon (HD 48x48)
    graphics.clear();
    graphics.fillStyle(0xfde047, 1);
    graphics.fillCircle(24, 26, 16);
    graphics.fillStyle(0xf97316, 1);
    graphics.fillTriangle(20, 8, 28, 8, 24, 16);
    graphics.generateTexture('loot-bag', 48, 48);

    // 8. Slash Attack Effect (HD 64x64)
    graphics.clear();
    graphics.lineStyle(6, 0x00f2fe, 0.95);
    graphics.beginPath();
    graphics.arc(32, 32, 28, Phaser.Math.DegToRad(45), Phaser.Math.DegToRad(180), false);
    graphics.strokePath();

    // 10. Chicken Drop Item Textures (HD 32x32) 🪶🥚🐤👁️
    // A. Pluma de Pollo
    graphics.clear();
    graphics.fillStyle(0xfde047, 1);
    graphics.fillTriangle(16, 4, 8, 26, 24, 26);
    graphics.fillStyle(0xf59e0b, 1);
    graphics.fillRect(15, 22, 2, 8);
    graphics.generateTexture('chicken_feather', 32, 32);

    // B. Huevo de Pollo
    graphics.clear();
    graphics.fillStyle(0xfef3c7, 1);
    graphics.fillEllipse(16, 16, 18, 24);
    graphics.fillStyle(0xffffff, 0.6);
    graphics.fillEllipse(13, 12, 6, 10);
    graphics.generateTexture('chicken_egg', 32, 32);

    // C. Pico de Pollo
    graphics.clear();
    graphics.fillStyle(0xd97706, 1);
    graphics.fillTriangle(6, 12, 26, 8, 22, 24);
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(10, 16, 10, 2);
    graphics.generateTexture('chicken_beak', 32, 32);

    // D. Ojo de Pollo
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 16, 12);
    graphics.fillStyle(0xdc2626, 1);
    graphics.fillCircle(16, 16, 7);
    graphics.fillStyle(0x0f172a, 1);
    graphics.fillCircle(16, 16, 3.5);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(18, 14, 1.5);
    graphics.generateTexture('chicken_eye', 32, 32);

    // E. Monedas de Oro
    graphics.clear();
    graphics.fillStyle(0xfde047, 1);
    graphics.fillCircle(16, 16, 12);
    graphics.fillStyle(0xf59e0b, 1);
    graphics.fillCircle(16, 16, 9);
    graphics.fillStyle(0xfef08a, 1);
    graphics.fillCircle(14, 14, 3);
    graphics.generateTexture('gold', 32, 32);

    // F. Madera de Manzano
    graphics.clear();
    graphics.fillStyle(0x3d2314, 1);
    graphics.fillRect(10, 8, 12, 18);
    graphics.fillStyle(0x78350f, 1);
    graphics.fillEllipse(16, 8, 12, 6);
    graphics.fillStyle(0x5c2c16, 1);
    graphics.fillRect(12, 10, 4, 14);
    graphics.generateTexture('wood_apple', 32, 32);

    // G. Manzana Fruta
    graphics.clear();
    graphics.fillStyle(0x27140a, 1);
    graphics.fillRect(15, 4, 2, 6);
    graphics.fillStyle(0x52b788, 1);
    graphics.fillCircle(19, 6, 3);
    graphics.fillStyle(0x991b1b, 1);
    graphics.fillCircle(16, 18, 10);
    graphics.fillStyle(0xdc2626, 1);
    graphics.fillCircle(16, 17, 9);
    graphics.fillStyle(0xfca5a5, 1);
    graphics.fillCircle(13, 14, 3);
    graphics.generateTexture('apple_fruit', 32, 32);

    graphics.destroy();
  }
}
