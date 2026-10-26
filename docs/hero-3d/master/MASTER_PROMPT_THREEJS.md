# MASTER PROMPT — THREE.JS MOTORCYCLE RECONSTRUCTION / DETAIL LOCK

ROLE: Senior hard-surface vehicle modeler, technical artist and Three.js graphics engineer. Improve the EXISTING motorcycle + rider 3D implementation, not a new unrelated vehicle. Study original_reference.jpeg, all 22 cropped reference images, and video_frames showing the current build. Compare shape and details; correct every mismatch.

OBJECTIVE: Closely match the exact silver/black/electric-blue futuristic full-fairing sportbike and blue/black/silver armored rider in the supplied multi-view reference. Preserve the design language, silhouettes, proportions and colors. The reference is a concept sheet, not a dimensionally accurate CAD orthographic blueprint; resolve discrepancies using coherent real 3D geometry. Do not claim pixel-perfect reconstruction without actual CAD.

PRIORITY 0 — CAMERA / COORDINATES: Set +Y up; front = -Z, rear = +Z, left/right symmetric X axes except realistic exhaust and drivetrain asymmetry. Confirm mapping against FRONT/REAR/LEFT/RIGHT/TOP labels in the reference. Use orthographic inspection cameras front/rear/left/right/top plus perspective 3/4 views. Fix mirrored or reversed orientation before modeling. Keep bike grounded; both tire contact patches align with ground.

PRIORITY 1 — BIKE GEOMETRY: Realistic supersport wheelbase and rider ergonomics; sharply pointed front nose, tinted angled windscreen, layered angular full fairings, low clip-on handlebars, mirrors, sculpted fuel tank, black narrow saddle, elevated pointed tail. Model actual thickness, panel seams, vents, inset black cavities and layered surfaces rather than flat decals. Do not stretch the rear tail, elongate the nose, enlarge wheels or use blocky primitives as final geometry. Maintain clear negative spaces and visible engine housing, chassis, swingarm and exhaust.

PRIORITY 2 — COMPONENTS: front cyan angular LED pair, separate DRL emissive strips and dark recessed lamp housings; gold front telescopic forks; front disc brakes with perforations and calipers; correctly oriented rubber tire tread, rims with thin blue pinstripe, spokes and hubs; chain/sprocket on correct side, swingarm and rear shock; one realistic metallic cylindrical side exhaust; rear cyan V-shaped tail lamps and tiny central red element. All elements must remain visible from correct angles and attached physically.

PRIORITY 3 — MATERIALS: Silver pearlescent metal paint, near-black carbon/plastic, saturated royal-blue accent panels, electric cyan LED. Use MeshPhysicalMaterial/standard PBR with tuned metalness/roughness; subtle clearcoat on paint; dark nonmetal rubber; rough leather seat; glass windscreen with realistic transmission/tint. Avoid plastic toy look, excessive bloom, neon halos, overly bright blue or flat unlit materials. Use ACESFilmic tone mapping and correct output color space.

PRIORITY 4 — RIDER: Full-face black/silver/blue helmet with glossy dark visor, blue geometric accent strips, segmented shoulder/chest/back protectors, fitted black technical suit, elbow/knee armor, gloves and boots. Rider leaning forward with both hands correctly gripping bars and feet on pegs. Proper contact points and joint articulation, no limb intersections or hovering. Helmet proportions and shoulder armor must resemble reference.

PRIORITY 5 — TOPOLOGY / RENDER: Prefer clean custom BufferGeometry/extruded contour meshes and smooth normals for fairings; cylinders/lathe for mechanically rotational parts; correct shading groups and bevels; no z-fighting or visible intersections. Use physically reasonable lighting, ambient/environment fill, contact shadows, and neutral light-gray studio background for verification. Optimize for mobile game: reusable geometries, draw-call batching/instancing where useful, compressed textures, 3 LOD levels, stable 60fps target on midrange mobile hardware.

VALIDATION: Build a 6-view contact sheet matching the reference: FRONT, LEFT, REAR, RIGHT, BIKE SIDE (without rider), BIKE TOP (without rider). Also render rear-overhead gameplay camera view. Compare each against the named PNG crops; write a mismatch checklist (silhouette, front fairing, lamps, fork, wheelbase, tail, exhaust, tank, rider pose, decals). Iterate until critical shape errors are eliminated. Do not alter gameplay controls, collision, camera follow, animation logic, UI or existing assets outside the bike unless required for compatibility. Keep existing Three.js project architecture and API.

DELIVERABLES: Commit code changes, list changed files, provide before/after screenshots from same camera, a component checklist with pass/fail, known reference ambiguities, mobile performance notes, and run/build instructions. If reference image cannot uniquely define a hidden component, implement plausible coherent geometry and mark as inferred, not exact.

REFERENCE MAP:
01-06: full views and clean bike views.
07-15: lamps, nose, front/rear wheel, fairings, swingarm, exhaust.
16-20: front brake, tank/seat, tail and cockpit from rider-free views.
21-22: helmet and body armor.
video_frames/: current implementation snapshots, for discrepancy assessment only; target design is original_reference.jpeg.
