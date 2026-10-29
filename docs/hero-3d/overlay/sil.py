# silhouette IoU between the reference sheet and the aligned renders; writes XOR maps
import sys, numpy as np
from scipy.ndimage import binary_fill_holes
from PIL import Image, ImageFilter
S='/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad'
tag=sys.argv[1] if len(sys.argv)>1 else 'x'
ref=Image.open('/mnt/user-data/attachments/508aa4a3-f434-5478-82f1-376ca4166a3b/bbc2e0f8-image.jpg').convert('RGB')
boxes={'left':(285,5,855,455),'bikeside':(5,595,585,900),'front':(10,5,305,450),'rear':(805,5,1085,450),'right':(1045,5,1530,455)}
def mask(im, bgsample):
    a=np.asarray(im).astype(int); bg=np.median(bgsample.reshape(-1,3),axis=0)
    d=np.abs(a-bg).sum(-1); m=d>36
    img=Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(3))
    return binary_fill_holes(np.asarray(img)>127)
res={}
outs=[]
for v,box in boxes.items():
    r=ref.crop(box); o=Image.open(f'{S}/audit/al_{v}.png').convert('RGB').crop(box)
    ra=np.asarray(r); oa=np.asarray(o)
    mr=mask(r, ra[:12,:12]); mo=mask(o, oa[:12,:12])
    # ignore the cast shadow strip on the ground in the reference (bottom 4%)
    h=mr.shape[0]; cut=0.9 if v in ('left','right','bikeside') else 0.97; mr[int(h*cut):]=False; mo[int(h*cut):]=False
    inter=(mr&mo).sum(); uni=(mr|mo).sum(); iou=inter/uni
    res[v]=round(float(iou),3)
    vis=np.full(mr.shape+(3,),245,np.uint8); vis[mr&mo]=(170,175,185); vis[mr&~mo]=(225,50,45); vis[mo&~mr]=(30,110,230)
    outs.append(Image.fromarray(vis))
print(tag, res, 'mean', round(sum(res.values())/len(res),3))
W=sum(i.width for i in outs); H=max(i.height for i in outs); c=Image.new('RGB',(W,H),(255,255,255)); x=0
for i in outs: c.paste(i,(x,0)); x+=i.width
c.save(f'{S}/audit/sil_{tag}.png')
