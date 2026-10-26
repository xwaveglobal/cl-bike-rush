import sys, math
from PIL import Image, ImageDraw, ImageFont
S='/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad/turn/'
def font(n):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        try: return ImageFont.truetype(f,n)
        except: pass
    return ImageFont.load_default()
F,FS=font(30),font(18)
def grid(name, ppm, step, bold, cy_world, label, ground=True, top=False):
    im=Image.open(S+name+'.png').convert('RGB'); W,H=im.size; cx,cy=W/2,H/2
    ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
    n=int(max(W,H)/(ppm*step))+2
    for k in range(-n,n+1):
        w=k*step; strong=abs(round(w/bold)-w/bold)<1e-6
        col=(255,60,60,120) if strong else (40,90,200,50)
        x=cx+w*ppm; d.line([(x,0),(x,H)],fill=col,width=2 if strong else 1)
        y=cy-w*ppm; d.line([(0,y),(W,y)],fill=col,width=2 if strong else 1)
    if ground and not top:
        gy=cy+cy_world*ppm; d.line([(0,gy),(W,gy)],fill=(0,0,0,200),width=3)
    im=Image.alpha_composite(im.convert('RGBA'),ov).convert('RGB')
    dd=ImageDraw.Draw(im); dd.rectangle([0,0,W,48],fill=(20,24,32)); dd.text((14,8),label,font=F,fill=(255,255,255))
    unit = f'lưới mảnh {int(step*100)} cm · lưới đỏ {int(bold*100)} cm' 
    dd.text((14,H-30),unit,font=FS,fill=(30,30,30))
    return im
full=[('full_left','1 · NGANG TRÁI (side)'),('full_right','2 · NGANG PHẢI'),('full_front','3 · TRƯỚC (front)'),('full_rear','4 · SAU (rear)'),('full_top','5 · TRÊN XUỐNG (top)'),('full_34','6 · 3/4 trước-trái')]
ims=[grid(n,453.8,0.1,0.5,0.75,l,top=(n=='full_top'), ground=(n!='full_34')) for n,l in full]
for (n,_),im in zip(full,ims): im.save(S+'out/'+n+'_grid.jpg',quality=90)
w,h=ims[0].size; sheet=Image.new('RGB',(w*2,h*3+90),(236,238,242))
ImageDraw.Draw(sheet).text((24,24),'BIKE RUSH — TURNAROUND NGƯỜI LÁI + XE (tư thế StraightRide, gần trực giao, cùng tỉ lệ 1 m = 454 px)',font=F,fill=(15,18,25))
for i,im in enumerate(ims): sheet.paste(im,((i%2)*w,90+(i//2)*h))
sheet.resize((w,int((h*3+90)/2))).save(S+'out/TURNAROUND_full.jpg',quality=90)
hel=[('helmet_front','H1 · MŨ TRƯỚC'),('helmet_left','H2 · MŨ NGANG TRÁI'),('helmet_rear','H3 · MŨ SAU'),('helmet_top','H4 · MŨ TRÊN XUỐNG')]
ims=[grid(n,3180,0.01,0.05,0,l,ground=False) for n,l in hel]
for (n,_),im in zip(hel,ims): im.save(S+'out/'+n+'_grid.jpg',quality=90)
sheet=Image.new('RGB',(w*2,h*2+90),(236,238,242))
ImageDraw.Draw(sheet).text((24,24),'BIKE RUSH — TURNAROUND MŨ BẢO HIỂM (1 cm = 32 px, tâm = đầu người lái)',font=F,fill=(15,18,25))
for i,im in enumerate(ims): sheet.paste(im,((i%2)*w,90+(i//2)*h))
sheet.resize((w,int((h*2+90)/2))).save(S+'out/TURNAROUND_helmet.jpg',quality=90)
