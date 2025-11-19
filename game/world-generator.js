import * as StorageManager from '../storage-manager.js';
import { Map } from '../map.js';
import { TILE_TYPE } from '../map-tile-types.js';

export async function regenerateMapFeature(channel, worldName, feature) {
    console.log(`Regenerating ${feature} for world ${worldName}...`);
    const worldState = await StorageManager.loadGameState(channel, worldName);
    if (!worldState) {
        alert(`Could not load world data for ${worldName}.`);
        return;
    }

    // Use a temporary Map instance to run the logic
    const tempMap = new Map(32); // tileSize is arbitrary here
    if (worldState.map && worldState.map.grid && worldState.map.grid.length > 0) {
        tempMap.grid = worldState.map.grid;
    } else {
        // If map is empty, create a base grass grid
        tempMap.grid = Array(tempMap.height).fill(0).map(() => Array(tempMap.width).fill(TILE_TYPE.GRASS));
    }

    if (feature === 'trees') {
        tempMap.regenerateTrees();
    } else if (feature === 'flowers') {
        tempMap.regenerateFlowers();
    }

    // Save the updated map back
    worldState.map.grid = tempMap.grid;
    
    // We need to pass a Map-like object to saveGameState, not the full Player instances
    const dummyPlayers = new window.Map(); // Use window.Map to avoid conflict with the Map class from this module
    for (const id in worldState.players) {
        dummyPlayers.set(id, { getState: () => worldState.players[id] });
    }
    const dummyMap = { grid: tempMap.grid, treeRespawns: worldState.map.treeRespawns || [] };

    await StorageManager.saveGameState(channel, worldName, dummyPlayers, dummyMap, worldState.assets || {}, worldState.assetsGenerated || []);

    alert(`${feature.charAt(0).toUpperCase() + feature.slice(1)} have been regenerated for "${worldName}"! The changes will be visible the next time you load the world.`);
}