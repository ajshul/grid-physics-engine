## Scene Design Language (SDL)

YAML-based declarative format for building worlds deterministically.

Features:

- Metadata (name, author, seed)
- Canvas (worldWidth, worldHeight)
- Layers with z and operations: fill, overlay, scatter, basin, ring, spot, slope, stream, structure, emitter, noiseFill
- Entities (reserved) and deterministic per-op seeds

See `public/scenes/*.yaml` for examples adapted from Scene_Guide.md.

Build all scenes:

```
pnpm build:scenes
```

Preview a scene by visiting:

- `#/scenes/Campfire-Containment`
- `#/scenes/Forest-Wildfire`
- `#/scenes/Laboratory-Spill`
- `#/scenes/Supply-Delivery`
- `#/scenes/Crisis-Coordination`
