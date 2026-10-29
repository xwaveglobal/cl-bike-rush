from PIL import Image, ImageFilter
import sys
S='/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad'
ref=Image.open('/mnt/user-data/attachments/508aa4a3-f434-5478-82f1-376ca4166a3b/bbc2e0f8-image.jpg').convert('RGB')
tag=sys.argv[1] if len(sys.argv)>1 else 'x'
def edges(im): return im.convert('L').filter(ImageFilter.FIND_EDGES).point(lambda v:255 if v>40 else 0)
outs=[]
for v,box in [('left',(280,0,860,470)),('bikeside',(0,590,590,960))]:
    al=Image.open(f'{S}/audit/al_{v}.png').convert('RGB'); r=ref.crop(box); a=al.crop(box)
    blend=Image.blend(r,a,0.5); er,ea=edges(r),edges(a)
    base=Image.new('RGB',r.size,(245,245,245)); base.paste(Image.new('RGB',r.size,(230,40,40)),(0,0),er); base.paste(Image.new('RGB',r.size,(20,150,230)),(0,0),ea)
    w,h=r.size; o=Image.new('RGB',(w*2,h)); o.paste(blend,(0,0)); o.paste(base,(w,0)); o.save(f'{S}/audit/ov_{v}_{tag}.jpg',quality=88)
