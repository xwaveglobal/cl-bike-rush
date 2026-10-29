from PIL import Image, ImageDraw, ImageFont
S='/tmp/claude-0/-home-claude/508aa4a3-f434-5478-82f1-376ca4166a3b/scratchpad'
ref=Image.open('/mnt/user-data/attachments/508aa4a3-f434-5478-82f1-376ca4166a3b/bbc2e0f8-image.jpg').convert('RGB')
AL={v:Image.open(f'{S}/audit/al_{v}.png').convert('RGB') for v in ['left','right','front','rear','bikeside']}
try:
    F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
    f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except Exception:
    F=f=ImageFont.load_default()
ITEMS=[
 ('01','Tỉ lệ tổng thể (nhìn ngang, không người lái)','bikeside',(0,600,590,950)),
 ('02','Đầu xe, kính chắn gió, đèn pha (ngang)','bikeside',(40,600,230,770)),
 ('03','Ốp sườn, vạch xanh, khe gió','bikeside',(95,690,280,905)),
 ('04','Bình xăng, yên, khung','bikeside',(180,640,370,780)),
 ('05','Đuôi xe, yên sau, đèn hậu (ngang)','bikeside',(330,630,565,760)),
 ('06','Động cơ, két nước, gầm','bikeside',(225,750,420,905)),
 ('07','Ống xả (dưới gầm, bên trái)','bikeside',(260,845,420,915)),
 ('08','Bánh trước, đĩa phanh, heo dầu, phuộc','bikeside',(5,755,185,930)),
 ('09','Bánh sau, gắp, xích, nhông','bikeside',(330,740,590,935)),
 ('10','Đầu xe chính diện, đèn pha, gương','front',(10,130,300,330)),
 ('11','Mũ bảo hiểm + vai (chính diện)','front',(70,0,250,150)),
 ('12','Đuôi xe + đèn hậu (phía sau)','rear',(860,150,1030,270)),
 ('13','Lưng, gù, mũ (phía sau)','rear',(840,0,1050,200)),
 ('14','Chân, giày, bánh sau (phía sau)','rear',(830,240,1060,462)),
 ('15','Dáng ngồi người lái (ngang)','left',(420,0,760,260)),
 ('16','Ống xả + gắp bên phải','right',(1075,235,1300,430)),
]
def pair(no,title,view,box,target_h=360):
    a=ref.crop(box); b=AL[view].crop(box)
    k=target_h/a.height; a=a.resize((round(a.width*k),target_h),Image.LANCZOS); b=b.resize(a.size,Image.LANCZOS)
    pad=14; head=44
    W=a.width*2+pad*3; H=target_h+head+pad+26
    im=Image.new('RGB',(W,H),(247,248,250)); d=ImageDraw.Draw(im)
    d.text((pad,12),f'{no}. {title}',fill=(20,24,32),font=F)
    im.paste(a,(pad,head)); im.paste(b,(pad*2+a.width,head))
    d.text((pad,head+target_h+4),'Ảnh mẫu',fill=(90,96,110),font=f)
    d.text((pad*2+a.width,head+target_h+4),'Bản 3D hiện tại',fill=(90,96,110),font=f)
    im.save(f'{S}/audit/{no}.jpg',quality=88)
    return im.size
if __name__=='__main__':
    for it in ITEMS: print(it[0], pair(*it))
