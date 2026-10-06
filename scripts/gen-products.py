"""Generate src/api/mock/products.json: per-product details for the 32 items in outfits.json.

products.json is the MASTER product table (list fields + details); outfits.json only references productId + colourway.
Hand-written per product: list fields, description, material text, colourways, model-fit note, tags.
Derived by rule: measurement tables (per kind + size), stock per colour x size (seeded, with chosen zeros).
Usage: python scripts/gen-products.py (any cwd). Output is UTF-8 without BOM, LF.
"""
import json, random
from datetime import date, timedelta
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
# 列表欄位（名稱、品牌、類別、價格、尺寸、預設布色）。商品是主表；穿搭（outfits.json）只用 productId 引用。
items = {
 101: dict(name="落肩混紡大衣", brand="霧岸", brandCode="wuan", category="outer", price=3280, sizes=["S", "M", "L"], colour="#d9d4ca", kind="coat"),
 102: dict(name="圓領細針織上衣", brand="半日", brandCode="banri", category="top", price=1180, sizes=["S", "M", "L", "XL"], colour="#f1ede6", kind="top"),
 103: dict(name="直筒西裝褲", brand="霧岸", brandCode="wuan", category="bottom", price=1680, sizes=["S", "M", "L"], colour="#2e2c29", kind="trousers"),
 104: dict(name="寬版棉質襯衫", brand="半日", brandCode="banri", category="top", price=1380, sizes=["M", "L", "XL"], colour="#f1ede6", kind="top"),
 105: dict(name="九分打褶褲", brand="半日", brandCode="banri", category="bottom", price=1580, sizes=["S", "M", "L"], colour="#2e2c29", kind="trousers"),
 201: dict(name="教練外套", brand="夜班車", brandCode="yebanche", category="outer", price=2480, sizes=["M", "L", "XL"], colour="#2f3a4a", kind="jacket"),
 202: dict(name="厚磅印花短袖", brand="夜班車", brandCode="yebanche", category="top", price=880, sizes=["S", "M", "L", "XL"], colour="#e9e4da", kind="top"),
 203: dict(name="寬管工作褲", brand="拾穗製衣", brandCode="shisui", category="bottom", price=1780, sizes=["M", "L"], colour="#4a5566", kind="trousers"),
 204: dict(name="毛帽", brand="夜班車", brandCode="yebanche", category="acc", price=480, sizes=["F"], colour=None, kind="beanie"),
 205: dict(name="短版飛行外套", brand="夜班車", brandCode="yebanche", category="outer", price=2880, sizes=["S", "M", "L"], colour="#2f3a4a", kind="jacket"),
 206: dict(name="百褶短裙", brand="拾穗製衣", brandCode="shisui", category="bottom", price=1280, sizes=["S", "M"], colour="#4a5566", kind="trousers"),
 301: dict(name="燈芯絨獵裝外套", brand="舊課本", brandCode="jiukeben", category="outer", price=3080, sizes=["S", "M", "L"], colour="#7a4a2a", kind="coat"),
 302: dict(name="古巴領短袖襯衫", brand="舊課本", brandCode="jiukeben", category="top", price=1280, sizes=["M", "L", "XL"], colour="#e8d7b0", kind="blouse"),
 303: dict(name="高腰直筒牛仔褲", brand="拾穗製衣", brandCode="shisui", category="bottom", price=1880, sizes=["S", "M", "L"], colour="#9a6a3c", kind="skirt"),
 401: dict(name="防潑水連帽外套", brand="野徑", brandCode="yejing", category="outer", price=3680, sizes=["S", "M", "L", "XL"], colour="#e8b53a", kind="vest"),
 402: dict(name="快乾長袖", brand="野徑", brandCode="yejing", category="top", price=980, sizes=["S", "M", "L", "XL"], colour="#3f5a46", kind="top"),
 403: dict(name="機能束口褲", brand="野徑", brandCode="yejing", category="bottom", price=1680, sizes=["M", "L", "XL"], colour="#5b5a4e", kind="trousers"),
 404: dict(name="健行襪", brand="野徑", brandCode="yejing", category="shoes", price=280, sizes=["F"], colour=None, kind="socks"),
 501: dict(name="單排扣西裝外套", brand="霧岸", brandCode="wuan", category="outer", price=3980, sizes=["S", "M", "L"], colour="#c6a06a", kind="coat"),
 502: dict(name="牛津襯衫", brand="舊課本", brandCode="jiukeben", category="top", price=1480, sizes=["S", "M", "L", "XL"], colour="#f3efe8", kind="blouse"),
 503: dict(name="錐形西裝褲", brand="霧岸", brandCode="wuan", category="bottom", price=1880, sizes=["S", "M", "L"], colour="#2b3550", kind="trousers"),
 504: dict(name="綁帶襯衫洋裝", brand="半日", brandCode="banri", category="top", price=2480, sizes=["S", "M", "L"], colour="#f3efe8", kind="blouse"),
 505: dict(name="細皮帶", brand="舊課本", brandCode="jiukeben", category="acc", price=680, sizes=["F"], colour=None, kind="belt"),
 506: dict(name="水洗皮夾克", brand="夜班車", brandCode="yebanche", category="outer", price=4280, sizes=["S", "M", "L"], colour="#2b272c", kind="jacket"),
 507: dict(name="破壞感短T", brand="夜班車", brandCode="yebanche", category="top", price=980, sizes=["S", "M", "L", "XL"], colour="#5a1f24", kind="top"),
 508: dict(name="黑色直筒褲", brand="霧岸", brandCode="wuan", category="bottom", price=1880, sizes=["S", "M", "L"], colour="#1f1c22", kind="trousers"),
 509: dict(name="酒紅吊帶連身裙", brand="舊課本", brandCode="jiukeben", category="outer", price=3680, sizes=["S", "M"], colour="#7a2f45", kind="dress"),
 510: dict(name="蕾絲領襯衫", brand="舊課本", brandCode="jiukeben", category="top", price=1580, sizes=["S", "M", "L"], colour="#f6efe6", kind="blouse"),
 511: dict(name="蓬裙襯裙", brand="半日", brandCode="banri", category="bottom", price=1280, sizes=["S", "M"], colour="#7a2f45", kind="skirt"),
 512: dict(name="蝴蝶結泡泡袖襯衫", brand="半日", brandCode="banri", category="top", price=1380, sizes=["S", "M", "L"], colour="#f6f0ea", kind="blouse"),
 513: dict(name="粉色百褶短裙", brand="半日", brandCode="banri", category="bottom", price=1480, sizes=["S", "M"], colour="#e9c9d3", kind="skirt"),
 514: dict(name="短版針織外套", brand="拾穗製衣", brandCode="shisui", category="outer", price=1980, sizes=["S", "M", "L"], colour="#f6d2dc", kind="blouse"),
 601: dict(name="兒童防潑水連帽外套", brand="野徑", brandCode="yejing", category="outer", price=1680, sizes=["110", "120", "130"], colour="#f0b84a", kind="vest"),
 602: dict(name="兒童條紋長袖T", brand="半日", brandCode="banri", category="top", price=580, sizes=["110", "120", "130"], colour="#efe6d8", kind="top"),
 603: dict(name="兒童束口褲", brand="野徑", brandCode="yejing", category="bottom", price=880, sizes=["110", "120", "130"], colour="#5b5a4e", kind="trousers"),
}

# fabric for the renderer (cotton | denim | leather | nylon | wool | satin) + display material text
# colourways: first is the default (hex must equal the outfit's colour so the outfit look stays the same)
D = {
 101: dict(fabric="wool", material="羊毛 60%・聚酯纖維 40%；內裡聚酯纖維", warmth=5,
      desc="落肩、直身，長度到小腿中段。布面帶一點毛感，不挺不軟，風吹不透。",
      colours=[("oat","燕麥","#d9d4ca"),("charcoal","炭灰","#4a4a4c")],
      fit=(170,56,"M","肩線落在肩點外約 3 公分，衣長到小腿中段，裡面可以再穿一件針織。"),
      tags=["大衣","落肩","長版","通勤"]),
 102: dict(fabric="cotton", material="棉 85%・尼龍 15%", warmth=2,
      desc="細針的圓領上衣，領口不鬆。單穿是打底，外面套大衣不會起皺。",
      colours=[("ivory","米白","#f1ede6"),("ink","墨黑","#26262a"),("moss","苔綠","#5d6b57")],
      fit=(170,56,"M","合身不緊，衣長到腰骨下一點。"),
      tags=["上衣","針織","圓領","打底"]),
 103: dict(fabric="wool", material="聚酯纖維 65%・嫘縈 30%・彈性纖維 5%", warmth=3,
      desc="直筒西裝褲，腰頭有兩個褶。布料有垂墜，坐一天不太起皺。",
      colours=[("ink","墨黑","#2e2c29"),("grey","鼠灰","#7a7a78")],
      fit=(170,56,"M","腰圍剛好，褲長踩鞋面上一公分。"),
      tags=["褲","西裝褲","直筒","通勤"]),
 104: dict(fabric="cotton", material="棉 100%", warmth=2,
      desc="寬版的棉襯衫，肩線往下落。扣到最上面一顆也不會卡脖子。",
      colours=[("ivory","米白","#f1ede6"),("sky","淺藍","#c9d6e3")],
      fit=(170,56,"L","穿 L 是刻意寬一號，袖子反折兩圈剛好。"),
      tags=["襯衫","寬版","棉","假日"]),
 105: dict(fabric="cotton", material="棉 97%・彈性纖維 3%", warmth=2,
      desc="九分的打褶褲，褲口收窄一點。腰是鬆緊加抽繩，可以不繫皮帶。",
      colours=[("ink","墨黑","#2e2c29"),("sand","沙","#c8b89a")],
      fit=(170,56,"M","腰鬆緊剛好不勒，褲長露出腳踝。"),
      tags=["褲","九分","打褶","抽繩"]),
 201: dict(fabric="nylon", material="尼龍 100%；內裡聚酯纖維網布", warmth=3,
      desc="教練外套，領子是翻領、袖口鬆緊。布面有一點光，下雨淋到不會馬上滲。",
      colours=[("navy","深藍","#2f3a4a"),("olive","橄欖","#5a5e45"),("black","黑","#1f1f22")],
      fit=(176,68,"L","肩寬剛好，衣長蓋到褲頭下。裡面可以穿帽 T。"),
      tags=["外套","教練外套","尼龍","街頭"]),
 202: dict(fabric="cotton", material="棉 100%（厚磅 280g）", warmth=2,
      desc="厚磅的短袖，領口是雙層羅紋。前胸印花是水性墨，洗久會淡一點。",
      colours=[("bone","骨白","#e9e4da"),("black","黑","#222225")],
      fit=(176,68,"L","寬鬆版，衣長蓋過褲頭一掌。"),
      tags=["上衣","短袖","厚磅","印花"]),
 203: dict(fabric="denim", material="棉 100%（11 oz 丹寧）", warmth=3,
      desc="寬管工作褲，大腿到褲口一樣寬。側邊有工具袋，褲口可以反折。",
      colours=[("slate","石板藍","#4a5566"),("ecru","本白","#dcd5c6")],
      fit=(176,68,"L","腰圍剛好，褲長反折一圈到腳踝。"),
      tags=["褲","工作褲","寬管","丹寧"]),
 204: dict(fabric="wool", material="羊毛 50%・壓克力 50%", warmth=4,
      desc="羅紋毛帽，可以反折戴也可以整個拉下來。",
      colours=[("black","黑","#26262a"),("rust","鐵鏽","#8a4a2e")],
      fit=(176,68,"F","反折一次戴，蓋到眉上。"),
      tags=["配件","毛帽","針織"], kind="beanie"),
 205: dict(fabric="nylon", material="尼龍 100%；內裡聚酯纖維鋪棉", warmth=4,
      desc="短版的飛行外套，下襬與袖口是羅紋。鋪一層薄棉，十度上下穿剛好。",
      colours=[("navy","深藍","#2f3a4a"),("black","黑","#1f1f22")],
      fit=(165,52,"S","衣長到腰，袖長剛好蓋手腕。"),
      tags=["外套","飛行外套","短版","鋪棉"]),
 206: dict(fabric="satin", material="聚酯纖維 100%", warmth=2,
      desc="百褶短裙，褶子定型過，洗完不用再燙。內有安全褲。",
      colours=[("slate","石板藍","#4a5566"),("black","黑","#222225")],
      fit=(165,52,"S","裙長到膝上約 12 公分。"),
      tags=["裙","百褶","短裙"]),
 301: dict(fabric="wool", material="棉 100%（燈芯絨）", warmth=4,
      desc="獵裝外套，四個大口袋。燈芯絨的條紋細，穿久膝蓋處會亮，是正常的。",
      colours=[("tobacco","菸草","#7a4a2a"),("forest","墨綠","#3d4d3a")],
      fit=(172,60,"M","肩寬剛好，衣長到大腿上端。"),
      tags=["外套","獵裝","燈芯絨","復古"]),
 302: dict(fabric="cotton", material="嫘縈 70%・棉 30%", warmth=1,
      desc="古巴領的短袖襯衫，領子攤開穿。布料偏薄，有垂墜。",
      colours=[("wheat","麥","#e8d7b0"),("cream","奶油","#f2ead8")],
      fit=(172,60,"M","寬鬆版，衣長蓋過褲頭。"),
      tags=["襯衫","古巴領","短袖","復古"]),
 303: dict(fabric="denim", material="棉 100%（12 oz 丹寧）", warmth=3,
      desc="高腰的直筒牛仔褲，腰頭較寬。顏色是淺洗，膝蓋處有一點刷白。",
      colours=[("camel","駝","#9a6a3c"),("indigo","靛","#3b4a6b")],
      fit=(172,60,"M","腰在肚臍上，褲長到腳踝上一公分。"),
      tags=["褲","牛仔褲","高腰","直筒"]),
 401: dict(fabric="nylon", material="尼龍 100%（防潑水塗層）", warmth=3, features=["防潑水"],
      desc="防潑水的連帽外套，小雨不用撐傘。腋下有透氣拉鍊，帽子可以收進領子。",
      colours=[("mustard","芥黃","#e8b53a"),("stone","岩灰","#8b8a82")],
      fit=(176,68,"L","衣長到臀部上緣，裡面穿一件長袖剛好。"),
      tags=["外套","防潑水","連帽","戶外"]),
 402: dict(fabric="cotton", material="聚酯纖維 88%・彈性纖維 12%", warmth=2, features=["快乾"],
      desc="快乾的長袖，排汗後十幾分鐘就乾。袖口有拇指孔。",
      colours=[("pine","松綠","#3f5a46"),("black","黑","#222225")],
      fit=(176,68,"L","合身，衣長到腰骨下。"),
      tags=["上衣","快乾","長袖","戶外"]),
 403: dict(fabric="nylon", material="尼龍 92%・彈性纖維 8%", warmth=3, features=["快乾"],
      desc="褲口束口的機能褲，膝蓋有立體剪裁。腰頭鬆緊加腰帶。",
      colours=[("khaki","卡其","#5b5a4e"),("black","黑","#222225")],
      fit=(176,68,"L","腰圍剛好，褲口束在腳踝上。"),
      tags=["褲","束口褲","機能","戶外"]),
 404: dict(fabric="wool", material="美麗諾羊毛 60%・尼龍 38%・彈性纖維 2%", warmth=3,
      desc="中筒的健行襪，腳跟與腳尖加厚。",
      colours=[("grey","灰","#8a8a86"),("navy","深藍","#2f3a4a")],
      fit=(176,68,"F","筒高到小腿中段。"),
      tags=["鞋襪","襪","健行","戶外"], kind="socks"),
 501: dict(fabric="wool", material="羊毛 70%・聚酯纖維 30%；內裡聚酯纖維", warmth=4,
      desc="單排一扣的西裝外套，肩線沒有墊肩。配褲子是一套，也能單穿配牛仔褲。",
      colours=[("camel","駝","#c6a06a"),("navy","海軍藍","#2b3550")],
      fit=(170,56,"M","肩寬剛好，衣長蓋過臀部一半。"),
      tags=["外套","西裝外套","單排扣","正式"]),
 502: dict(fabric="cotton", material="棉 100%（牛津布）", warmth=2,
      desc="牛津襯衫，領子是鈕扣領。布料偏厚，不用燙也看不出皺。",
      colours=[("white","白","#f3efe8"),("blue","淺藍","#c7d4e2")],
      fit=(170,56,"M","合身，袖長到手腕骨。"),
      tags=["襯衫","牛津","鈕扣領","正式"]),
 503: dict(fabric="wool", material="羊毛 70%・聚酯纖維 30%", warmth=3,
      desc="錐形的西裝褲，從大腿往褲口收。與 501 同布料。",
      colours=[("navy","海軍藍","#2b3550"),("charcoal","炭灰","#4a4a4c")],
      fit=(170,56,"M","腰圍剛好，褲長踩鞋面上一公分。"),
      tags=["褲","西裝褲","錐形","正式"]),
 504: dict(fabric="satin", material="聚酯纖維 100%", warmth=2,
      desc="襯衫式的洋裝，腰間一條綁帶。長度到小腿，走路不卡。",
      colours=[("white","白","#f3efe8"),("sage","灰綠","#b9c2ae")],
      fit=(165,52,"S","腰帶綁在肚臍上，裙長到小腿中段。"),
      tags=["洋裝","襯衫洋裝","綁帶","正式"]),
 505: dict(fabric="leather", material="牛皮；黃銅扣頭", warmth=1,
      desc="1.8 公分的細皮帶，五個孔。扣頭是霧面黃銅。",
      colours=[("black","黑","#26262a"),("tan","茶","#8a5a34")],
      fit=(165,52,"F","扣在第三個孔，腰圍 66 公分。"),
      tags=["配件","皮帶","細皮帶"], kind="belt"),
 506: dict(fabric="leather", material="牛皮（水洗處理）；內裡聚酯纖維", warmth=4,
      desc="水洗處理的皮夾克，皮面有自然的皺紋。前襟斜拉鍊，兩側有拉鍊口袋。",
      colours=[("black","黑","#2b272c")],
      fit=(176,68,"L","合身，衣長到腰。皮會隨穿著變軟。"),
      tags=["外套","皮夾克","水洗","龐克"]),
 507: dict(fabric="cotton", material="棉 100%", warmth=1,
      desc="領口與下襬有破壞處理的短 T，每件的位置不太一樣。",
      colours=[("wine","暗紅","#5a1f24"),("black","黑","#222225")],
      fit=(176,68,"L","寬鬆版，衣長到褲頭下。"),
      tags=["上衣","短T","破壞","龐克"]),
 508: dict(fabric="denim", material="棉 98%・彈性纖維 2%", warmth=3,
      desc="黑色的直筒褲，布料帶一點彈性。褲口沒有縫邊，是剪的。",
      colours=[("black","黑","#1f1c22")],
      fit=(176,68,"L","腰圍剛好，褲長到腳踝。"),
      tags=["褲","直筒","黑色","龐克"]),
 509: dict(fabric="satin", material="聚酯纖維 100%；內裡棉", warmth=3,
      desc="酒紅的吊帶連身裙，裙身有三層荷葉。肩帶可調。裡面要穿襯衫。",
      colours=[("burgundy","酒紅","#7a2f45"),("black","黑","#26262a")],
      fit=(160,48,"S","裙長到膝下，裡面穿 510 剛好。"),
      tags=["洋裝","吊帶","連身裙","蘿莉塔"]),
 510: dict(fabric="cotton", material="棉 100%；領口蕾絲為尼龍", warmth=2,
      desc="蕾絲領的襯衫，袖口也有一圈蕾絲。單穿或穿在吊帶裙裡面。",
      colours=[("ivory","象牙白","#f6efe6")],
      fit=(160,48,"S","合身，袖長到手腕。"),
      tags=["襯衫","蕾絲","蘿莉塔"]),
 511: dict(fabric="satin", material="聚酯纖維 100%（硬紗）", warmth=1,
      desc="撐裙型的襯裙，三層硬紗。穿在裙子裡面讓裙子站起來。",
      colours=[("burgundy","酒紅","#7a2f45"),("white","白","#f4f0ea")],
      fit=(160,48,"S","裙長到膝上，比外裙短 3 公分。"),
      tags=["裙","襯裙","蓬裙","蘿莉塔"]),
 512: dict(fabric="cotton", material="棉 65%・聚酯纖維 35%", warmth=2,
      desc="泡泡袖的襯衫，領口一個蝴蝶結，可以拆。",
      colours=[("white","白","#f6f0ea"),("lavender","薰衣草","#d9cfe3")],
      fit=(160,48,"S","合身，衣長到腰。"),
      tags=["襯衫","泡泡袖","蝴蝶結","量產型"]),
 513: dict(fabric="satin", material="聚酯纖維 100%", warmth=2,
      desc="粉色的百褶短裙，腰頭後面是鬆緊。內有安全褲。",
      colours=[("pink","櫻粉","#e9c9d3"),("white","白","#f4f0ea"),("black","黑","#222225")],
      fit=(160,48,"S","裙長到膝上約 10 公分。"),
      tags=["裙","百褶","短裙","量產型"]),
 514: dict(fabric="cotton", material="壓克力 60%・尼龍 30%・羊毛 10%", warmth=3,
      desc="短版的針織外套，前面三顆珍珠扣。可以當上衣扣起來穿。",
      colours=[("pink","淺粉","#f6d2dc"),("cream","奶油","#f2ead8")],
      fit=(160,48,"S","衣長到腰上，袖長到手腕。"),
      tags=["外套","針織外套","短版","量產型"]),
 601: dict(fabric="nylon", material="尼龍 100%（防潑水塗層）；內裡刷毛", warmth=3, features=["防潑水"],
      desc="小孩的防潑水連帽外套，拉鍊到下巴有護片。袖口與下襬鬆緊，跑跳不會跑進風。",
      colours=[("mustard","芥黃","#f0b84a"),("navy","深藍","#2f3a4a")],
      fit=(120,22,"120","身高 120 公分穿 120，袖長剛好，衣長蓋過褲頭。"),
      tags=["外套","小孩","兒童","防潑水","連帽","戶外"]),
 602: dict(fabric="cotton", material="棉 100%", warmth=2,
      desc="小孩的條紋長袖，領口有肩扣，套頭不卡。洗了不太縮。",
      colours=[("cream","奶油條紋","#efe6d8"),("navy","深藍條紋","#3b4a6b")],
      fit=(120,22,"120","合身，衣長到褲頭下一點。"),
      tags=["上衣","小孩","兒童","長袖","條紋"]),
 603: dict(fabric="nylon", material="尼龍 88%・彈性纖維 12%", warmth=3, features=["快乾"],
      desc="小孩的束口褲，膝蓋有補強布，草地上跪著玩也不怕。腰頭鬆緊加抽繩。",
      colours=[("khaki","卡其","#5b5a4e"),("black","黑","#222225")],
      fit=(120,22,"120","腰圍剛好，褲口束在腳踝。"),
      tags=["褲","小孩","兒童","束口褲","戶外"]),
}
assert set(D) == set(items), (set(D) ^ set(items))

# measurement columns per kind; base values for S and the step per size
SIZES = ["S", "M", "L", "XL"]
MEASURE = {
 "coat":     [("肩寬", 48, 2), ("胸寬", 58, 3), ("衣長", 100, 3), ("袖長", 60, 1.5)],
 "jacket":   [("肩寬", 47, 2), ("胸寬", 56, 3), ("衣長", 62, 3), ("袖長", 60, 1.5)],
 "vest":     [("肩寬", 47, 2), ("胸寬", 57, 3), ("衣長", 68, 3), ("袖長", 61, 1.5)],
 "top":      [("肩寬", 42, 2), ("胸寬", 50, 3), ("衣長", 66, 2), ("袖長", 58, 1.5)],
 "blouse":   [("肩寬", 43, 2), ("胸寬", 52, 3), ("衣長", 68, 2), ("袖長", 58, 1.5)],
 "trousers": [("腰圍", 70, 4), ("臀圍", 94, 4), ("褲長", 96, 2)],
 "skirt":    [("腰圍", 64, 4), ("臀圍", 90, 4), ("裙長", 42, 1.5)],
 "dress":    [("胸寬", 44, 3), ("腰圍", 66, 4), ("衣長", 100, 3)],
}
# per-product adjustments: (column -> add to base) so the tables are not all identical
ADJ = {
 104: {"肩寬": 4, "胸寬": 6, "衣長": 6},   # 寬版
 202: {"肩寬": 4, "胸寬": 5, "衣長": 5, "袖長": -34},  # 短袖
 302: {"肩寬": 2, "胸寬": 4, "袖長": -34},
 507: {"肩寬": 3, "胸寬": 4, "衣長": 4, "袖長": -36},
 105: {"褲長": -6},
 203: {"臀圍": 6, "褲長": 4},
 303: {"腰圍": -2, "褲長": 2},
 403: {"褲長": -2},
 206: {"裙長": -4}, 513: {"裙長": -2}, 511: {"裙長": -6},
 509: {"衣長": -8}, 504: {"衣長": 10},
 514: {"衣長": -14},
 205: {"衣長": -6}, 501: {"衣長": 8}, 401: {"衣長": 4},
}
ONE_SIZE = {
 204: [("頭圍", "56–60")],
 404: [("腳長", "23–27"), ("筒高", "22")],
 505: [("全長", "95"), ("寬", "1.8")],
}

# 童裝尺寸表：110 起、每級加的量；欄名和大人的同款式一樣
KIDS_SIZES = ["110", "120", "130"]
KIDS_MEASURE = {
 "vest":     [("肩寬", 30, 1.5), ("胸寬", 38, 2), ("衣長", 44, 3), ("袖長", 38, 3)],
 "top":      [("肩寬", 28, 1.5), ("胸寬", 34, 2), ("衣長", 42, 3), ("袖長", 36, 3)],
 "trousers": [("腰圍", 50, 2), ("臀圍", 62, 3), ("褲長", 62, 5)],
}

def measure_for(pid, kind, sizes):
    if sizes and sizes[0] in KIDS_SIZES:
        cols = KIDS_MEASURE[kind]
        rows = {s: [round(base + step * KIDS_SIZES.index(s), 1) for _, base, step in cols] for s in sizes}
        return {"columns": [c for c, _, _ in cols], "rows": rows}
    if pid in ONE_SIZE:
        return {"columns": [c for c, _ in ONE_SIZE[pid]], "rows": {"F": [v for _, v in ONE_SIZE[pid]]}}
    cols = MEASURE[kind]
    adj = ADJ.get(pid, {})
    rows = {}
    for s in sizes:
        i = SIZES.index(s)
        rows[s] = [round(base + adj.get(name, 0) + step * i, 1) for name, base, step in cols]
    return {"columns": [c for c, _, _ in cols], "rows": rows}

# stock: seeded; a few chosen zeros so the out-of-stock state shows on the first outfit
rng = random.Random(58)
rng_sold = random.Random(85)  # 銷量另用一個種子，不影響庫存的亂數序列
ZERO = {(101, "charcoal", "L"), (101, "oat", "S"), (302, "wheat", "M"), (509, "burgundy", "S"), (203, "slate", "L"), (513, "pink", "M"), (506, "black", "S")}
LOW = {(102, "ivory", "M"): 2, (201, "navy", "L"): 1, (401, "mustard", "M"): 3, (512, "white", "S"): 2}

out = []
for pid in sorted(items):
    it = items[pid]
    d = D[pid]
    kind = d.get("kind", it.get("kind"))
    colours = [{"code": c, "name": n, "hex": h} for c, n, h in d["colours"]]
    assert colours[0]["hex"] == (it.get("colour") or colours[0]["hex"]), pid
    stock = {}
    for c in colours:
        for s in it["sizes"]:
            key = f'{c["code"]}-{s}'
            if (pid, c["code"], s) in ZERO:
                stock[key] = 0
            elif (pid, c["code"], s) in LOW:
                stock[key] = LOW[(pid, c["code"], s)]
            else:
                stock[key] = rng.randint(4, 18)
    h, w, size, note = d["fit"]
    # 上架日與累計銷量：排序（新上架、熱銷）要用；日期是前端暫定的假資料
    listed = date(2026, 8, 20) + timedelta(days=(pid * 7) % 45)
    out.append({
        "productId": pid,
        "name": it["name"],
        "brand": it["brand"],
        "brandCode": it["brandCode"],
        "category": it["category"],
        "price": it["price"],
        "sizes": it["sizes"],
        "listedAt": listed.isoformat(),
        "sold": rng_sold.randint(3, 120),
        "kind": kind,
        "fabric": d["fabric"],
        "material": d["material"],
        "description": d["desc"],
        "warmth": d["warmth"],
        "features": d.get("features", []),
        "colours": colours,
        "stock": stock,
        "measure": measure_for(pid, kind, it["sizes"]),
        "fit": {"height": h, "weight": w, "size": size, "note": note},
        "tags": d["tags"],
    })

text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
(repo / "src/api/mock/products.json").write_bytes(text.encode("utf-8"))
print(len(out), "products written;", sum(1 for p in out for v in p["stock"].values() if v == 0), "zero-stock cells")
