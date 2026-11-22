"""Original review-only anime identity over Claire's existing skin coordinates."""
import numpy as np

from scripts.claire_reference_study import EYES, _positions, _smooth
from scripts.glb_head_study import elara_eye_details
from verona.appearance import claire_eyes, native_hair_scale


HAIR = np.array([.25, .16, .40])


def anime_warp(positions):
    p = _positions(positions)
    x, y, z = p.T
    cx = .08
    front = _smooth(-3, 0, z)
    head = _smooth(132, 136, y)
    jaw = np.exp(-((y-137.8)/3.6)**2)
    cheek = np.exp(-((y-143.7)/2.3)**2)
    q = p.copy()
    q[:, 0] = cx+(x-cx)*(1-head*(.23*jaw+.045*cheek))
    q[:, 1] += head*np.where(y < 148, .115*(148-y), .035*(y-148))
    q[:, 2] += front*head*(
        .35*np.exp(-((abs(x-cx)-4.2)/2.1)**2-((y-144.2)/2.3)**2)
        -1.05*np.exp(-((x-cx)/1.35)**4-((y-143.6)/2.7)**4))
    for ex, ey, _ in EYES:
        orbital = np.exp(-((x-ex)/2.15)**4-((y-ey)/2.2)**2)*front
        q[:, 0] += .22*(x-ex)*orbital
        q[:, 1] += .56*(y-ey)*orbital
        q[:, 1] += .10*(abs(x-cx)-3.02)*orbital
    mouth = np.exp(-((x-cx)/3.1)**6-((y-140.2)/1.8)**6)*front
    q[:, 0] -= .10*(x-cx)*mouth
    if not np.isfinite(q).all() or np.linalg.norm(q-p, axis=1).max() > 3:
        raise ValueError("Anime shape exceeds its finite three-centimeter displacement bound.")
    return q


def blink_skin(rest, pose, amount):
    if not np.isfinite(amount) or not 0 <= amount <= 1:
        raise ValueError("Anime blink must be a finite amount in [0,1].")
    rest, pose = _positions(rest), _positions(pose)
    if rest.shape != pose.shape:
        raise ValueError("Anime blink requires the original skin correspondence.")
    eye = np.argmin(abs(rest[:, None, 0]-EYES[:, 0]), axis=1)
    local = (rest-EYES[eye])/[1.65, .85, 1.4]
    influence = (1-_smooth(1.05, 1.9, np.linalg.norm(local[:, :2], axis=1)))*_smooth(.15, .65, local[:, 2])
    delta = np.column_stack((np.zeros(len(rest)), -local[:, 1]*.85,
                            np.maximum(0, 1.04-local[:, 2])*1.4))
    return pose+delta*(influence*amount)[:, None]


def _strand(line, widths, depths, lateral):
    tangent = np.gradient(line, axis=0)
    tangent /= np.linalg.norm(tangent, axis=1)[:, None]
    cross = np.broadcast_to(lateral, line.shape).astype(float).copy()
    cross -= tangent*np.sum(cross*tangent, axis=1)[:, None]
    lengths = np.linalg.norm(cross, axis=1)
    if np.any(lengths < 1e-8):
        raise ValueError("Hair guide has a singular cross-section.")
    cross /= lengths[:, None]
    normal = np.cross(tangent, cross)
    angles = np.arange(8)*np.pi/4
    points = (line[:, None]+cross[:, None]*(widths[:, None]*np.cos(angles))[..., None]
              +normal[:, None]*(depths[:, None]*np.sin(angles))[..., None]).reshape(-1, 3)
    faces = []
    for i in range(len(line)-1):
        for j in range(8):
            a, b = i*8+j, i*8+(j+1) % 8
            faces.extend(((a, b, b+8), (a, b+8, a+8)))
    points = np.vstack((points, line[0], line[-1]))
    for j in range(8):
        faces.extend(((len(points)-2, (j+1) % 8, j),
                      (len(points)-1, (len(line)-1)*8+j, (len(line)-1)*8+(j+1) % 8)))
    return points, np.asarray(faces, dtype="<u4")


def anime_hair(rest):
    """Original scalp shell, layered bob, separated fringe and framing locks."""
    fit = native_hair_scale(rest)
    points, faces, shades = [], [], []

    def append(p, f, shade):
        offset = sum(len(v) for v in points)
        points.append(p)
        faces.append(f+offset)
        shades.extend([shade]*len(p))

    columns, rows = 64, 18
    shell, triangles = [], []
    for i in range(rows):
        for j in range(columns):
            a = 2*np.pi*j/columns
            theta = .015+i/(rows-1)*(1.80-.66*max(0, np.cos(a)))
            shell.append([9.7*fit*np.sin(theta)*np.sin(a),
                          148.2+11.2*fit*np.cos(theta),
                          -5.7+11.8*fit*np.sin(theta)*np.cos(a)])
    for i in range(rows-1):
        for j in range(columns):
            a, b = i*columns+j, i*columns+(j+1) % columns
            triangles.extend(((a, a+columns, b), (b, a+columns, b+columns)))
    append(np.asarray(shell), np.asarray(triangles), 1.)
    for k, angle in enumerate(np.linspace(.82, 2*np.pi-.82, 24)):
        t = np.linspace(0, 1, 26)
        theta = np.minimum(1.6, .22+2.7*t)
        fall = np.maximum(0, (t-.45)/.55)
        line = np.column_stack((9.9*fit*np.sin(theta)*np.sin(angle),
            148.2+11.3*fit*np.cos(theta)-(8.7+.5*np.cos(k))*fall,
            -5.7+12.*fit*np.sin(theta)*np.cos(angle)))
        line[:, 0] += .35*np.sin(np.pi*t)*np.sin(2*angle)
        taper = .03+np.sin(np.pi*(.05+.95*t))**.45
        append(*_strand(line, 1.25*taper, .42*taper,
                        [np.cos(angle), 0, -np.sin(angle)]), .87+.15*(k % 3))
    for k, angle in enumerate(np.linspace(-.65, .65, 9)):
        t = np.linspace(0, 1, 24)
        theta = .12+t*(1.17+.045*np.cos(k*1.3))
        line = np.column_stack((10.0*fit*np.sin(theta)*np.sin(angle+.08*np.sin(t*np.pi)),
             148.2+11.35*fit*np.cos(theta),
             -5.7+12.1*fit*np.sin(theta)*np.cos(angle)))
        taper = (.10+.90*np.sin(np.pi*t/2))*(1-.98*t**5)
        append(*_strand(line, .92*taper, .30*taper,
                        [np.cos(angle), 0, -np.sin(angle)]), .95+.12*(k % 2))
    for side in (-1, 1):
        t = np.linspace(0, 1, 30)
        line = np.column_stack((side*(6.1+.45*np.sin(np.pi*t)-.25*t),
            153.7-15*t, 4.1+1.4*np.sin(np.pi*t)-.2*t))
        taper = (.35+.65*np.sin(np.pi*t/2))*(1-.98*t**6)
        append(*_strand(line, .72*taper, .32*taper, [1, 0, 0]), 1.18)
    return np.vstack(points), np.vstack(faces).astype("<u4"), np.asarray(shades)


def eye_optics():
    points, faces = claire_eyes()
    all_points, all_faces = [points], [faces]
    colors = [np.tile([1., .97, .94, 1.], (len(points), 1))]
    for ex, ey, ez in EYES:
        for kind, rx, ry, dx, dy, bias in (
                ("iris", .72, .96, 0, 0, .025),
                ("pupil", .25, .64, 0, 0, .045),
                ("light", .18, .23, -.22, .39, .065),
                ("light", .065, .085, .25, -.30, .065)):
            patch, paint, triangles = [], [], []
            for ring in range(9):
                radius = .001+ring/8*.999
                for j in range(40):
                    angle = j/40*2*np.pi
                    x, y = dx+rx*radius*np.cos(angle), dy+ry*radius*np.sin(angle)
                    z = ez+1.4*np.sqrt(max(.001, 1-(x/1.35)**2-(y/1.32)**2))+bias
                    patch.append([ex+x, ey+y, z])
                    color = ([.055, .15+.42*(1-radius), .17+.46*(1-radius)]
                             if kind == "iris" else [.025, .04, .065] if kind == "pupil"
                             else [1., 1., 1.])
                    paint.append([*color, 1.])
            for i in range(8):
                for j in range(40):
                    a, b = i*40+j, i*40+(j+1) % 40
                    triangles.extend(((a, b, b+40), (a, b+40, a+40)))
            offset = sum(len(p) for p in all_points)
            all_points.append(np.asarray(patch))
            all_faces.append(np.asarray(triangles)+offset)
            colors.append(np.asarray(paint))
    return np.vstack(all_points), np.vstack(all_faces).astype("<u4"), np.vstack(colors)


def assemble(rest, faces):
    rest = _positions(rest)
    detail, detail_faces, move_details, detail_receipt = elara_eye_details(rest, faces)
    eyes, eye_faces, eye_colors = eye_optics()
    hair, hair_faces, shades = anime_hair(rest)
    # Skin carries original coordinates for continuous, pose-following cosmetics.
    skin_colors = np.column_stack((rest, np.zeros(len(rest))))
    detail_colors = np.tile([.075, .035, .105, -.25], (len(detail), 1))
    hair_colors = np.column_stack((shades[:, None]*HAIR, -np.ones(len(hair))))
    colors = np.vstack((skin_colors, eye_colors, detail_colors, hair_colors)).astype("<f4")
    total_faces = np.vstack((faces, eye_faces+len(rest),
        detail_faces+len(rest)+len(eyes),
        hair_faces+len(rest)+len(eyes)+len(detail))).astype("<u4")

    def pose(skin, blink=0, *, styled=True, include_hair=True):
        skin = blink_skin(rest, skin, blink)
        pieces = [skin, eyes, move_details(skin)]
        if include_hair:
            pieces.append(hair)
        result = np.vstack(pieces)
        return anime_warp(result) if styled else result

    return pose, total_faces, colors, {
        "skinVertices": len(rest), "eyeVertices": len(eyes), "detailVertices": len(detail),
        "hairVertices": len(hair), "hairTriangles": len(hair_faces),
        "detailBinding": detail_receipt,
        "style": "Original adult anime-woman direction: heart/oval face, larger almond eyes, teal optics, violet layered bob.",
        "limits": "Review only; inherited Claire skin/PCA, cosmetic blink, static eyes and rigid hair; no new trained rig.",
    }
