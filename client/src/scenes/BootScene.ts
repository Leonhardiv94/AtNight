import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('espadachin_male_hd', '/assets/espadachin_male_hd.jpg');
    this.load.image('dofus_swordsman_sheet', '/assets/dofus_swordsman_spritesheet.jpg');
    this.load.image('swordsman_hd_base', '/assets/swordsman_hd_base.jpg');
  }

  create() {
    // Generate clean procedural high-definition HD textures
    this.createProceduralTextures();
    this.scene.start('GameScene');
  }

  private createProceduralTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // 1. Isometric Grass Tile (Lush Meadow HD 128x84 - 100% Seamless Continuous Grass)
    graphics.clear();
    // Borde de Acantilado de Tierra Uniforme (Mismo tono suave en ambas caras)
    graphics.fillStyle(0x4e342e, 1);
    graphics.fillTriangle(0, 32, 64, 64, 64, 84);
    graphics.fillTriangle(0, 32, 64, 84, 0, 52);

    graphics.fillStyle(0x4e342e, 1);
    graphics.fillTriangle(64, 64, 128, 32, 128, 52);
    graphics.fillTriangle(64, 64, 128, 52, 64, 84);

    // Superficie de Césped Verde Vivo Continua (Pura hierba verde sin marcos interiores ni divisiones)
    graphics.fillStyle(0x388e3c, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);

    // Detalles Orgánicos Dispersos de Briznas de Hierba Fresca (Sin bordes en los límites)
    graphics.fillStyle(0x4caf50, 0.7);
    graphics.fillRect(40, 20, 3, 5);
    graphics.fillRect(80, 28, 4, 6);
    graphics.fillRect(56, 38, 3, 5);
    graphics.fillRect(72, 14, 3, 5);
    graphics.fillRect(28, 30, 3, 5);
    graphics.fillRect(92, 22, 4, 5);

    graphics.fillStyle(0x81c784, 0.6);
    graphics.fillRect(48, 16, 2, 4);
    graphics.fillRect(84, 36, 2, 4);
    graphics.fillRect(34, 42, 2, 4);

    graphics.generateTexture('tile-grass', 128, 84);

    // 2. Isometric Shoreline Sand Tile (Soft Creamy Beach Sand HD 128x84 - Uniform Shoreline Edge)
    graphics.clear();
    // Borde de Acantilado de Playa de COLOR UNIFORMEMENTE HOMOGÉNEO (Mismo color de arena cálida en ambas caras)
    graphics.fillStyle(0xd97706, 0.85);
    graphics.fillTriangle(0, 32, 64, 64, 64, 84);
    graphics.fillTriangle(0, 32, 64, 84, 0, 52);

    graphics.fillStyle(0xd97706, 0.85);
    graphics.fillTriangle(64, 64, 128, 32, 128, 52);
    graphics.fillTriangle(64, 64, 128, 52, 64, 84);

    // Superficie de Arena Crema Dorada 100% Continua (Sin bordes ni divisiones)
    graphics.fillStyle(0xfde68a, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);

    // Granos y Detalle Sutil de Arena Dispersa
    graphics.fillStyle(0xfffef0, 0.80);
    graphics.fillRect(42, 15, 2, 2);
    graphics.fillRect(78, 18, 2, 2);
    graphics.fillRect(62, 24, 2, 2);
    graphics.fillRect(50, 44, 2, 2);

    // Conchitas de Playa
    graphics.fillStyle(0xffedd5, 0.90);
    graphics.fillCircle(54, 18, 2);
    graphics.fillStyle(0xfb7185, 0.6);
    graphics.fillRect(53, 18, 2, 1);

    graphics.generateTexture('tile-sand', 128, 84);

    // 3. Isometric Tropical Ocean Water Tile (Continuous Azure Sea HD 128x64)
    graphics.clear();
    // Agua Océano 100% Continua
    graphics.fillStyle(0x008899, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);

    // Olas Suaves de Espuma Cristalina
    graphics.lineStyle(1.5, 0x4dd0e1, 0.6);
    graphics.beginPath();
    graphics.moveTo(32, 18); graphics.lineTo(64, 10); graphics.lineTo(96, 18);
    graphics.strokePath();

    graphics.lineStyle(1.5, 0x80deea, 0.7);
    graphics.beginPath();
    graphics.moveTo(24, 34); graphics.lineTo(64, 26); graphics.lineTo(104, 34);
    graphics.strokePath();

    graphics.generateTexture('tile-water', 128, 64);

    // 4. Isometric Polished Hardwood Floor Tile (Interior del Templo HD 128x64)
    graphics.clear();
    graphics.fillStyle(0x8d5b4c, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);

    // Vetas de Madera Pulida y Divisiones de Tablas
    graphics.lineStyle(1.5, 0x6d4236, 0.7);
    graphics.beginPath();
    graphics.moveTo(32, 16); graphics.lineTo(96, 48);
    graphics.moveTo(16, 24); graphics.lineTo(80, 56);
    graphics.strokePath();

    graphics.lineStyle(1, 0xa16859, 0.5);
    graphics.beginPath();
    graphics.moveTo(48, 8); graphics.lineTo(112, 40);
    graphics.strokePath();

    graphics.generateTexture('tile-wood', 128, 64);

    // 5. Isometric Temple Interior Stone Wall Tile (Pared de Piedra del Templo 128x84)
    graphics.clear();
    graphics.fillStyle(0xc2a370, 1);
    graphics.fillTriangle(0, 32, 64, 64, 64, 84);
    graphics.fillTriangle(0, 32, 64, 84, 0, 52);

    graphics.fillStyle(0xb3925c, 1);
    graphics.fillTriangle(64, 64, 128, 32, 128, 52);
    graphics.fillTriangle(64, 64, 128, 52, 64, 84);

    graphics.fillStyle(0xd4b886, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);

    // Grabado de Ladrillos de Piedra Catedralicias
    graphics.lineStyle(1, 0x9c7a46, 0.6);
    graphics.strokeTriangle(64, 0, 128, 32, 64, 64);
    graphics.strokeTriangle(64, 0, 0, 32, 64, 64);

    graphics.generateTexture('tile-temple-wall', 128, 84);

    // 6. Isometric Ceremonial Exit Red Carpet Tile (Alfombra de Salida con Filo Dorado 128x64)
    graphics.clear();
    // Base Carmesí Profundo
    graphics.fillStyle(0x991b1b, 1);
    graphics.fillTriangle(64, 0, 128, 32, 64, 64);
    graphics.fillTriangle(64, 0, 0, 32, 64, 64);

    // Centro Rojo Terciopelo
    graphics.fillStyle(0xb91c1c, 0.95);
    graphics.fillTriangle(64, 4, 120, 32, 64, 60);
    graphics.fillTriangle(64, 4, 8, 32, 64, 60);

    // Borde Ornamental Dorado de Salida
    graphics.lineStyle(2, 0xf59e0b, 0.9);
    graphics.beginPath();
    graphics.moveTo(64, 6); graphics.lineTo(116, 32); graphics.lineTo(64, 58); graphics.lineTo(12, 32); graphics.closePath();
    graphics.strokePath();

    graphics.generateTexture('tile-carpet', 128, 64);

    // 7. Iconos de Recursos e Ítems del Inventario (Pluma, Huevo, Pico, Ojo, Madera, Manzana)
    // A. Pluma de Pollo
    graphics.clear();
    graphics.fillStyle(0xf8fafc, 1);
    graphics.fillTriangle(16, 4, 26, 20, 16, 28);
    graphics.fillTriangle(16, 4, 6, 20, 16, 28);
    graphics.lineStyle(1.5, 0xf59e0b, 1);
    graphics.lineBetween(16, 4, 16, 28);
    graphics.generateTexture('chicken_feather', 32, 32);

    // B. Huevo de Pollo
    graphics.clear();
    graphics.fillStyle(0xfef3c7, 1);
    graphics.fillEllipse(16, 16, 12, 16);
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillCircle(14, 12, 3);
    graphics.generateTexture('chicken_egg', 32, 32);

    // C. Pico de Pollo
    graphics.clear();
    graphics.fillStyle(0xf97316, 1);
    graphics.fillTriangle(6, 10, 26, 16, 6, 22);
    graphics.generateTexture('chicken_beak', 32, 32);

    // D. Ojo de Pollo
    graphics.clear();
    graphics.fillStyle(0x0f172a, 1);
    graphics.fillCircle(16, 16, 10);
    graphics.fillStyle(0x38bdf8, 1);
    graphics.fillCircle(16, 16, 6);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(18, 14, 2);
    graphics.generateTexture('chicken_eye', 32, 32);

    // E. Madera
    graphics.clear();
    graphics.fillStyle(0x78350f, 1);
    graphics.fillRect(6, 10, 20, 12);
    graphics.fillStyle(0x92400e, 1);
    graphics.fillEllipse(26, 16, 4, 6);
    graphics.generateTexture('wood', 32, 32);
    graphics.generateTexture('wood_apple', 32, 32);

    // F. Manzana
    graphics.clear();
    graphics.fillStyle(0xdc2626, 1);
    graphics.fillCircle(16, 18, 10);
    graphics.fillStyle(0x15803d, 1);
    graphics.fillRect(15, 6, 2, 5);
    graphics.generateTexture('apple', 32, 32);
    graphics.generateTexture('apple_fruit', 32, 32);

    // 4. Realistic Wild Island Fowl / Chick Creature (HD 64x64, 4 Directions x 3 Frames + 2 Pecking Frames)
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
