# Align studio renders to the reference sheet, then cut matching detail pairs.
import json, math
from PIL import Image, ImageDraw, ImageFont
S='/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad'
REF='/mnt/user-data/attachments/508aa4a3-f434-5478-82f1-376ca4166a3b/bbc2e0f8-image.jpg'
ref=Image.open(REF).convert('RGB')
PX=1000/(2*14*math.tan(math.radians(4.5)))  # render px per metre at the origin plane
CX,CY=692,500

def ours_side(view, z, y):
    # left / bikeside: +Z to the right; right: +Z to the left; look target y=0.62
    sx = 1 if view in ('left','bikeside') else -1
    return (CX + sx*z*PX, CY - (y-0.62)*PX)

def bbox(img, bg, thr=28, box=None):
    w,h=img.size; px=img.load()
    x0,y0,x1,y1=(0,0,w,h) if box is None else box
    minx,miny,maxx,maxy=w,h,0,0
    for y in range(y0,y1,2):
        for x in range(x0,x1,2):
            r,g,b=px[x,y]
            if abs(r-bg[0])+abs(g-bg[1])+abs(b-bg[2])>thr:
                minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y)
    return minx,miny,maxx,maxy

def aligned(view):
    im=Image.open(f'{S}/test/st_{view}.png').convert('RGB')
    bg=im.getpixel((5,5))
    canvas=Image.new('RGB',ref.size,bg)
    if view in ('left','right','bikeside'):
        anchors={'left':((370,365),(750,364)),'bikeside':((91,843),(491,840)),'right':((1475,364),(1140,364))}[view]
        Fr,Rr=anchors
        Fo=ours_side(view,-0.71,0.31); Ro=ours_side(view,0.71,0.33)
        k=math.dist(Fr,Rr)/math.dist(Fo,Ro)
        off=(Fr[0]-k*Fo[0], Fr[1]-k*Fo[1])
    else:
        # front / rear: the reference uses a closer camera, so scale on the bike itself
        # (ground -> headlight in front, ground -> tail lights at the rear) and align tyre centre + ground
        ground,feat_y,feat_m,cx={'front':(456,232,0.735,160),'rear':(456,215,0.928,942)}[view]
        k=(ground-feat_y)/(feat_m*PX)
        g_ours=CY+0.75*PX
        off=(cx-k*CX, ground-k*g_ours)
    sm=im.resize((round(im.width*k),round(im.height*k)),Image.LANCZOS)
    canvas.paste(sm,(round(off[0]),round(off[1])))
    return canvas

if __name__=='__main__':
    for v in ['left','right','front','rear','bikeside']:
        aligned(v).save(f'{S}/audit/al_{v}.png')
    # overall overlays to check alignment
    a=Image.blend(ref, Image.open(f'{S}/audit/al_bikeside.png'), 0.5).crop((0,590,590,960)); a.save(f'{S}/audit/chk_bikeside.jpg')
    b=Image.blend(ref, Image.open(f'{S}/audit/al_left.png'), 0.5).crop((280,0,860,470)); b.save(f'{S}/audit/chk_left.jpg')
