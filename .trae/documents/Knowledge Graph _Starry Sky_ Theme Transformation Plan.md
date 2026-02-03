I will help you transform the knowledge graph into a "Starry Sky/Universe" theme. This involves updating the visual style of nodes, edges, and the background, as well as adding special effects like glow and starfields.

### 1. Dependency Installation
- Install `@react-three/postprocessing` to enable the "Bloom" (glow) effect for stars.

### 2. Configuration Updates (`src/config/graphConfig.ts`)
- **Theme Config**: 
    - Set the background color to deep black (`#000000`).
    - Adjust link lines to be subtle and transparent (starlight connections).
- **Level Config**: 
    - Update node colors to represent different stellar objects:
        - **Root**: Bright Gold/White (Sun-like).
        - **Core**: Cyan/Blue Giants.
        - **Sub**: Orange/Red Dwarfs.
        - **Leaf**: White/Grey small stars.

### 3. Scene Enhancements (`src/components/Graph3D/GraphScene.tsx`)
- **Starfield**: Add a `<Stars />` component to create a dynamic background with thousands of twinkling stars.
- **Post-Processing**: Add `<EffectComposer>` and `<Bloom />` to make the nodes glow like real stars.
- **Lighting**: Adjust lighting to emphasize the self-illumination of the nodes against the dark background.

### 4. Node Rendering (`src/components/Graph3D/GraphRenderables.tsx`)
- **Material Update**: Update the node material to be **emissive** (self-glowing).
- **Reflectivity**: Increase metalness and decrease roughness to make them shiny "planets" or "stars".

### 5. Verification
- Verify the 3D view to ensure the "Universe" look is achieved without affecting performance.
- Check that the text is still readable against the glowing nodes.
