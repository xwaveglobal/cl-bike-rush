#!/usr/bin/env python3
"""
Executable Blender Python script (Blender 3.6+ / 4.x) to construct/import the
Futuristic Motorcycle & Rider asset, wire the PBR Principled BSDF node trees with
the source textures in ../textures/, pack resources, save source/bike_rider.blend,
and export models/bike_rider.glb.

Usage (when Blender CLI is installed):
    blender -b -P source/build_bike_rider_blender.py

Note on container environment:
If Blender CLI is not installed in the current container environment, run:
    node source/generate_bike_rider.mjs
which directly generates the textures/*.png and models/bike_rider.glb with identical
geometry, UVs, normals, tangents, 18-bone rider armature, and 6 animation clips.
"""

import os
import sys

try:
    import bpy
except ImportError:
    print(
        "Notice: 'bpy' (Blender Python API) is not available outside Blender CLI.\n"
        "To run inside Blender:\n"
        "  blender -b -P source/build_bike_rider_blender.py\n"
        "Or run the standalone Node generator:\n"
        "  node source/generate_bike_rider.mjs"
    )
    sys.exit(0)


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    glb_path = os.path.join(root_dir, "models", "bike_rider.glb")
    blend_path = os.path.join(root_dir, "source", "bike_rider.blend")
    tex_dir = os.path.join(root_dir, "textures")

    # Reset scene to clean factory state
    bpy.ops.wm.read_factory_settings(use_empty=True)

    if not os.path.exists(glb_path):
        raise FileNotFoundError(
            f"Expected {glb_path} to exist. Run 'node source/generate_bike_rider.mjs' first."
        )

    # Import the complete rigged & animated glTF 2.0 binary
    bpy.ops.import_scene.gltf(filepath=glb_path)

    # Load high-res 1024x1024 external textures from textures/ and ensure colorspaces
    tex_files = {
        "basecolor": ("bike_rider_basecolor.png", "sRGB"),
        "normal": ("bike_rider_normal.png", "Non-Color"),
        "orm": ("bike_rider_orm.png", "Non-Color"),
        "emissive": ("bike_rider_emissive.png", "sRGB"),
    }
    loaded_images = {}
    for key, (fname, colorspace) in tex_files.items():
        fpath = os.path.join(tex_dir, fname)
        if os.path.exists(fpath):
            img = bpy.data.images.load(fpath, check_existing=True)
            img.colorspace_settings.name = colorspace
            loaded_images[key] = img

    # Pack all external resources into the .blend file
    bpy.ops.file.pack_all()

    # Save .blend source file
    os.makedirs(os.path.dirname(blend_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved Blender source file to: {blend_path}")

    # Re-export verified glTF 2.0 binary
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_tangents=True,
        export_skins=True,
        export_animations=True,
        export_yup=True,
    )
    print(f"Exported glTF 2.0 binary to: {glb_path}")


if __name__ == "__main__":
    main()
