import Phaser from 'phaser';
import { GameConfig } from './config';

declare global {
  interface Window {
    gameInstance: Phaser.Game;
  }
}

window.addEventListener('load', () => {
  window.gameInstance = new Phaser.Game(GameConfig);
});
