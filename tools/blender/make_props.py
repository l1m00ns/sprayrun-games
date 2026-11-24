"""Blender (headless) asset authoring for Spray Run.

    blender -b -P tools/blender/make_props.py -- public/models/props.glb

Models are built from bevelled primitives (blockout -> bevel -> details), one object per material.
Object names are "<model>_<part>": the engine merges everything sharing the <model> prefix and
paints it with the material colours, then renders it with its own toon shader.
Units: 1 unit = 1 m, exported Y-up (glTF).
"""
import sys
import math
import bpy
import bmesh

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'props.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)
mats = {}


def material(name, rgb):
    if name not in mats:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        mats[name] = m
    return mats[name]


def finish(obj, name, mat, bevel=0.0, segments=3, smooth=True):
    obj.name = name
    obj.data.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    obj.select_set(False)
    return obj


def box(name, mat, size, loc, bevel=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, mat, bevel)


def cylinder(name, mat, radius, depth, loc, rot=(0, 0, 0), verts=24, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.active_object, name, mat, bevel)


def half_cylinder(name, mat, radius, length, loc):
    """Arched chest lid: cylinder along X, lower half removed."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=length, location=loc, rotation=(0, math.radians(90), 0))
    o = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, loc[2]), plane_no=(0, 0, 1), clear_inner=True)
    edges = [e for e in bm.edges if e.is_boundary]
    bmesh.ops.holes_fill(bm, edges=edges)
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, name, mat, 0.015)


WOOD = material('wood', (0.78, 0.36, 0.1))
WOOD_D = material('wood_dark', (0.48, 0.2, 0.05))
GOLD = material('gold', (1.0, 0.72, 0.1))
DARK = material('dark', (0.12, 0.07, 0.04))

# ------------------------------------------------------------- mystery chest (about 1.0 x 0.8 x 0.7)
box('chest_body', WOOD, (1.0, 0.62, 0.7), (0, 0, 0.31), bevel=0.05)
box('chest_base', WOOD_D, (1.04, 0.1, 0.74), (0, 0, 0.05), bevel=0.02)
half_cylinder('chest_lid', WOOD, 0.35, 1.0, (0, 0, 0.62))
for x in (-0.32, 0.32):
    box('chest_band', GOLD, (0.09, 0.64, 0.73), (x, 0, 0.31), bevel=0.02)
    half_cylinder('chest_bandlid', GOLD, 0.365, 0.09, (x, 0, 0.62))
box('chest_lock', GOLD, (0.16, 0.06, 0.2), (0, -0.37, 0.55), bevel=0.02)
cylinder('chest_keyhole', DARK, 0.03, 0.02, (0, -0.405, 0.55), rot=(math.radians(90), 0, 0), verts=12)
for sx in (-0.5, 0.5):
    for sy in (-0.34, 0.34):
        cylinder('chest_rivet', GOLD, 0.035, 0.03, (sx, sy, 0.62 - 0.3), verts=10)

# ------------------------------------------------------------------ hoverboard (0.62 wide, 1.5 long)
DECK = material('deck', (1.0, 0.31, 0.5))
GRIP = material('grip', (0.17, 0.17, 0.24))
GLOW = material('glow', (0.32, 0.95, 1.0))
METAL = material('metal', (0.8, 0.83, 0.88))
box('board_deck', DECK, (0.62, 1.3, 0.09), (0, 0, 0.0), bevel=0.04)
for sy in (-1, 1):
    box('board_tip', DECK, (0.6, 0.3, 0.08), (0, sy * 0.72, 0.06), bevel=0.035, rot=(math.radians(-18 * sy), 0, 0))
box('board_grip', GRIP, (0.5, 1.1, 0.02), (0, 0, 0.05), bevel=0.008)
for sx in (-1, 1):
    box('board_rail', GLOW, (0.04, 1.2, 0.05), (sx * 0.3, 0, -0.01), bevel=0.012)
for sy in (-0.42, 0.42):
    cylinder('board_pod', METAL, 0.1, 0.07, (0, sy, -0.075), verts=20, bevel=0.01)
    cylinder('board_podglow', GLOW, 0.065, 0.02, (0, sy, -0.115), verts=20)

# ------------------------------------------------------------------ export
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, use_selection=True)
print('EXPORTED', out, 'objects:', len(bpy.data.objects))
