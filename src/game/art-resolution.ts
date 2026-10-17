import type Phaser from 'phaser';
import { COLS, ROWS, TILE } from './world.ts';

// A finer drawing surface for incident art. World units and existing sprites do
// not change: the camera fits exactly the same 30 × 20 tile room.
export const ART_DENSITY = 2;
export const ART_WIDTH = COLS * TILE * ART_DENSITY;
export const ART_HEIGHT = ROWS * TILE * ART_DENSITY;
export function configureArtCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(ART_DENSITY).centerOn(COLS * TILE / 2, ROWS * TILE / 2);
}
