import * as StorageManager from '../../storage-manager.js';

// Default assets mapping
const ASSET_DEFINITIONS = [
    { key: 'grass', label: 'Grass Tile (32x32)', defaultSrc: './grass_tile.png' },
    { key: 'tree', label: 'Tree', defaultSrc: './tree.png' },
    { key: 'logs', label: 'Logs', defaultSrc: './logs.png' },
    { key: 'bushes', label: 'Bushes', defaultSrc: './bushes.png' },
    { key: 'flowers', label: 'Flowers', defaultSrc: './flowers.png' }
];

export function initAssetManager(channel, worldName) {
    const container = document.getElementById('assets-list-container');
    let currentAssets = {};
    let generatedAssets = [];

    async function loadCurrentAssets() {
        const gameState = await StorageManager.loadGameState(channel, worldName);
        currentAssets = gameState.assets || {};
        generatedAssets = gameState.assetsGenerated || [];
        renderAssetsList();
    }

    async function saveAsset(key, url) {
        currentAssets[key] = url;
        await StorageManager.saveWorldAssets(channel, worldName, currentAssets);
        renderAssetsList();
    }

    async function resetAsset(key) {
        if (currentAssets[key]) {
            delete currentAssets[key];
            await StorageManager.saveWorldAssets(channel, worldName, currentAssets);
            renderAssetsList();
        }
    }

    async function saveGeneratedAssets() {
        await StorageManager.saveWorldGeneratedAssets(channel, worldName, generatedAssets);
        renderAssetsList();
    }

    function deleteGeneratedAsset(id) {
        generatedAssets = generatedAssets.filter(a => a.id !== id);
        saveGeneratedAssets();
    }

    function renderGeneratedAssetsWheel() {
        const wheel = document.createElement('div');
        wheel.className = 'generated-assets-wheel';

        const titleRow = document.createElement('div');
        titleRow.className = 'generated-assets-header';
        titleRow.innerHTML = `<span class="generated-assets-title">Generated Asset Library</span>`;

        const strip = document.createElement('div');
        strip.className = 'generated-assets-strip';

        if (!generatedAssets || generatedAssets.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'generated-assets-empty';
            emptyMsg.textContent = 'No generated assets yet. Use "Generate New" to create custom art.';
            strip.appendChild(emptyMsg);
        } else {
            generatedAssets.forEach(asset => {
                const item = document.createElement('div');
                item.className = 'generated-asset-item';
                item.innerHTML = `
                    <div class="generated-asset-thumb">
                        <img src="${asset.url}" alt="${asset.prompt || 'Generated asset'}">
                    </div>
                    <button class="generated-asset-delete-btn" data-id="${asset.id}" title="Delete from library">✕</button>
                `;
                strip.appendChild(item);
            });
        }

        wheel.appendChild(titleRow);
        wheel.appendChild(strip);

        // Bind delete handlers
        wheel.querySelectorAll('.generated-asset-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                deleteGeneratedAsset(id);
            });
        });

        return wheel;
    }

    function openGenerationModal(assetKey, assetLabel) {
        const overlay = document.createElement('div');
        overlay.className = 'asset-gen-overlay';

        const modal = document.createElement('div');
        modal.className = 'asset-gen-modal';

        modal.innerHTML = `
            <div class="asset-gen-header">
                <h3>Generate New Image for "${assetLabel}"</h3>
                <button class="asset-gen-close-btn" title="Close">✕</button>
            </div>
            <div class="asset-gen-body">
                <label class="asset-gen-label">Describe the image you want:</label>
                <textarea class="asset-gen-input" rows="3" placeholder="e.g. A darker forest tree with glowing runes..."></textarea>
                <div class="asset-gen-status"></div>
                <div class="asset-gen-preview-container">
                    <div class="asset-gen-preview-placeholder">No image generated yet.</div>
                    <img class="asset-gen-preview-img hidden" alt="Generated preview">
                </div>
            </div>
            <div class="asset-gen-footer">
                <button class="asset-gen-generate-btn">Generate</button>
                <div class="asset-gen-spacer"></div>
                <button class="asset-gen-accept-btn" disabled>Accept Override</button>
                <button class="asset-gen-decline-btn" disabled>Decline Override</button>
                <button class="asset-gen-delete-btn" disabled>Delete Generation</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = () => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        };

        const closeBtn = modal.querySelector('.asset-gen-close-btn');
        const generateBtn = modal.querySelector('.asset-gen-generate-btn');
        const acceptBtn = modal.querySelector('.asset-gen-accept-btn');
        const declineBtn = modal.querySelector('.asset-gen-decline-btn');
        const deleteBtn = modal.querySelector('.asset-gen-delete-btn');
        const promptInput = modal.querySelector('.asset-gen-input');
        const statusEl = modal.querySelector('.asset-gen-status');
        const previewImg = modal.querySelector('.asset-gen-preview-img');
        const previewPlaceholder = modal.querySelector('.asset-gen-preview-placeholder');

        let currentGenerated = null; // { id, url, prompt, createdAt }

        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close();
            }
        });

        generateBtn.addEventListener('click', async () => {
            const prompt = (promptInput.value || '').trim();
            if (!prompt) {
                statusEl.textContent = 'Please enter a description first.';
                statusEl.className = 'asset-gen-status asset-gen-status-error';
                return;
            }

            // Reset current preview state
            currentGenerated = null;
            previewImg.classList.add('hidden');
            previewPlaceholder.textContent = 'Generating image...';
            statusEl.textContent = 'Generating with Flux Schnell (this may take around 10 seconds)...';
            statusEl.className = 'asset-gen-status asset-gen-status-info';
            acceptBtn.disabled = true;
            declineBtn.disabled = true;
            deleteBtn.disabled = true;
            generateBtn.disabled = true;

            try {
                const result = await window.websim.imageGen({
                    prompt,
                    aspect_ratio: '1:1'
                });

                const fluxUrl = result && result.url;
                if (!fluxUrl) {
                    throw new Error('No URL returned from image generator.');
                }

                // Download the generated image and re-upload it to the project's file storage
                statusEl.textContent = 'Downloading and storing generated image...';
                const response = await fetch(fluxUrl);
                if (!response.ok) {
                    throw new Error('Failed to download generated image.');
                }
                const blob = await response.blob();
                const fileName = `generated_${Date.now()}.png`;
                const file = new File([blob], fileName, { type: blob.type || 'image/png' });

                const uploadedUrl = await window.websim.upload(file);
                if (!uploadedUrl) {
                    throw new Error('Upload did not return a URL.');
                }

                const url = uploadedUrl;

                currentGenerated = {
                    id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    url,
                    prompt,
                    createdAt: Date.now()
                };

                // Add to library immediately
                generatedAssets.push(currentGenerated);
                await saveGeneratedAssets();

                previewImg.src = url;
                previewImg.classList.remove('hidden');
                previewPlaceholder.textContent = '';
                statusEl.textContent = 'Image generated and stored successfully.';
                statusEl.className = 'asset-gen-status asset-gen-status-success';

                acceptBtn.disabled = false;
                declineBtn.disabled = false;
                deleteBtn.disabled = false;
            } catch (err) {
                console.error('Image generation failed:', err);
                statusEl.textContent = 'Failed to generate and store image. Please try again.';
                statusEl.className = 'asset-gen-status asset-gen-status-error';
                previewImg.classList.add('hidden');
                previewPlaceholder.textContent = 'No image generated yet.';
            } finally {
                generateBtn.disabled = false;
            }
        });

        acceptBtn.addEventListener('click', async () => {
            if (!currentGenerated) return;
            await saveAsset(assetKey, currentGenerated.url);
            close();
        });

        declineBtn.addEventListener('click', () => {
            // Keep in library but do not assign; just close
            close();
        });

        deleteBtn.addEventListener('click', async () => {
            if (!currentGenerated) return;
            deleteGeneratedAsset(currentGenerated.id);
            close();
        });
    }

    function renderAssetsList() {
        container.innerHTML = '';

        // Generated assets wheel at the top
        const wheel = renderGeneratedAssetsWheel();
        container.appendChild(wheel);

        const list = document.createElement('div');
        list.className = 'asset-list';

        ASSET_DEFINITIONS.forEach(def => {
            const assetRow = document.createElement('div');
            assetRow.className = 'asset-row';

            const currentSrc = currentAssets[def.key] || def.defaultSrc;
            const isOverridden = !!currentAssets[def.key];

            assetRow.innerHTML = `
                <div class="asset-preview">
                    <img src="${currentSrc}" alt="${def.label}">
                </div>
                <div class="asset-info">
                    <h4>${def.label}</h4>
                    <p class="status">${isOverridden ? '<span style="color: #4CAF50;">Custom Override Active</span>' : '<span style="color: #aaa;">Default</span>'}</p>
                </div>
                <div class="asset-actions">
                    <label class="upload-btn">
                        Upload New
                        <input type="file" class="asset-file-input" data-key="${def.key}" accept="image/*" style="display: none;">
                    </label>
                    <button class="generate-btn" data-key="${def.key}" data-label="${def.label}">Generate New</button>
                    ${isOverridden ? `<button class="reset-btn" data-key="${def.key}">Reset</button>` : ''}
                </div>
            `;

            list.appendChild(assetRow);
        });

        container.appendChild(list);

        // Bind upload events
        container.querySelectorAll('.asset-file-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const key = e.target.dataset.key;

                // Feedback
                const label = e.target.parentElement;
                const originalText = label.firstChild.textContent;
                label.firstChild.textContent = "Uploading...";

                try {
                    const url = await window.websim.upload(file);
                    await saveAsset(key, url);
                } catch (err) {
                    console.error("Upload failed:", err);
                    alert("Failed to upload image.");
                } finally {
                    label.firstChild.textContent = originalText;
                }
            });
        });

        // Bind reset events
        container.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                resetAsset(btn.dataset.key);
            });
        });

        // Bind generate new events
        container.querySelectorAll('.generate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const label = btn.dataset.label || key;
                openGenerationModal(key, label);
            });
        });
    }

    loadCurrentAssets();
}