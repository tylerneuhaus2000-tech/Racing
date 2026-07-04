#!/usr/bin/env python3
"""Erzeugt stilisierte Low-Poly-GLB-Modelle für die Streckenumgebung.
Alle Modelle: ein gemergtes Mesh mit Vertex-Colors -> 1 Draw-Call, instancing-fähig.
Einheiten: Meter. +Y = oben. Ursprung am Boden-Mittelpunkt."""
import numpy as np
import trimesh
from trimesh.creation import box, cylinder, icosphere, cone

OUT = '/Users/tylerneuhaus/Racing/assets/models/env'

def col(mesh, rgb):
    c = np.array([rgb[0], rgb[1], rgb[2], 255], dtype=np.uint8)
    mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=np.tile(c, (len(mesh.vertices), 1)))
    return mesh

def at(mesh, x, y, z):
    mesh.apply_translation([x, y, z])
    return mesh

def merge(parts, name):
    m = trimesh.util.concatenate(parts)
    m.metadata['name'] = name
    return m

def export(mesh, fname):
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=mesh.metadata.get('name', 'model'))
    scene.export(f'{OUT}/{fname}')
    print(f'{fname}: {len(mesh.vertices)} verts, {len(mesh.faces)} tris')

# ───────────────────────── Bäume ─────────────────────────
def tree_pine():
    parts = []
    trunk = col(cylinder(radius=0.28, height=2.2, sections=7), (94, 62, 40))
    parts.append(at(trunk, 0, 1.1, 0))
    greens = [(34, 96, 50), (42, 116, 58), (52, 138, 66)]
    for i, (r, h, y) in enumerate([(2.6, 3.2, 3.2), (2.1, 2.8, 4.9), (1.5, 2.4, 6.4)]):
        c = cone(radius=r, height=h, sections=8)
        parts.append(at(col(c, greens[i]), 0, y, 0))
    return merge(parts, 'tree_pine')

def tree_oak():
    parts = []
    trunk = col(cylinder(radius=0.34, height=2.6, sections=7), (98, 66, 42))
    parts.append(at(trunk, 0, 1.3, 0))
    blobs = [(0, 4.4, 0, 2.3, (56, 128, 52)), (1.5, 3.7, 0.6, 1.5, (66, 146, 60)),
             (-1.4, 3.9, -0.5, 1.6, (48, 116, 46)), (0.3, 5.6, -0.9, 1.3, (72, 156, 66))]
    for x, y, z, r, c in blobs:
        s = icosphere(subdivisions=1, radius=r)
        parts.append(at(col(s, c), x, y, z))
    return merge(parts, 'tree_oak')

# ───────────────────────── Tribüne ─────────────────────────
def grandstand():
    parts = []
    W, D = 42.0, 15.0
    # Fundament
    parts.append(at(col(box(extents=[W, 1.2, D]), (72, 76, 84)), 0, 0.6, 0))
    # Sitzstufen (8 Reihen, ansteigend), abwechselnd rot/blau/weiß gesprenkelt
    seat_cols = [(200, 34, 46), (30, 90, 200), (225, 228, 232)]
    for i in range(8):
        z = -D/2 + 1.4 + i * 1.55
        y = 1.2 + i * 0.72
        step = col(box(extents=[W - 1.5, 0.72, 1.55]), (96, 102, 112))
        parts.append(at(step, 0, y + 0.36, z + 0.775))
        # Sitzreihe als farbiger Streifen oben auf der Stufe
        seat = col(box(extents=[W - 2.2, 0.28, 0.9]), seat_cols[i % 3])
        parts.append(at(seat, 0, y + 0.72 + 0.14, z + 0.55))
    # Rückwand
    parts.append(at(col(box(extents=[W, 7.4, 0.5]), (225, 228, 232)), 0, 1.2 + 3.7, D/2 - 0.25))
    # Dach: leicht geneigtes weißes Dach, vorne auskragend
    roof = col(box(extents=[W + 2.0, 0.35, D + 3.0]), (240, 242, 246))
    roof.apply_transform(trimesh.transformations.rotation_matrix(np.radians(-7), [1, 0, 0]))
    parts.append(at(roof, 0, 9.4, 0.5))
    # Dachstützen hinten (5 Stück)
    for i in range(5):
        x = -W/2 + 2 + i * (W - 4) / 4
        parts.append(at(col(cylinder(radius=0.22, height=8.6, sections=6), (150, 156, 165)), x, 1.2 + 4.3, D/2 - 1.0))
    # Seitenwände
    for sx in (-1, 1):
        parts.append(at(col(box(extents=[0.4, 6.5, D - 1]), (208, 212, 218)), sx * (W/2 - 0.2), 1.2 + 3.25, 0.4))
    return merge(parts, 'grandstand')

# ───────────────────────── Kontrollturm ─────────────────────────
def control_tower():
    parts = []
    # Sockel
    parts.append(at(col(box(extents=[6, 1.0, 6]), (88, 92, 100)), 0, 0.5, 0))
    # Turmschaft
    parts.append(at(col(cylinder(radius=1.6, height=13, sections=10), (225, 228, 232)), 0, 1.0 + 6.5, 0))
    # Kanzel: dunkles Glas, achteckig, auskragend
    parts.append(at(col(cylinder(radius=4.2, height=0.5, sections=8), (200, 204, 210)), 0, 14.2, 0))
    parts.append(at(col(cylinder(radius=3.9, height=2.8, sections=8), (46, 84, 120)), 0, 15.9, 0))
    parts.append(at(col(cylinder(radius=4.3, height=0.6, sections=8), (235, 238, 242)), 0, 17.6, 0))
    # Antenne
    parts.append(at(col(cylinder(radius=0.09, height=3.4, sections=5), (140, 146, 155)), 0, 19.6, 0))
    parts.append(at(col(icosphere(subdivisions=1, radius=0.28), (255, 46, 61)), 0, 21.4, 0))
    return merge(parts, 'control_tower')

# ───────────────────────── Werbetafel ─────────────────────────
def billboard():
    """Rahmen + Beine; die Anzeigefläche heißt 'screen' und bekommt im Spiel
    die Canvas-Sponsortextur zugewiesen."""
    parts = []
    W, H = 10.0, 2.6
    for sx in (-1, 1):
        parts.append(at(col(box(extents=[0.30, 2.2, 0.30]), (60, 64, 72)), sx * (W/2 - 0.6), 1.1, 0))
    frame = col(box(extents=[W + 0.5, H + 0.5, 0.42]), (28, 31, 36))
    parts.append(at(frame, 0, 2.2 + H/2, 0))
    # Kleine Spots oben
    for i in range(3):
        x = -W/2 + W * (i + 0.5) / 3
        parts.append(at(col(box(extents=[0.35, 0.18, 0.5]), (200, 204, 210)), x, 2.2 + H + 0.35, 0.25))
    body = merge(parts, 'billboard_frame')
    # Screen als SEPARATES Mesh in der Szene (für Textur-Zuweisung per Name)
    screen = col(box(extents=[W, H, 0.06]), (245, 245, 245))
    at(screen, 0, 2.2 + H/2, 0.26)
    screen.metadata['name'] = 'screen'
    scene = trimesh.Scene()
    scene.add_geometry(body, node_name='billboard_frame', geom_name='billboard_frame')
    scene.add_geometry(screen, node_name='screen', geom_name='screen')
    scene.export(f'{OUT}/billboard.glb')
    print(f'billboard.glb: frame {len(body.faces)} tris + screen')

# ───────────────────────── Bürogebäude ─────────────────────────
def office_building():
    parts = []
    W, D, H = 18.0, 14.0, 26.0
    # Korpus
    parts.append(at(col(box(extents=[W, H, D]), (196, 200, 208)), 0, H/2, 0))
    # Fensterbänder: dunkle Glasstreifen je Etage auf allen 4 Seiten
    floors = 8
    for f in range(floors):
        y = 2.2 + f * (H - 3) / floors
        for side in range(4):
            if side < 2:  # vorne/hinten
                g = col(box(extents=[W - 2.0, 1.5, 0.15]), (38, 62, 92))
                at(g, 0, y, (D/2 + 0.03) * (1 if side == 0 else -1))
            else:  # links/rechts
                g = col(box(extents=[0.15, 1.5, D - 2.0]), (38, 62, 92))
                at(g, (W/2 + 0.03) * (1 if side == 2 else -1), y, 0)
            parts.append(g)
    # Dachaufbau
    parts.append(at(col(box(extents=[W * 0.4, 1.8, D * 0.4]), (150, 155, 163)), 0, H + 0.9, 0))
    return merge(parts, 'office_building')

# ───────────────────────── Hospitality ─────────────────────────
def hospitality():
    parts = []
    W, D, H = 30.0, 12.0, 9.0
    # Zwei Etagen: unten offen mit Stützen, oben Glas-Lounge
    parts.append(at(col(box(extents=[W, 0.8, D]), (88, 92, 100)), 0, 0.4, 0))
    for i in range(6):
        x = -W/2 + 2 + i * (W - 4) / 5
        parts.append(at(col(cylinder(radius=0.25, height=3.6, sections=6), (170, 175, 183)), x, 0.8 + 1.8, 0))
    parts.append(at(col(box(extents=[W, 0.6, D]), (225, 228, 232)), 0, 4.7, 0))
    # Glas-Etage
    parts.append(at(col(box(extents=[W - 1.0, 3.0, D - 1.0]), (52, 92, 128)), 0, 5.0 + 1.5, 0))
    # Weißes Flachdach mit Überstand
    parts.append(at(col(box(extents=[W + 2.5, 0.5, D + 2.5]), (240, 242, 246)), 0, 8.4, 0))
    # Geländer-Andeutung Dachterrasse
    parts.append(at(col(box(extents=[W + 2.5, 0.5, 0.15]), (200, 204, 210)), 0, 9.0, (D + 2.5)/2))
    return merge(parts, 'hospitality')

for fn, builder in [('tree_pine.glb', tree_pine), ('tree_oak.glb', tree_oak),
                    ('grandstand.glb', grandstand), ('control_tower.glb', control_tower),
                    ('office_building.glb', office_building), ('hospitality.glb', hospitality)]:
    export(builder(), fn)
billboard()
print('FERTIG')
