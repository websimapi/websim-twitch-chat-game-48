// This file was extracted from map.js
import { TILE_TYPE } from '../map-tile-types.js';
import { project } from '../game/projection.js';

export class MapRenderer {
    constructor(map) {
        this.map = map;
    }

    getTallObjects(drawStartX, drawEndX, drawStartY, drawEndY) {
        // Note: draw ranges might be loose in 2.5D, so we might check bounds strictly here if needed
        const tallObjects = [];
        for (let j = drawStartY; j < drawEndY; j++) {
            for (let i = drawStartX; i < drawEndX; i++) {
                if (j < 0 || j >= this.map.height || i < 0 || i >= this.map.width) continue;
                const tileType = this.map.grid[j] ? this.map.grid[j][i] : TILE_TYPE.GRASS;
                if (tileType === TILE_TYPE.TREE) {
                    tallObjects.push({
                        type: 'tree',
                        x: i,
                        y: j,
                        z: 0, // Base height
                        image: this.map.treeTile,
                    });
                }
            }
        }
        return tallObjects;
    }

    renderBase(ctx, cameraX, cameraY, drawStartX, drawEndX, drawStartY, drawEndY, viewMode) {
        if (!this.map.grassTile || !this.map.grassTile.complete) return;

        ctx.save();
        
        const ts = this.map.tileSize;
        
        // For 2.5D ground rendering, we can use a transform to skew the images
        // This allows us to draw "flat" tiles that look isometric.
        if (viewMode === '2.5d') {
            // In our projection:
            // x_screen = (x - y) * 0.5 * ts
            // y_screen = (x + y) * 0.25 * ts
            //
            // Matrix transform T:
            // T(1, 0) -> (0.5*ts, 0.25*ts)
            // T(0, 1) -> (-0.5*ts, 0.25*ts)
            //
            // setTransform(a, b, c, d, e, f)
            // x' = ax + cy + e
            // y' = bx + dy + f
            
            // Snap camera translation to whole pixels to reduce subpixel shimmering
            const snappedCameraX = Math.round(cameraX);
            const snappedCameraY = Math.round(cameraY);
            ctx.translate(-snappedCameraX, -snappedCameraY);
            
            ctx.transform(0.5, 0.25, -0.5, 0.25, 0, 0);
            
            // Now we can just draw the map as if it were 2D orthogonal, but we need to scale
            // the drawing coordinates because the matrix above takes pixel coords and squashes them.
            // Wait, if we draw at (i*ts, j*ts), the matrix applies to that vector.
            // Vector (ts, 0) -> (0.5*ts, 0.25*ts). Perfect.
            
            // However, the grass tile is square. If we skew it, it looks like a diamond.
            // This creates the ground plane.
        } else {
             // 2D Mode
             ctx.translate(Math.round(-cameraX), Math.round(-cameraY));
        }

        // Iterate and draw ground-level tiles
        // We expand the drawing loop to avoid edge artifacts in 2.5D
        const pad = viewMode === '2.5d' ? 2 : 0;
        
        for (let j = drawStartY - pad; j < drawEndY + pad; j++) {
            for (let i = drawStartX - pad; i < drawEndX + pad; i++) {
                if (j < 0 || j >= this.map.height || i < 0 || i >= this.map.width) continue;
                
                // Draw base grass tile
                // To prevent seams in 2.5D with transforms, we slightly overlap or ensure integers?
                // Canvas transforms handle subpixels.
                ctx.drawImage(this.map.grassTile, i * ts, j * ts, ts, ts);

                // Draw ground objects (logs, bushes, flowers)
                // These are "flat" on the ground, so they share the transform in 2.5D
                // But wait! The prompt says "assets stand up like paper style".
                // Logs/Bushes/Flowers might be considered "flat" or "standing".
                // Usually in Don't Starve/Paper Mario, bushes stand up.
                // If they stand up, they should NOT be drawn with the ground skew transform.
                // They should be drawn in the entity pass (renderYSorted).
                // Currently, they are drawn here in renderBase.
                
                // IF we want them to stand up, we must move them to renderYSorted logic in game/renderer.js
                // IF we want them flat (like a rug), we draw them here.
                
                // Actually, the easiest way to make them "stand up" is to NOT draw them in this transformed context,
                // but draw them in the entity pass.
                
                // Let's modify this loop to ONLY draw flat things (Grass, Flowers).
                // Logs and Bushes should be treated as entities in 2.5D mode.
                
                const tileType = this.map.grid[j] ? this.map.grid[j][i] : TILE_TYPE.GRASS;
                
                if (tileType === TILE_TYPE.FLOWER_PATCH) {
                     ctx.drawImage(this.map.flowerPatchTile, i * ts, j * ts, ts, ts);
                } else if (viewMode === '2d') {
                    // In 2D, we draw logs/bushes here as before (flat layer)
                    if (tileType === TILE_TYPE.LOGS) ctx.drawImage(this.map.logsTile, i * ts, j * ts, ts, ts);
                    if (tileType === TILE_TYPE.BUSHES) ctx.drawImage(this.map.bushesTile, i * ts, j * ts, ts, ts);
                }
            }
        }
        
        // NOTE: Grid line rendering has been removed to avoid visible grid lines in both 2D and 2.5D views.
        // Previously, subtle grid lines were drawn here; they are now intentionally omitted.

        ctx.restore();
    }
}