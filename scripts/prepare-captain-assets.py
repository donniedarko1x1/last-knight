"""Deterministic ZIP -> half-size RGBA game textures; Pillow/scipy are build-only.

Usage: python3 scripts/prepare-captain-assets.py /absolute/path/captain.zip
Never overwrites uploaded originals. Metadata anchors follow the body, not the sword.
"""
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/enemies/skeleton_captain'
OUT.mkdir(parents=True,exist_ok=True)
# (torso x, head y, ground y) in source-normalized coordinates.
# Crouching body height is intentionally lower than standing: impact should bend.
ANCHORS={
 'attack_east_01':(.46,.365,.956), 'attack_east_ground':(.49,.345,.900),
 'attack_west_01':(.47,.378,.958), 'attack_west_ground':(.48,.394,.957),
 'attack_north_01':(.50,.385,.952), 'attack_north_ground':(.50,.420,.952),
 'attack_south_01':(.50,.390,.952), 'attack_south_ground':(.50,.403,.934),
 'skill_back':(.50,.390,.952), 'skill_front':(.50,.385,.952),
 'walk_east_01':(.49,.067,.945), 'walk_east_02':(.48,.059,.945),
 'walk_west_01':(.51,.067,.945), 'walk_west_02':(.52,.059,.945),
 'walk_north_01':(.52,.055,.964), 'walk_north_02':(.52,.055,.964),
 'walk_northeast_01':(.49,.034,.970), 'walk_northeast_02':(.49,.024,.970),
 'walk_northwest_01':(.57,.022,.970), 'walk_northwest_02':(.53,.022,.970),
 'walk_south_01':(.46,.015,.955), 'walk_south_02':(.46,.020,.955),
 'walk_southeast_01':(.48,.024,.970), 'walk_southeast_02':(.48,.024,.970),
 'walk_southwest_01':(.52,.024,.970), 'walk_southwest_02':(.52,.024,.970),
}

def remove_checker(im):
    rgb=np.asarray(im.convert('RGB')).astype(np.float32)
    lo=rgb.min(2); hi=rgb.max(2)
    # Bright near-neutral pixels are checker candidates, not crimson cloth/bone.
    candidate=(lo>174)&((hi-lo)<22)
    labels,n=ndimage.label(candidate)
    counts=np.bincount(labels.ravel())
    border=np.unique(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]))
    background=np.isin(labels,border[border>0])
    # Also remove enclosed background between limbs/sword; retain tiny highlights.
    big=np.flatnonzero(counts>max(110,im.width*im.height*.00008))
    background |= np.isin(labels,big[big>0])
    foreground=~background
    fg_labels,_=ndimage.label(foreground)
    fg_counts=np.bincount(fg_labels.ravel());fg_counts[0]=0
    foreground &= np.isin(fg_labels,np.flatnonzero(fg_counts>=16))
    # One-pixel soft edge, decontaminated against the light checker matte.
    edge=foreground & ~ndimage.binary_erosion(foreground)
    alpha=foreground.astype(np.float32)
    alpha[edge]=np.clip((245-lo[edge])/115,.45,1)
    decont=(rgb-240*(1-alpha[:,:,None]))/np.maximum(alpha[:,:,None],.001)
    out=np.dstack([np.clip(decont,0,255),alpha*255]).astype(np.uint8)
    out[~foreground]=0
    return Image.fromarray(out,'RGBA')

def main():
    metadata={}; tiles=[]; total_in=0; total_out=0
    with ZipFile(sys.argv[1]) as z:
        for name in sorted(z.namelist()):
            if not name.endswith('.png'):continue
            raw=z.read(name);total_in+=len(raw)
            im=Image.open(BytesIO(raw))
            stem=Path(name).stem; short=stem.replace('skeleton_captain_','')
            out=im.convert('RGBA') if im.mode=='RGBA' else remove_checker(im)
            out=out.resize((im.width//2,im.height//2),Image.Resampling.LANCZOS)
            out.save(OUT/f'{stem}.png',optimize=True,compress_level=9)
            total_out+=(OUT/f'{stem}.png').stat().st_size
            if short in ANCHORS:
                x,head,ground=ANCHORS[short]
                # Impact pose uses the paired standing scale with slight crouch.
                if short.endswith('_ground'):
                    _,h,g=ANCHORS[short.replace('_ground','_01')]
                    body=g-h
                else:body=ground-head
                metadata[stem]={'x':x,'ground':ground,'bodyHeight':round(body*out.height,3)}
            thumb=out.copy();thumb.thumbnail((170,170))
            tile=Image.new('RGB',(190,200),'#363d36');tile.paste(thumb,((190-thumb.width)//2,0),thumb)
            ImageDraw.Draw(tile).text((3,172),short,fill='white')
            tiles.append(tile)
            a=np.array(out.getchannel('A'))
            assert a.min()==0 and a.max()>0,stem
            assert not np.any(a[0]) and not np.any(a[-1]) and not np.any(a[:,0]) and not np.any(a[:,-1]),stem
    (OUT/'frames.json').write_text(json.dumps(metadata,indent=2)+'\n')
    sheet=Image.new('RGB',(950,((len(tiles)+4)//5)*200),'#363d36')
    for i,tile in enumerate(tiles):sheet.paste(tile,((i%5)*190,(i//5)*200))
    dest=ROOT.parent/'work/captain_v18';dest.mkdir(parents=True,exist_ok=True)
    sheet.save(dest/'prepared_contact.png')
    print(json.dumps({'sourceBytes':total_in,'pngBytes':total_out,'frames':len(tiles)}))

if __name__=='__main__':main()
