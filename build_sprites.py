"""Procedurally paints original high-resolution 2.5D unit artwork for the game.
Seven chassis x three faction palettes. Public original work, no copied game assets.
"""
from PIL import Image, ImageDraw, ImageFilter
from random import Random
from pathlib import Path
from math import sin,cos,pi
N=176
S=2
TYPES=['infantry','rocket','scout','tank','artillery','special','gunship']
FACTIONS=[('alliance',(76,166,185),(26,67,73),(155,226,223)),('legion',(182,149,78),(84,80,58),(235,207,134)),('rebels',(150,119,166),(76,62,91),(211,178,206))]
root=Path(__file__).resolve().parent

def composite_cell(kind,base,dark,light,row):
 rnd=Random(600+row*11+TYPES.index(kind))
 img=Image.new('RGBA',(N,N))
 # Smooth ground-contact cast shadow, separate from body.
 shade=Image.new('RGBA',(N,N));sd=ImageDraw.Draw(shade)
 def sxy(x,y):return (int(x+N/2),int(y+N/2))
 shadow=(5,14,13,0)
 sd.ellipse((*sxy(-49,-32),*sxy(53,43)),fill=(5,15,14,104))
 shade=shade.filter(ImageFilter.GaussianBlur(9))
 img.alpha_composite(shade)
 d=ImageDraw.Draw(img,'RGBA')
 def ellipse(box,fill,outline=None,width=1):d.ellipse((*sxy(box[0],box[1]),*sxy(box[2],box[3])),fill=fill,outline=outline,width=width)
 def rect(box,fill,outline=None,width=1):d.rounded_rectangle((*sxy(box[0],box[1]),*sxy(box[2],box[3])),radius=5,fill=fill,outline=outline,width=width)
 def poly(points,fill,outline=None,width=1):d.polygon([sxy(*p) for p in points],fill=fill);d.line([sxy(*p) for p in points+[points[0]]],fill=outline,width=width) if outline else None
 def line(points,fill,width=2):d.line([sxy(*p) for p in points],fill=fill,width=width,joint='curve')
 def dot(x,y,r,color):ellipse((x-r,y-r,x+r,y+r),color)
 def lower(col,f=.7):return tuple(int(v*f) for v in col)+(255,)
 def upper(col,f=1.2):return tuple(min(255,int(v*f)) for v in col)+(255,)
 # Treads, wheel assemblies, and richly segmented mechanical casings.
 if kind in ['tank','artillery','special']:
  heavy=(kind=='special' and row==1)
  ww=58 if heavy else 51
  rect((-ww,-33,ww, -23),(18,30,31),outline=(151,158,134))
  rect((-ww,23,ww,33),(18,30,31),outline=(151,158,134))
  for x in range(-ww+10,ww-2,13):
   line([(x,-32),(x+4,-24)],(98,115,104),2);line([(x,24),(x+4,32)],(98,115,104),2)
  poly([(-48,-21),(35,-24),(52,-11),(54,12),(36,25),(-48,21)],lower(dark,.85),outline=(24,39,40),width=3)
  poly([(-45,-22),(34,-25),(45,-13),(45,12),(32,22),(-45,20)],base,outline=light,width=2)
  poly([(-41,-17),(28,-17),(37,-6),(-37,-6)],upper(base,1.23))
  line([(-35,17),(37,15)],lower(base,.7),3)
  for x in (-33,-18,-3,12):
   rect((x,-20,x+8,-13),lower(dark,.65),outline=(200,211,187))
  if kind=='special' and row==2:
   for y in (-16,0,16):
    rect((-32,y-7,20,y+7),lower(dark,.75),outline=light)
    for x in (-15,1,17):dot(x,y,3,(228,175,90))
   rect((25,-13,50,13),lower(base,.7),outline=(35,55,54),width=2)
  else:
   ellipse((-19,-19,22,20),lower(dark,.76),outline=(184,192,171),width=2)
   ellipse((-12,-14,14,14),upper(base,1.05),outline=(38,58,53),width=3)
   if kind=='artillery':
    rect((11,-9,82,9),lower(base,.70),outline=(199,207,183),width=2)
    rect((55,-13,77,13),lower(dark,.74),outline=light)
    line([(19,-3),(79,-3)],(234,235,206),3)
    rect((-30,16,-13,31),lower(base,.82),outline=light)
   else:
    rect((7,-8,61 if kind=='special' else 51,9),lower(dark,.76),outline=(218,219,183),width=2)
    rect((49 if kind!='special' else 58,-10,64 if kind!='special' else 71,11),(50,62,61),outline=light)
    line([(14,-5),(50,-5)],(206,214,189),3)
    for x in (-13,1):
     dot(x,-15,4,(208,210,176))
  for x,y in [(-43,-15),(-43,15),(38,-14),(38,14)]:dot(x,y,2.5,light)
  for x,y in [(-17,21),(20,-22)]:rect((x-7,y-3,x+7,y+3),(22,36,37))
  rect((-45,-24,-33,-18),light)
 elif kind=='scout':
  # Independent wheel + suspension details visible downscaled.
  for x in (-33,23):
   for y in (-24,24):
    ellipse((x-12,y-11,x+13,y+11),(20,30,31),outline=(118,128,117),width=3)
    ellipse((x-7,y-6,x+8,y+6),(68,76,71))
  poly([(-41,-20),(23,-25),(49,-11),(49,14),(18,24),(-42,20)],lower(dark,.82),outline=(28,42,41),width=3)
  poly([(-36,-18),(19,-20),(42,-9),(42,9),(20,19),(-36,17)],base,outline=light,width=3)
  poly([(-23,-17),(12,-16),(21,-6),(21,10),(-23,13)],lower(base,.7),outline=(35,58,58),width=2)
  rect((-18,-12,9,7),(30,64,73),outline=(165,204,196),width=2)
  poly([(-13,-12),(4,-12),(-2,-4),(-14,-4)],(96,147,152,255))
  rect((25,-11,48,11),lower(dark,.8),outline=(224,221,179),width=2)
  for y in (-13,13):rect((39,y-5,51,y+5),(241,223,163))
  rect((-30,-19,-4,-16),light)
 elif kind=='gunship':
  # Painted body and twin engines with no static rotor (rotor animates in runtime).
  poly([(-60,-4),(-22,-9),(-10,-34),(20,-27),(42,-10),(61,0),(42,13),(21,27),(-10,34),(-22,9),(-60,4)],lower(dark,.7),outline=(21,39,44),width=3)
  poly([(-55,-5),(-12,-15),(16,-18),(51,-3),(51,6),(16,17),(-12,16),(-55,4)],base,outline=light,width=2)
  for y in (-24,24):
   rect((-24,y-9,9,y+9),lower(dark,.72),outline=(174,187,173),width=2)
   rect((-20,y-7,-2,y+7),upper(base,1.05))
   for x in (-10,1):dot(x,y,2.4,(216,179,97))
  ellipse((-13,-18,30,18),upper(dark,1.0),outline=(210,216,197),width=3)
  ellipse((6,-11,32,11),(29,73,83),outline=(170,212,204),width=2)
  poly([(11,-8),(27,-6),(26,-2),(11,-1)],(132,187,190))
  rect((-62,-11,-52,12),lower(base,.7),outline=light)
  line([(-48,-17),(-48,17)],light,4)
  rect((-21,-4,17,4),lower(dark,.7),outline=(213,214,182),width=2)
  dot(1,0,6,(205,203,166));dot(1,0,3,(53,64,58))
  rect((38,-9,58,11),lower(dark,.70),outline=(221,212,172),width=2)
 else:
  # Tiny soldier body, tactical helmet, boots, rifle/missile tube.
  for y in (-13,13):
   ellipse((-20,y-7,2,y+8),(25,34,33),outline=(108,118,105),width=2)
  ellipse((-25,-13,22,13),lower(dark,.8),outline=(18,35,35),width=3)
  rect((-17,-12,13,13),base,outline=light,width=2)
  for x in (-13,3):rect((x,-9,x+7,8),lower(base,.78),outline=(212,209,166))
  ellipse((-17,-19,11,17),(30,46,42),outline=(16,28,31),width=2)
  ellipse((-15,-17,8,10),upper(base,1.09),outline=(204,208,173),width=2)
  poly([(-9,-14),(2,-13),(5,-4),(-12,-5)],upper(base,1.22))
  for y in (-21,14):
   ellipse((-21,y,-8,y+9),lower(base,.78),outline=(21,38,37),width=2)
  if kind=='rocket':
   rect((6,-9,70,10),(46,58,51),outline=(187,200,182),width=3)
   rect((47,-12,71,12),(66,72,60),outline=(213,213,186),width=2)
   rect((68,-7,79,7),(25,43,44),outline=(228,211,151),width=2)
   line([(10,-6),(60,-6)],(160,164,145),3)
   rect((10,-16,27,-8),(105,111,91))
  else:
   rect((8,-7,60,6),(34,49,45),outline=(169,183,166),width=2)
   rect((40,-9,65,8),(24,40,43),outline=(135,156,140),width=2)
   line([(21,-5),(62,-5)],(188,203,191),2)
  dot(-21,-6,4,light)
 # Faction roundel; always recognisable even when small.
 for xx,yy in [(-17,-20)]:
  ellipse((xx-6,yy-6,xx+6,yy+6),lower(dark,.5),outline=(255,234,188),width=1)
  dot(xx,yy,3,light)
 # subtle noise material, clipped via alpha mask.
 texture=Image.new('RGBA',(N,N)); td=ImageDraw.Draw(texture,'RGBA')
 for i in range(110):
  x=rnd.randrange(17,N-17);y=rnd.randrange(18,N-18)
  td.point((x,y),fill=(249,252,235,rnd.randrange(4,25)))
 img=Image.alpha_composite(img,Image.composite(texture,Image.new('RGBA',(N,N)),img.getchannel('A')))
 return img

atlas=Image.new('RGBA',(N*len(TYPES),N*len(FACTIONS)))
for row,(name,base,dark,light) in enumerate(FACTIONS):
 for col,kind in enumerate(TYPES):
  a=composite_cell(kind,base,dark,light,row)
  atlas.alpha_composite(a,(col*N,row*N))
path=root/'sprite_atlas.png'
atlas.save(path,optimize=True)
print(path,atlas.size,path.stat().st_size)
