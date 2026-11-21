"""Make a local, image-first modeling guide from actual workshop renders."""

import argparse
import hashlib
import html
import json
from pathlib import Path
import textwrap

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1600, 1000
BG, INK, MUTED = "#142130", "#F2F5FA", "#A9BDCF"
COLORS = ["#FFE044", "#8954E8", "#00D5D5", "#168BFF",
          "#EF476F", "#D724CF", "#73D13D", "#FF9F1C"]
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def text(draw, xy, value, size=27, color=INK, bold=False, width=48):
    y = xy[1]
    for line in textwrap.wrap(value, width=width):
        draw.text((xy[0], y), line, font=font(size, bold), fill=color)
        y += size * 1.28
    return y


def canvas():
    return Image.new("RGB", (WIDTH, HEIGHT), BG)


def place(board, path, rect):
    with Image.open(path) as original:
        image = original.convert("RGB")
    image.thumbnail((rect[2]-rect[0], rect[3]-rect[1]), Image.Resampling.LANCZOS)
    x = rect[0]+(rect[2]-rect[0]-image.width)//2
    y = rect[1]+(rect[3]-rect[1]-image.height)//2
    board.paste(image,(x,y))
    return x,y,image.width/1000,image.height/1100


def pair(left, right, labels):
    board = canvas()
    place(board,left,(25,60,790,985))
    place(board,right,(810,60,1575,985))
    draw = ImageDraw.Draw(board)
    text(draw,(55,15),labels[0],30,bold=True)
    text(draw,(845,15),labels[1],30,bold=True)
    return board


def annotated(image, entries, title, source_points=False):
    board = canvas()
    x,y,sx,sy = place(board,image,(335,70,1265,990))
    draw = ImageDraw.Draw(board)
    text(draw,(35,10),title,32,bold=True)
    for index,(label,point,side,label_y,color) in enumerate(entries):
        px,py = point
        if source_points:
            px = 500 + px*.01*1100/.53
            py = 550 - ((py-147.52305)*.01-.005)*1100/.53
        target = (int(x+px*sx),int(y+py*sy))
        lx = 35 if side == "left" else 1280
        edge = 315 if side == "left" else 1280
        bend = x-10 if side == "left" else x+int(1000*sx)+10
        draw.line([(edge,label_y+18),(bend,label_y+18),target],fill=color,width=3)
        draw.ellipse((target[0]-6,target[1]-6,target[0]+6,target[1]+6),fill=color)
        draw.rounded_rectangle((lx,label_y-6,lx+280,label_y+67),12,fill="#1D3045",outline=color,width=2)
        text(draw,(lx+12,label_y+3),label,24,bold=True,width=21)
    return board


def roadmap():
    board = canvas()
    draw = ImageDraw.Draw(board)
    steps = [
        ("01", "OPEN THE WORKSHOP", ".blend", "File > Open", "Claire-Optimus-Workshop.blend"),
        ("02", "OR IMPORT A GLB", ".glb", "File > Import > glTF 2.0", "Claire.glb + Optimus-inspired.glb"),
        ("03", "CHOOSE A COLLECTION", "01 / 02", "Outliner visibility", "Claire reference / robot armor"),
        ("04", "EDIT A COPY", "Save As", "Keep the original kit", "New .blend first; source untouched"),
    ]
    for i,(number,title,tag,menu,detail) in enumerate(steps):
        x,y = 50+(i%2)*790,35+(i//2)*485
        color = COLORS[i*2]
        draw.rounded_rectangle((x,y,x+710,y+420),24,fill="#1D3045",outline=color,width=4)
        text(draw,(x+30,y+22),number,62,color,True)
        text(draw,(x+130,y+45),title,28,bold=True,width=24)
        text(draw,(x+30,y+135),tag,56,color,True)
        text(draw,(x+30,y+245),menu,29,bold=True,width=31)
        text(draw,(x+30,y+310),detail,26,MUTED,width=37)
    return board


def alignment(left, right):
    board = canvas()
    _,y,_,sy = place(board,left,(25,60,790,985))
    place(board,right,(810,60,1575,985))
    draw = ImageDraw.Draw(board)
    text(draw,(55,15),"CLAIRE / SAME ORIGIN",30,bold=True)
    text(draw,(845,15),"ROBOT / SAME SCALE",30,bold=True)
    # Both original orthographic renders use the identical camera and scale.
    for ycm,color,label in [(147.52305,COLORS[2],"EYE HEIGHT / ORIGIN Z = 0"),
                            (140.3,COLORS[5],"LIP BAND / FACEPLATE SEAM"),
                            (136.1,COLORS[6],"CHIN / LOWER GUARD")]:
        py = 550 - ((ycm-147.52305)*.01-.005)*1100/.53
        yy=int(y+py*sy)
        for xx in range(65,1535,20):
            draw.line((xx,yy,xx+9,yy),fill=color,width=3)
        draw.rounded_rectangle((500,yy-28,1090,yy+8),6,fill=BG)
        text(draw,(510,yy-26),label,23,color,True,width=48)
    return board


def editing_board(front, wire):
    board = pair(front,wire,("EDIT ARMOR / NOT THE DRIVER","CLAIRE / KEEP AS REFERENCE"))
    draw = ImageDraw.Draw(board)
    for x,label,color in [(100,"Tab: vertices / edges / faces",COLORS[2]),
                           (900,"Do not remesh this PCA skin",COLORS[5])]:
        draw.rounded_rectangle((x,875,x+610,960),12,fill=BG,outline=color,width=2)
        text(draw,(x+20,895),label,27,color,True,width=35)
    return board


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True,help="Existing workshop directory")
    args = parser.parse_args()
    root = args.output.resolve()
    if not json.loads((root/"roundtrip.json").read_text())["passed"]:
        raise ValueError("Both real GLB reimports must pass before producing a guide.")
    records = {r["id"]:r for r in json.loads((root/"renders.json").read_text())}
    image = lambda name: root/records[name]["file"]
    guide = root/"guide"
    guide.mkdir(exist_ok=False)
    (guide/"plates").mkdir()
    pages = []

    def page(title, subtitle, board, caption):
        name=f"{len(pages)+1:02d}.png"
        board.save(guide/"plates"/name)
        pages.append({"title":title,"subtitle":subtitle,"image":"plates/"+name,"caption":caption})

    page("Claire to an Optimus-inspired head",
         "A visual Blender workshop | local editable assets | 21 November 2026",
         pair(image("claire-three-quarter"),image("robot-three-quarter"),
              ("EXISTING CLAIRE / REFERENCE","NEW EDITABLE ARMOR STUDY")),
         "Start with Claire.glb for the actual face. Open the .blend for the complete editable workshop. "
         "The new armor is a separate original fan-inspired study, not the old app robot or an official character asset.")
    page("01 / Open the right file","Menu roadmap, not a Blender UI screenshot",
         roadmap(),
         "The .blend preserves the organized collections and native authoring setup. GLB is the portable interchange copy. "
         "In Blender: File > Import > glTF 2.0, choose Claire.glb. Import Optimus-inspired.glb without moving either origin.")
    entries = [
        ("Forehead",(0,153),"right",180,COLORS[0]),
        ("Skull / temples",(7,150),"right",305,COLORS[1]),
        ("Eye surrounds",(-3,147.5),"left",390,COLORS[2]),
        ("Nose / bridge",(0,144.5),"right",460,COLORS[3]),
        ("Cheeks",(4.4,143),"right",610,COLORS[4]),
        ("Lips / opening",(-1,140.2),"left",570,COLORS[5]),
        ("Chin / jaw",(-1.5,137),"left",725,COLORS[6]),
        ("Neck",(0,132),"left",880,COLORS[7]),
    ]
    page("02 / What Claire's surface contains","Eight distinct guide colors; one continuous animated skin",
         annotated(image("claire-regions"),entries,"CLAIRE / SURFACE LANDMARKS",True),
         "These are approximate coordinate-based teaching regions, not separate muscles, calibrated anatomy or individual bones. "
         "Lips, lids, cheeks and jaw all belong to Claire_Skin_PCA140. The eye globes and hair are separate static meshes.")
    pixel = records["robot-front"]["calloutPixels"]
    part_entries = [
        ("HELMET / forehead",pixel["helmet"],"right",170,COLORS[0]),
        ("EARS / temples",pixel["ears"],"right",330,COLORS[1]),
        ("OPTIC / eyes",pixel["optics"],"right",490,COLORS[2]),
        ("FACE / bridge",[500,550-((146.1-147.52305)*.01-.005)*1100/.53],
         "right",650,COLORS[3]),
        ("VENT / cheeks",pixel["vents"],"left",490,COLORS[4]),
        ("MASK / lip cover",pixel["faceplate"],"left",650,COLORS[5]),
        ("JAW / chin",pixel["jaw"],"left",790,COLORS[6]),
        ("NECK / collar",pixel["neck"],"left",920,COLORS[7]),
    ]
    page("03 / Where the robot parts go","Match the colored labels to the Claire region map",
         annotated(image("robot-front"),part_entries,"ROBOT / ARMOR PLACEMENT"),
         "Helmet wraps the forehead/skull; ear hubs sit outside the temples; cyan optics sit ahead of the eye line. "
         "The silver mask covers the lips rather than becoming soft lips. The lower guard belongs to the separate mechanical Jaw bone.")
    page("04 / Align eyes, not the outer silhouette","Both images retain the same orthographic camera, scale and origin",
         alignment(image("claire-front"),image("robot-front")),
         "Blender units are meters: one source centimeter becomes 0.01 m. +X is the character's left (viewer right), +Z up, front is -Y. "
         "Origin is the source eye-height midplane at Z=0, not the nose tip. GLB uses standard Y-up; Blender imports that conversion.")
    page("05 / Build the helmet around the skull","Front silhouette and back volume are different jobs",
         pair(image("robot-front"),image("robot-back"),("FRONT / CREST + ANTENNAE","BACK / WRAPPED CROWN")),
         "Edit HELMET_01_WrappedCrown for cranial volume, HELMET_02_Forehead for the front panels, and HELMET_04_Antenna.L/R "
         "for the tall side silhouette. Keep separate armor pieces; this study is not a sealed printable/manufacturing shell.")
    page("06 / Read the depth from the side","The mask is in front of Claire, not painted onto the skin",
         pair(image("claire-profile"),image("robot-profile"),("CLAIRE / ACTUAL PROFILE","ROBOT / PROFILE AND CLEARANCE")),
         "Keep bridge/faceplate forward of the nose; do not shrinkwrap a rigid faceplate tightly to moving lips. "
         "Ears and antennae sit laterally, not on the eyelids. Check front and side views after every large silhouette edit.")
    page("07 / Optics, brows and cheek hardware","Select by exact object prefix in the Outliner",
         pair(image("robot-face-detail"),image("robot-three-quarter"),("DETAIL / EYE-MASK ASSEMBLY","DEPTH / EAR AND CHEEK LAYERS")),
         "OPTIC_02_CyanLens is the visible light; OPTIC_01_DarkSocket is its recess. BROW_01_HeavyRidge.L/R has its own rigid bone. "
         "FACE_02_CheekPillar and VENT_01..04 sit on the cheek zone. Optics are fixed to Head; gaze is not implemented in this asset.")
    page("08 / A faceplate is not a human mouth","Closed at frame 1; manual inspection pose at frame 25",
         pair(image("robot-front"),image("robot-jaw-open"),("REST / FRAME 1","JAW INSPECTION / FRAME 25")),
         "FACE_04_UpperMask stays with Head. JAW_01_LowerFaceplate and JAW_02_SideRail.L/R follow Jaw. "
         "The two-second action is a manual clearance demonstration, not generated speech, an Optimus voice or a lip-sync test.")
    page("09 / Assemble the layers","Exploded translations explain ordering, not a mechanical specification",
         pair(image("robot-three-quarter"),image("robot-exploded"),("ASSEMBLED / SHARED ORIGIN","EXPLODED / PARTS PULLED APART")),
         "Work rear-to-front: crown and temples, ear hubs, brow/socket/lenses, cheek pillars and bridge, upper mask, lower jaw, neck ribs. "
         "The exploded render offsets groups only for illustration; the saved .blend and GLBs stay assembled.")
    page("10 / Keep Claire as the motion reference","The skin and modal keys are real; cosmetics are static",
         pair(image("claire-wire"),image("claire-three-quarter"),("15,375 CONTROL VERTICES","ORIGINAL WAVES + STATIC EYES")),
         "Claire contains 30,746 skin triangles and 140 PCA shape keys, plus Basis. PCA_000..139 are numeric learned modes, not named visemes "
         "or emotions. All default to zero. This export does not include ONNX inference, recordings, teeth/tongue rig or shader-identical makeup.")
    page("11 / Customize the armor, preserve the driver","Use a new Save As copy before changing the design",
         editing_board(image("robot-three-quarter"),image("claire-wire")),
         "Toggle collection 01 for Claire and 02 for armor; 03 is a false-color guide. Select an armor object, Tab to Edit Mode, then move/extrude/bevel. "
         "For manual posing select RIG_Head_Jaw_Brows, Pose Mode, choose Jaw. Keep all 140 modal values at zero for neutral fitting.")
    page("12 / Check the rig before export","Hard armor should move rigidly, not bend like skin",
         pair(image("robot-jaw-open"),image("robot-face-detail"),("MOVE JAW / HOLD HELMET","BROW.L + BROW.R / INDEPENDENT")),
         "The four bones are Head, Jaw, Brow.L and Brow.R. Each armor object's rigidBone property and vertex group identify its owner. "
         "Do not apply/delete the armature modifier or join every part blindly. In Blender the imported rig can also create a non-asset Icosphere bone widget.")
    page("13 / Re-export without losing the handoff","Author in .blend; interchange through GLB; integration is a later task",
         pair(image("robot-three-quarter"),image("claire-front"),("SELECT ARMOR + ITS RIG","PRESERVE THE CLAIRE REFERENCE")),
         "File > Export > glTF 2.0; choose GLB, selected objects, skinning, morph targets as needed and animation when desired. "
         "Reimport into an empty file to check scale, materials and movement. A GLB edit does NOT automatically replace Verona's renderer or preserve native vertex IDs.")
    page("14 / Your starting point, not an accepted final likeness","Actual assets and renders; no official artwork, logo or downloaded character mesh",
         pair(image("robot-front"),image("robot-profile"),("REFINE PROPORTIONS FIRST","CHECK DEPTH BEFORE DETAIL")),
         "The owner rejected the earlier app robot. This new Blender study offers a different editable starting point, not claimed approval. "
         "See ASSET-RIGHTS.md for NVIDIA-derived Claire terms; character references/trademarks remain with their owners. No upload or app integration was performed.")

    pdf = fitz.open()
    toc = []
    for i,p in enumerate(pages):
        pg = pdf.new_page(width=842,height=595)
        pg.draw_rect(pg.rect,color=None,fill=(.96,.97,.98))
        pg.insert_text((32,36),p["title"],fontsize=23,fontname="hebo",color=(.06,.12,.19))
        pg.insert_text((32,57),p["subtitle"],fontsize=10,color=(.25,.33,.41))
        pg.insert_image(fitz.Rect(32,75,810,512),filename=str(guide/p["image"]))
        result = pg.insert_textbox(fitz.Rect(32,523,810,567),p["caption"],
                                   fontsize=10.2,lineheight=1.2,fontname="helv",color=(.08,.14,.21))
        if result < 0:
            raise ValueError(f"Guide caption overflow at page{i+1}")
        pg.insert_text((32,583),f"VERONA / BLENDER WORKSHOP / LOCAL AUTHORING KIT                                      {i+1:02d} / {len(pages):02d}",
                       fontsize=8,color=(.25,.33,.41))
        toc.append([1,p["title"],i+1])
    pdf.set_toc(toc)
    target=guide/"Claire-to-Optimus-Visual-Guide.pdf"
    pdf.save(target,garbage=4,deflate=True)
    pdf.close()
    with fitz.open(target) as check:
        if len(check)!=len(pages) or len(check.get_toc())!=len(pages):
            raise ValueError("Guide page/navigation count changed.")
        for p,expected in zip(check,pages):
            if expected["title"] not in p.get_text() or not p.get_images():
                raise ValueError("Guide lost searchable headings or its actual image plate.")
            if any(not p.rect.contains(fitz.Rect(w[:4])) for w in p.get_text("words")):
                raise ValueError("Guide text escaped a page.")
    articles=[]
    for i,p in enumerate(pages):
        articles.append(f'<article id="step-{i}"><h2>{html.escape(p["title"])}</h2><p>{html.escape(p["subtitle"])}</p>'
                        f'<a href="{p["image"]}"><img src="{p["image"]}" alt="{html.escape(p["subtitle"])}"></a>'
                        f'<p>{html.escape(p["caption"])}</p></article>')
    (guide/"index.html").write_text(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
        '<title>Claire to Optimus-inspired / visual Blender workshop</title><style>'
        'body{margin:0;background:#101b28;color:#eef3f8;font:18px/1.6 Arial,sans-serif}'
        'main{max-width:1250px;margin:auto;padding:28px}article{margin:30px 0 70px}h1,h2{line-height:1.2}'
        'img{width:100%;height:auto;border-radius:12px}a{color:#56d4ff}nav{display:flex;gap:24px;flex-wrap:wrap}'
        '</style><main><h1>Claire to an Optimus-inspired head</h1><p>Actual models, annotated placement maps and an editable workshop. Click any plate for full resolution.</p>'
        '<nav><a href="Claire-to-Optimus-Visual-Guide.pdf">PDF guide</a><a href="../Claire.glb">Claire GLB</a>'
        '<a href="../Optimus-inspired.glb">Robot GLB</a><a href="../Claire-Optimus-Workshop.blend">Blender source</a></nav>'
        +''.join(articles)+'</main></html>',encoding="utf-8")
    receipt={"pages":len(pages),"actualRenderInputs":len(records),"annotatedPlates":len(pages),
             "pdfSha256":hashlib.sha256(target.read_bytes()).hexdigest(),
             "imageHeavy":True,"visualReview":"Pending actual agent review, not inferred from rendering.",
             "inputs":{p["file"]:hashlib.sha256((root/p["file"]).read_bytes()).hexdigest()
                       for p in records.values()},"contents":pages}
    (guide/"guide.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:receipt[k] for k in ("pages","actualRenderInputs","annotatedPlates","pdfSha256")}))


if __name__ == "__main__":
    main()
