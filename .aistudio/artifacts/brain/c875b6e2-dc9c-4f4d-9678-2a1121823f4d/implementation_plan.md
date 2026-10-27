# Formula Creation UX Redesign, Olfactory Wheel Polish & Navigation Streamlining

A comprehensive overhaul of the perfumery formulation workflow, eliminating route confusion and unprompted formula additions, while refining the Michael Edwards Olfactory Wheel into a pristine academic schematic with an expanded center circle and 14 discrete radar axes.

### User Review & Critical Decisions

> [!IMPORTANT]
> Key design and architectural decisions finalized for user review:
> - **Explicit Formula Destination Modal/Selector**: When clicking "Add to Formula" or "Insert into Formula" from the Accords view or Palette, the system will prompt the perfumer with an explicit Target Formula Selector modal (displaying existing active formulas with their current concentration/type plus a "+ Create New Formula" option). No item will ever be added silently to an unselected formula.
> - **Pristine Olfactory Wheel Sectors**: All interior text/rect pills inside the 14 sector wedges are removed, matching the user's reference schematic. Full facet details, CAS numbers, and accord associations remain cleanly displayed in the right-hand inspection dossier.
> - **Enlarged Center Hub & Slimmer Wedges**: Wedge thickness is narrowed from 112px to 76px (`rInner = 236`, `rOuter = 312`), expanding the center calibration circle radius to 228px (diameter 456px).
> - **14 Discrete Radar Axes**: The center radar chart expands from 11 merged axes to 14 discrete axes aligned 1:1 with the 14 canonical Michael Edwards families (giving Water, Green, and Fruity their own dedicated axes and labels).
> - **Zero-Selection State on "All 14 Families"**: When "All 14 Families" is active, `selectedFamilyId` is set to `null` so no sector appears outlined or selected in the SVG.
> - **Streamlined Header**: "Help & Tutorial" and "About & Privacy" tabs are removed from the top navigation. "Olfactory Mentor" is repositioned directly adjacent to "6. Evaluate".

---

### 1. Overview & Core Concept

**What It Does**:
1. **Transparent Formula Workflow**: Connects Palette (raw material organ) and Accords (pre-harmonized bases) to formula creation through explicit target selection, ensuring perfumers always know what formula they are working on and how materials flow through the development route.
2. **Academic Michael Edwards Olfactory Wheel**: Provides a clutter-free circular schematic with outer aspect boundaries (`FLORAL`, `AMBERY`, `WOODY`, `FRESH`), clean unencumbered colored wedges, large readable curved typography, and a 14-facet center radar chart comparing intentional formula brief against sensory blotter results.
3. **Clean Top Bar**: Eliminates secondary auxiliary tabs in the header, keeping the perfumer focused on the 6-step creation route and instant Olfactory Mentor access.

---

### 2. User Experience & Visual Design

#### A. Formula Creation & Route Guidance
- **Step 1: Palette (Raw Materials Organ)**:
  - Header displays a clear workflow subtitle: *"Raw Single Materials · Start New Formula or Add to Selected Project"*.
  - Added action buttons on selected materials: *"Start New Formula with Note"* and *"Add to Formula..."*.
- **Step 2: Accords (Pre-Harmonized Bases)**:
  - Header displays workflow subtitle: *"Pre-Harmonized Bases · Insert into Formula or Save Iterations"*.
  - When clicking *"Insert into Formula"* (in either Compact or Detailed view), a modal appears:
    - Lists all active formulas with current formula name, project name, concentration, and active version.
    - Includes an option to *"+ Create New Formula with this Accord"*.
    - Dosage selector (e.g. 5g, 10g, 15g, 20g, or custom).
    - Confirmation button: *"Add [X]g [Accord Name] to [Formula Name] →"*.
- **Route Breadcrumb Ribbon**:
  - `1. Palette` → `2. Accords` → `3. Wheel` → `4. Pyramid` → `5. Formula Lab` → `6. Evaluate` → `Olfactory Mentor`.

#### B. Olfactory Wheel Visual Cleanliness
- **Sleek Solid Wedges**: Wedges are rendered as clean, high-saturation color blocks without internal pill labels.
- **Outer Curved Typography**: Sub-family titles (`Floral`, `Soft Floral`, `Floral Amber`, `Soft Amber`, `Amber`, `Woody Amber`, `Woods`, `Mossy Woods`, `Dry Woods`, `Aromatic`, `Citrus`, `Water`, `Green`, `Fruity`) sit cleanly along the outer arc in 15px bold typography.
- **Center Circle & Radar Chart**:
  - Radius expanded to 228px with radial background gradient.
  - 14 concentric radar axes spaced at 25.71° intervals matching each wedge:
    1. `Floral` (-167.1°)
    2. `Soft Floral` (-141.4°)
    3. `Floral Amber` (-115.7°)
    4. `Soft Amber` (-90.0°)
    5. `Amber` (-64.3°)
    6. `Woody Amber` (-38.6°)
    7. `Woods` (-12.9°)
    8. `Mossy Woods` (+12.9°)
    9. `Dry Woods` (+38.6°)
    10. `Aromatic` (+64.3°)
    11. `Citrus` (+90.0°)
    12. `Water` (+115.7°)
    13. `Green` (+141.4°)
    14. `Fruity` (+167.1°)
  - Water, Green, and Fruity each feature distinct axes and readable labels.
- **Neutral "All 14 Families" State**:
  - When filter is set to "All 14 Families", `selectedFamilyId = null`.
  - All 14 wedges render with standard subtle borders (`rgba(255,255,255,0.2)`); none has the selected 3px solid white outline or expanded outer radius.
  - The right-hand panel shows the Global Wheel Distribution and active formula facet breakdown.

#### C. Top Navigation Header
- Top menu retains Zone 1 (Wordmark / Brand) and Zone 3 (Day/Night, Theme, Language, Search).
- Zone 2 Route ribbon ends with `6. Evaluate`, immediately followed by `Olfactory Mentor` (with spark icon).
- "Help & Tutorial" and "About & Privacy" tabs are removed from the header.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Target Formula Selection Modal vs. Inline Dropdown**:
  - *Chosen Approach*: Interactive Target Formula Selection modal triggered on "Insert into Formula".
  - *Why*: Accommodates both choosing an existing formula and creating a brand new formula on the fly without cluttering the compact accord list with repetitive nested dropdowns.
- **Decision 2: Removing Sector Clutter vs. Shrinking Font**:
  - *Chosen Approach*: Complete removal of interior sector pills, allowing wedges to be narrower and center hub to be much larger.
  - *Why*: Sector wedges at 25.7° are too narrow at the inner radius for readable multi-line horizontal text. Removing them matches authentic Michael Edwards reference charts and gives 448px of pristine center space.
- **Decision 3: 14-Axis Radar Alignment**:
  - *Chosen Approach*: Map all 14 families directly to the 14 radial axes of the radar chart.
  - *Why*: Resolves user feedback where Green previously merged Fruity and Water, ensuring each facet is tracked independently.

---

### 4. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App.tsx Top Navigation                         │
│  [OsmoLab]  —  [1.Palette → 2.Accords → 3.Wheel → 4.Pyramid →         │
│                 5.Formula Lab → 6.Evaluate  |  Olfactory Mentor]       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  PaletteView (1)     │ │  AccordBuilder (2)   │ │ OlfactoryWheel (3)   │
│ - Raw Materials Organ│ │ - Pre-harmonized base│ │ - 14-Sector Ring     │
│ - "Create Formula"   │ │ - "Insert into Form" │ │ - 14-Axis Radar Chart│
│ - "Add Note to Form" │ │ - Target Formula Pick│ │ - No-selection state │
└──────────┬───────────┘ └──────────┬───────────┘ └──────────┬───────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Active Formula State & Store                       │
│  - Formulas collection (Draft / Committed / Versions)                  │
│  - Active Formula ID & Active Version                                  │
│  - Optimistic updates & PostgreSQL synchronization                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Implementation Sequence:
1. **Target Formula Selector**:
   - Create a reusable `TargetFormulaModal` inside `MaterialsAndInventoryView.tsx`.
   - Wire accord insert buttons to open the modal, allowing selection of any existing formula or creating a new formula.
   - Add Palette note insertion to target formula.
2. **Olfactory Wheel Updates (`OlfactoryWheelView.tsx`)**:
   - Update `RADAR_AXES_CLOCKWISE` to include all 14 distinct families (Floral, Soft Floral, Floral Amber, Soft Amber, Amber, Woody Amber, Woods, Mossy Woods, Dry Woods, Aromatic, Citrus, Water, Green, Fruity).
   - Update wheel dimensions: `rCenterHub = 228`, `rRadarMax = 175`, `rInnerSub = 236`, `rOuterSub = 312`.
   - Remove interior rect/text pills from sector rendering loop.
   - Support `selectedFamilyId: string | null = null` when `macroFilter === 'All'`.
3. **Top Navigation Cleanup (`App.tsx`)**:
   - Remove `Help & Tutorial` and `About & Privacy` buttons from the header.
   - Position `Olfactory Mentor` directly after `6. Evaluate`.
4. **Verification**:
   - Compile applet with `compile_applet`.
   - Run existing unit tests (`npm test`).
   - Validate visual aesthetics and interactions.
