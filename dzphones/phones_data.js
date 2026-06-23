const BRAND_META = {
  Apple:  { color:'#b0b0b8', glow:'rgba(200,200,210,0.5)', logo:'', tagline:'iPhone' },
  Samsung:{ color:'#1a6fe6', glow:'rgba(26,111,230,0.5)',  logo:'', tagline:'Galaxy' },
  Xiaomi: { color:'#ff6900', glow:'rgba(255,105,0,0.5)',   logo:'', tagline:'Redmi·POCO' },
  Huawei: { color:'#cf1f2e', glow:'rgba(207,31,46,0.5)',   logo:'', tagline:'Nova·P·Mate' },
  Oppo:   { color:'#1fad5e', glow:'rgba(31,173,94,0.5)',   logo:'', tagline:'Reno·A·Find' },
  Tecno:  { color:'#0099e6', glow:'rgba(0,153,230,0.5)',   logo:'', tagline:'Spark·Pova·Camon' },
  Infinix:{ color:'#8b5cf6', glow:'rgba(139,92,246,0.5)',  logo:'', tagline:'Hot·Note·Zero' },
  Honor:  { color:'#e63946', glow:'rgba(230,57,70,0.5)',   logo:'', tagline:'X·Magic·Play' },
  Realme: { color:'#f7b731', glow:'rgba(247,183,49,0.5)',  logo:'', tagline:'C·GT·Narzo' },
  Vivo:   { color:'#415fff', glow:'rgba(65,95,255,0.5)',   logo:'', tagline:'V·Y·X·iQOO' },
  Nokia:  { color:'#005aff', glow:'rgba(0,90,255,0.5)',    logo:'', tagline:'G·C·X' },
  Itel:   { color:'#00c896', glow:'rgba(0,200,150,0.5)',   logo:'', tagline:'A·P·S' },
  Autre:  { color:'#6b7280', glow:'rgba(107,114,128,0.4)', logo:'', tagline:'' },
};

// ─── PHONES DATABASE ───────────────────────────────────────────────────────
// 120+ modèles représentatifs du marché algérien 2026
const PHONES_DEMO = [

// ══════════════════════════════════════════════════════
// APPLE — iPhone
// ══════════════════════════════════════════════════════
{id:'ip16pm256',  name:'iPhone 16 Pro Max 256GB', brand:'Apple', segment:'high', price_official:292000, price_caba:358000, trend:'up',   specs:{ram:8,  storage:256, screen:6.9, battery:4685, camera:'48+12+12MP', os:'iOS 18'},   credit_monthly:13500},
{id:'ip16pm512',  name:'iPhone 16 Pro Max 512GB', brand:'Apple', segment:'high', price_official:335000, price_caba:410000, trend:'up',   specs:{ram:8,  storage:512, screen:6.9, battery:4685, camera:'48+12+12MP', os:'iOS 18'},   credit_monthly:15500},
{id:'ip16pro128', name:'iPhone 16 Pro 128GB',      brand:'Apple', segment:'high', price_official:245000, price_caba:299000, trend:'up',   specs:{ram:8,  storage:128, screen:6.3, battery:3582, camera:'48+12+12MP', os:'iOS 18'},   credit_monthly:11200},
{id:'ip16pro256', name:'iPhone 16 Pro 256GB',      brand:'Apple', segment:'high', price_official:268000, price_caba:327000, trend:'up',   specs:{ram:8,  storage:256, screen:6.3, battery:3582, camera:'48+12+12MP', os:'iOS 18'},   credit_monthly:12300},
{id:'ip16128',    name:'iPhone 16 128GB',           brand:'Apple', segment:'high', price_official:172000, price_caba:210000, trend:'flat', specs:{ram:6,  storage:128, screen:6.1, battery:3561, camera:'48+12MP',    os:'iOS 18'},   credit_monthly:7800},
{id:'ip16256',    name:'iPhone 16 256GB',           brand:'Apple', segment:'high', price_official:195000, price_caba:238000, trend:'flat', specs:{ram:6,  storage:256, screen:6.1, battery:3561, camera:'48+12MP',    os:'iOS 18'},   credit_monthly:8900},
{id:'ip16p128',   name:'iPhone 16 Plus 128GB',      brand:'Apple', segment:'high', price_official:188000, price_caba:230000, trend:'flat', specs:{ram:6,  storage:128, screen:6.7, battery:4674, camera:'48+12MP',    os:'iOS 18'},   credit_monthly:8600},
{id:'ip15128',    name:'iPhone 15 128GB',           brand:'Apple', segment:'high', price_official:148000, price_caba:181000, trend:'down', specs:{ram:6,  storage:128, screen:6.1, battery:3349, camera:'48+12MP',    os:'iOS 17'},   credit_monthly:6700},
{id:'ip15256',    name:'iPhone 15 256GB',           brand:'Apple', segment:'high', price_official:168000, price_caba:205000, trend:'down', specs:{ram:6,  storage:256, screen:6.1, battery:3349, camera:'48+12MP',    os:'iOS 17'},   credit_monthly:7700},
{id:'ip15pro128', name:'iPhone 15 Pro 128GB',       brand:'Apple', segment:'high', price_official:198000, price_caba:242000, trend:'down', specs:{ram:8,  storage:128, screen:6.1, battery:3274, camera:'48+12+12MP', os:'iOS 17'},   credit_monthly:9100},
{id:'ip15pm256',  name:'iPhone 15 Pro Max 256GB',   brand:'Apple', segment:'high', price_official:235000, price_caba:287000, trend:'down', specs:{ram:8,  storage:256, screen:6.7, battery:4422, camera:'48+12+12MP', os:'iOS 17'},   credit_monthly:10800},
{id:'ip14128',    name:'iPhone 14 128GB',           brand:'Apple', segment:'high', price_official:118000, price_caba:144000, trend:'down', specs:{ram:6,  storage:128, screen:6.1, battery:3279, camera:'12+12MP',    os:'iOS 16'},   credit_monthly:5400},
{id:'ip14pro128', name:'iPhone 14 Pro 128GB',       brand:'Apple', segment:'high', price_official:158000, price_caba:193000, trend:'down', specs:{ram:6,  storage:128, screen:6.1, battery:3200, camera:'48+12+12MP', os:'iOS 16'},   credit_monthly:7200},
{id:'ip13pm128',  name:'iPhone 13 Pro Max 128GB',   brand:'Apple', segment:'high', price_official:115000, price_caba:140000, trend:'flat', specs:{ram:6,  storage:128, screen:6.7, battery:4352, camera:'12+12+12MP', os:'iOS 16'},   credit_monthly:5200},
{id:'ip13pro128', name:'iPhone 13 Pro 128GB',       brand:'Apple', segment:'high', price_official:105000, price_caba:128000, trend:'flat', specs:{ram:6,  storage:128, screen:6.1, battery:3095, camera:'12+12+12MP', os:'iOS 16'},   credit_monthly:4800},
{id:'ip13128',    name:'iPhone 13 128GB',           brand:'Apple', segment:'mid',  price_official:75000,  price_caba:91000,  trend:'flat', specs:{ram:4,  storage:128, screen:6.1, battery:3240, camera:'12+12MP',    os:'iOS 16'},   credit_monthly:3400},
{id:'ip13256',    name:'iPhone 13 256GB',           brand:'Apple', segment:'mid',  price_official:88000,  price_caba:107000, trend:'flat', specs:{ram:4,  storage:256, screen:6.1, battery:3240, camera:'12+12MP',    os:'iOS 16'},   credit_monthly:4000},
{id:'ip12128',    name:'iPhone 12 128GB',           brand:'Apple', segment:'mid',  price_official:62000,  price_caba:75000,  trend:'down', specs:{ram:4,  storage:128, screen:6.1, battery:2815, camera:'12+12MP',    os:'iOS 15'},   credit_monthly:2800},
{id:'ipse3',      name:'iPhone SE (3e gén.) 64GB',  brand:'Apple', segment:'mid',  price_official:58000,  price_caba:70000,  trend:'flat', specs:{ram:4,  storage:64,  screen:4.7, battery:2018, camera:'12MP',       os:'iOS 17'},   credit_monthly:2600},

// ══════════════════════════════════════════════════════
// SAMSUNG — Galaxy S / A / M
// ══════════════════════════════════════════════════════
{id:'ss24u256',   name:'Galaxy S24 Ultra 256GB',    brand:'Samsung', segment:'high', price_official:265000, price_caba:325000, trend:'up',   specs:{ram:12, storage:256, screen:6.8, battery:5000, camera:'200+12+10+50MP', os:'Android 14'}, credit_monthly:12100},
{id:'ss24u512',   name:'Galaxy S24 Ultra 512GB',    brand:'Samsung', segment:'high', price_official:298000, price_caba:365000, trend:'up',   specs:{ram:12, storage:512, screen:6.8, battery:5000, camera:'200+12+10+50MP', os:'Android 14'}, credit_monthly:13700},
{id:'ss24p256',   name:'Galaxy S24+ 256GB',         brand:'Samsung', segment:'high', price_official:195000, price_caba:238000, trend:'flat', specs:{ram:12, storage:256, screen:6.7, battery:4900, camera:'50+12+10MP',      os:'Android 14'}, credit_monthly:8900},
{id:'ss24128',    name:'Galaxy S24 128GB',          brand:'Samsung', segment:'high', price_official:158000, price_caba:193000, trend:'flat', specs:{ram:8,  storage:128, screen:6.2, battery:4000, camera:'50+12+10MP',      os:'Android 14'}, credit_monthly:7200},
{id:'ss23u256',   name:'Galaxy S23 Ultra 256GB',    brand:'Samsung', segment:'high', price_official:215000, price_caba:263000, trend:'down', specs:{ram:12, storage:256, screen:6.8, battery:5000, camera:'200+12+10+10MP',  os:'Android 13'}, credit_monthly:9800},
{id:'ss23fe128',  name:'Galaxy S23 FE 128GB',       brand:'Samsung', segment:'mid',  price_official:82000,  price_caba:100000, trend:'flat', specs:{ram:8,  storage:128, screen:6.4, battery:4500, camera:'50+12+8MP',       os:'Android 13'}, credit_monthly:3700},
{id:'ss22u512',   name:'Galaxy S22 Ultra 5G 512GB', brand:'Samsung', segment:'high', price_official:108000, price_caba:132000, trend:'down', specs:{ram:12, storage:512, screen:6.8, battery:5000, camera:'108+10+12+10MP',  os:'Android 12'}, credit_monthly:4900},
{id:'ssa55256',   name:'Galaxy A55 5G 256GB',       brand:'Samsung', segment:'mid',  price_official:72000,  price_caba:88000,  trend:'up',   specs:{ram:8,  storage:256, screen:6.6, battery:5000, camera:'50+12+5MP',       os:'Android 14'}, credit_monthly:3300},
{id:'ssa54128',   name:'Galaxy A54 5G 128GB',       brand:'Samsung', segment:'mid',  price_official:65000,  price_caba:79000,  trend:'flat', specs:{ram:8,  storage:128, screen:6.4, battery:5000, camera:'50+12+5MP',       os:'Android 13'}, credit_monthly:2900},
{id:'ssa35128',   name:'Galaxy A35 5G 128GB',       brand:'Samsung', segment:'entry',price_official:38000,  price_caba:46000,  trend:'flat', specs:{ram:6,  storage:128, screen:6.6, battery:5000, camera:'50+8+5MP',        os:'Android 14'}, credit_monthly:1700},
{id:'ssa25128',   name:'Galaxy A25 5G 128GB',       brand:'Samsung', segment:'entry',price_official:29000,  price_caba:35000,  trend:'flat', specs:{ram:6,  storage:128, screen:6.5, battery:5000, camera:'50+8+2MP',        os:'Android 14'}, credit_monthly:1300},
{id:'ssa24128',   name:'Galaxy A24 128GB',          brand:'Samsung', segment:'entry',price_official:26000,  price_caba:32000,  trend:'flat', specs:{ram:6,  storage:128, screen:6.5, battery:5000, camera:'50+5+2MP',        os:'Android 14'}, credit_monthly:1200},
{id:'ssa15128',   name:'Galaxy A15 128GB',          brand:'Samsung', segment:'entry',price_official:22000,  price_caba:27000,  trend:'down', specs:{ram:4,  storage:128, screen:6.5, battery:5000, camera:'50+5+2MP',        os:'Android 14'}, credit_monthly:1000},
{id:'ssa0664',    name:'Galaxy A06 64GB',           brand:'Samsung', segment:'entry',price_official:13500,  price_caba:16500,  trend:'flat', specs:{ram:4,  storage:64,  screen:6.7, battery:5000, camera:'50+2MP',          os:'Android 14'}, credit_monthly:620},
{id:'ssm3464',    name:'Galaxy M34 5G 64GB',        brand:'Samsung', segment:'entry',price_official:24000,  price_caba:29000,  trend:'flat', specs:{ram:6,  storage:64,  screen:6.5, battery:6000, camera:'50+8+2MP',        os:'Android 13'}, credit_monthly:1100},
{id:'ssm1464',    name:'Galaxy M14 5G 64GB',        brand:'Samsung', segment:'entry',price_official:19500,  price_caba:24000,  trend:'flat', specs:{ram:4,  storage:64,  screen:6.6, battery:6000, camera:'50+2MP',          os:'Android 13'}, credit_monthly:890},

// ══════════════════════════════════════════════════════
// XIAOMI — Redmi / POCO / Mi
// ══════════════════════════════════════════════════════
{id:'xm14t256',   name:'Xiaomi 14T Pro 256GB',      brand:'Xiaomi', segment:'mid',  price_official:96000,  price_caba:117000, trend:'up',   specs:{ram:12, storage:256, screen:6.67,battery:5000, camera:'50+50+12MP',  os:'Android 14'}, credit_monthly:4400},
{id:'xm13t256',   name:'Xiaomi 13T Pro 256GB',      brand:'Xiaomi', segment:'mid',  price_official:78000,  price_caba:95000,  trend:'flat', specs:{ram:12, storage:256, screen:6.67,battery:5000, camera:'50+50+12MP',  os:'Android 13'}, credit_monthly:3600},
{id:'xm13256',    name:'Xiaomi 13 256GB',           brand:'Xiaomi', segment:'mid',  price_official:72000,  price_caba:88000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.36,battery:4500, camera:'54+10+12MP',  os:'Android 13'}, credit_monthly:3300},
{id:'rn13p256',   name:'Redmi Note 13 Pro+ 256GB',  brand:'Xiaomi', segment:'mid',  price_official:58000,  price_caba:70000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'200+8+2MP',   os:'Android 13'}, credit_monthly:2600},
{id:'rn13p128',   name:'Redmi Note 13 Pro 128GB',   brand:'Xiaomi', segment:'mid',  price_official:48000,  price_caba:58000,  trend:'flat', specs:{ram:8,  storage:128, screen:6.67,battery:5000, camera:'200+8+2MP',   os:'Android 13'}, credit_monthly:2200},
{id:'rn13128',    name:'Redmi Note 13 128GB',       brand:'Xiaomi', segment:'entry',price_official:24000,  price_caba:29000,  trend:'flat', specs:{ram:6,  storage:128, screen:6.67,battery:5000, camera:'108+8MP',     os:'Android 13'}, credit_monthly:1100},
{id:'rn12p128',   name:'Redmi Note 12 Pro 128GB',   brand:'Xiaomi', segment:'entry',price_official:32000,  price_caba:39000,  trend:'down', specs:{ram:8,  storage:128, screen:6.67,battery:5000, camera:'50+8+2MP',    os:'Android 12'}, credit_monthly:1450},
{id:'ri13c128',   name:'Redmi 13C 128GB',           brand:'Xiaomi', segment:'entry',price_official:16500,  price_caba:20000,  trend:'flat', specs:{ram:4,  storage:128, screen:6.74,battery:5000, camera:'50+0.3MP',    os:'Android 13'}, credit_monthly:750},
{id:'ri12c128',   name:'Redmi 12C 128GB',           brand:'Xiaomi', segment:'entry',price_official:15000,  price_caba:18000,  trend:'down', specs:{ram:4,  storage:128, screen:6.71,battery:5000, camera:'50+0.08MP',   os:'Android 12'}, credit_monthly:680},
{id:'ri13128',    name:'Redmi 13 128GB',            brand:'Xiaomi', segment:'entry',price_official:24000,  price_caba:29000,  trend:'flat', specs:{ram:6,  storage:128, screen:6.79,battery:5030, camera:'108+8MP',     os:'Android 14'}, credit_monthly:1100},
{id:'px6p256',    name:'POCO X6 Pro 256GB',         brand:'Xiaomi', segment:'mid',  price_official:52000,  price_caba:63000,  trend:'up',   specs:{ram:12, storage:256, screen:6.67,battery:5000, camera:'64+8+2MP',    os:'Android 14'}, credit_monthly:2400},
{id:'px5p256',    name:'POCO X5 Pro 256GB',         brand:'Xiaomi', segment:'mid',  price_official:42000,  price_caba:51000,  trend:'down', specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'108+8+2MP',   os:'Android 12'}, credit_monthly:1900},
{id:'pm6p256',    name:'POCO M6 Pro 256GB',         brand:'Xiaomi', segment:'entry',price_official:33000,  price_caba:40000,  trend:'up',   specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'64+8+2MP',    os:'Android 13'}, credit_monthly:1500},

// ══════════════════════════════════════════════════════
// HUAWEI
// ══════════════════════════════════════════════════════
{id:'hwp60p256',  name:'Huawei P60 Pro 256GB',      brand:'Huawei', segment:'high', price_official:175000, price_caba:213000, trend:'flat', specs:{ram:8,  storage:256, screen:6.67,battery:4815, camera:'48+13+48MP',  os:'HarmonyOS 4'}, credit_monthly:8000},
{id:'hwm60p256',  name:'Huawei Mate 60 Pro 256GB',  brand:'Huawei', segment:'high', price_official:245000, price_caba:299000, trend:'up',   specs:{ram:12, storage:256, screen:6.82,battery:5000, camera:'50+13+12MP',  os:'HarmonyOS 4'}, credit_monthly:11200},
{id:'hwm50512',   name:'Huawei Mate 50 Pro 512GB',  brand:'Huawei', segment:'high', price_official:185000, price_caba:226000, trend:'down', specs:{ram:8,  storage:512, screen:6.74,battery:4700, camera:'50+13+64MP',  os:'HarmonyOS 3'}, credit_monthly:8500},
{id:'hwn12p256',  name:'Huawei Nova 12 Pro 256GB',  brand:'Huawei', segment:'mid',  price_official:76000,  price_caba:93000,  trend:'up',   specs:{ram:12, storage:256, screen:6.76,battery:4600, camera:'60+8MP',      os:'HarmonyOS 4'}, credit_monthly:3500},
{id:'hwn11256',   name:'Huawei Nova 11 256GB',      brand:'Huawei', segment:'mid',  price_official:65000,  price_caba:79000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.7, battery:4500, camera:'60+8MP',      os:'HarmonyOS 3'}, credit_monthly:3000},
{id:'hwp50p256',  name:'Huawei P50 Pro 256GB',      brand:'Huawei', segment:'mid',  price_official:88000,  price_caba:107000, trend:'down', specs:{ram:8,  storage:256, screen:6.6, battery:4360, camera:'50+13+64+40MP',os:'HarmonyOS 2'}, credit_monthly:4000},

// ══════════════════════════════════════════════════════
// OPPO
// ══════════════════════════════════════════════════════
{id:'op_reno16',  name:'OPPO Reno 16 12GB/256GB',   brand:'Oppo', segment:'high',  price_official:128000, price_caba:156000, trend:'up',   specs:{ram:12, storage:256, screen:6.7, battery:5000, camera:'50+8+2MP',    os:'Android 14'}, credit_monthly:5800},
{id:'op_reno12p', name:'OPPO Reno 12 Pro 256GB',    brand:'Oppo', segment:'mid',   price_official:72000,  price_caba:87000,  trend:'up',   specs:{ram:12, storage:256, screen:6.7, battery:5000, camera:'50+8+2MP',    os:'Android 14'}, credit_monthly:3300},
{id:'op_reno11',  name:'OPPO Reno 11 256GB',        brand:'Oppo', segment:'mid',   price_official:58000,  price_caba:71000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.7, battery:5000, camera:'50+32+8MP',   os:'Android 13'}, credit_monthly:2600},
{id:'op_reno10',  name:'OPPO Reno 10 256GB',        brand:'Oppo', segment:'mid',   price_official:52000,  price_caba:63000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.7, battery:5000, camera:'64+32+8MP',   os:'Android 13'}, credit_monthly:2400},
{id:'op_a98',     name:'OPPO A98 5G 256GB',         brand:'Oppo', segment:'mid',   price_official:45000,  price_caba:55000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.72,battery:5000, camera:'64+2MP',      os:'Android 13'}, credit_monthly:2050},
{id:'op_a78',     name:'OPPO A78 128GB',            brand:'Oppo', segment:'entry', price_official:28000,  price_caba:34000,  trend:'flat', specs:{ram:8,  storage:128, screen:6.43,battery:5000, camera:'50+2MP',      os:'Android 13'}, credit_monthly:1280},
{id:'op_a58',     name:'OPPO A58 128GB',            brand:'Oppo', segment:'entry', price_official:22000,  price_caba:27000,  trend:'flat', specs:{ram:6,  storage:128, screen:6.72,battery:5000, camera:'64+2MP',      os:'Android 13'}, credit_monthly:1000},

// ══════════════════════════════════════════════════════
// HONOR
// ══════════════════════════════════════════════════════
{id:'ho_magic6',  name:'Honor Magic 6 Pro 256GB',   brand:'Honor', segment:'high',  price_official:155000, price_caba:189000, trend:'up',   specs:{ram:12, storage:256, screen:6.8, battery:5600, camera:'50+180+12MP', os:'Android 14'}, credit_monthly:7100},
{id:'ho_90',      name:'Honor 90 5G 256GB',         brand:'Honor', segment:'mid',   price_official:69000,  price_caba:84000,  trend:'flat', specs:{ram:12, storage:256, screen:6.7, battery:5000, camera:'200+12+2MP',  os:'Android 13'}, credit_monthly:3150},
{id:'ho_90lite',  name:'Honor 90 Lite 256GB',       brand:'Honor', segment:'entry', price_official:31000,  price_caba:38000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.7, battery:4500, camera:'100+5+2MP',   os:'Android 13'}, credit_monthly:1420},
{id:'ho_x9b',     name:'Honor X9b 256GB',           brand:'Honor', segment:'entry', price_official:35000,  price_caba:43000,  trend:'up',   specs:{ram:12, storage:256, screen:6.78,battery:5800, camera:'108+5MP',     os:'Android 13'}, credit_monthly:1600},
{id:'ho_x8b',     name:'Honor X8b 256GB',           brand:'Honor', segment:'entry', price_official:24000,  price_caba:29000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.7, battery:4500, camera:'108+5+2MP',   os:'Android 13'}, credit_monthly:1100},

// ══════════════════════════════════════════════════════
// TECNO
// ══════════════════════════════════════════════════════
{id:'tc_pova6',   name:'Tecno Pova 6 8GB/256GB',    brand:'Tecno', segment:'entry', price_official:37900,  price_caba:46000,  trend:'up',   specs:{ram:8,  storage:256, screen:6.78,battery:6000, camera:'108+8MP',     os:'Android 14'}, credit_monthly:1730},
{id:'tc_pova5p',  name:'Tecno Pova 5 Pro 256GB',    brand:'Tecno', segment:'entry', price_official:29000,  price_caba:35000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.78,battery:6000, camera:'50+2MP',      os:'Android 13'}, credit_monthly:1325},
{id:'tc_sp30p',   name:'Tecno Spark 30 Pro 256GB',  brand:'Tecno', segment:'entry', price_official:28500,  price_caba:35000,  trend:'up',   specs:{ram:8,  storage:256, screen:6.78,battery:5000, camera:'50+2MP',      os:'Android 14'}, credit_monthly:1300},
{id:'tc_sp20',    name:'Tecno Spark 20 128GB',      brand:'Tecno', segment:'entry', price_official:19500,  price_caba:24000,  trend:'flat', specs:{ram:8,  storage:128, screen:6.56,battery:5000, camera:'48+2MP',      os:'Android 13'}, credit_monthly:890},
{id:'tc_c30',     name:'Tecno Camon 30 256GB',      brand:'Tecno', segment:'entry', price_official:32000,  price_caba:39000,  trend:'up',   specs:{ram:8,  storage:256, screen:6.78,battery:5000, camera:'108+8MP',     os:'Android 14'}, credit_monthly:1460},
{id:'tc_c20',     name:'Tecno Camon 20 256GB',      brand:'Tecno', segment:'entry', price_official:26000,  price_caba:32000,  trend:'flat', specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'64+2MP',      os:'Android 13'}, credit_monthly:1190},

// ══════════════════════════════════════════════════════
// INFINIX
// ══════════════════════════════════════════════════════
{id:'ix_hot40p',  name:'Infinix Hot 40 Pro 256GB',  brand:'Infinix', segment:'entry', price_official:22000, price_caba:27000, trend:'up',   specs:{ram:8,  storage:256, screen:6.78,battery:5000, camera:'108+2MP',   os:'Android 14'}, credit_monthly:1000},
{id:'ix_hot40',   name:'Infinix Hot 40 128GB',      brand:'Infinix', segment:'entry', price_official:18500, price_caba:22500, trend:'flat', specs:{ram:8,  storage:128, screen:6.78,battery:5000, camera:'108MP',     os:'Android 13'}, credit_monthly:845},
{id:'ix_note30',  name:'Infinix Note 30 Pro 256GB', brand:'Infinix', segment:'entry', price_official:32000, price_caba:39000, trend:'flat', specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'108+2MP',   os:'Android 13'}, credit_monthly:1460},
{id:'ix_note12',  name:'Infinix Note 12 G96 128GB', brand:'Infinix', segment:'entry', price_official:24000, price_caba:29000, trend:'down', specs:{ram:6,  storage:128, screen:6.7, battery:5000, camera:'50+2MP',    os:'Android 12'}, credit_monthly:1100},
{id:'ix_zero30',  name:'Infinix Zero 30 5G 256GB',  brand:'Infinix', segment:'mid',   price_official:42000, price_caba:51000, trend:'up',   specs:{ram:8,  storage:256, screen:6.78,battery:5000, camera:'108+2MP',   os:'Android 13'}, credit_monthly:1920},
{id:'ix_gt10p',   name:'Infinix GT 10 Pro 256GB',   brand:'Infinix', segment:'mid',   price_official:38000, price_caba:46000, trend:'up',   specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'108+2MP',   os:'Android 13'}, credit_monthly:1730},

// ══════════════════════════════════════════════════════
// REALME
// ══════════════════════════════════════════════════════
{id:'rm_c67',     name:'Realme C67 128GB',          brand:'Realme', segment:'entry', price_official:21000, price_caba:25500, trend:'flat', specs:{ram:6,  storage:128, screen:6.72,battery:5000, camera:'108+2MP',   os:'Android 13'}, credit_monthly:960},
{id:'rm_c53',     name:'Realme C53 128GB',          brand:'Realme', segment:'entry', price_official:17000, price_caba:21000, trend:'flat', specs:{ram:6,  storage:128, screen:6.74,battery:5000, camera:'50+0.3MP',  os:'Android 13'}, credit_monthly:775},
{id:'rm_11',      name:'Realme 11 256GB',           brand:'Realme', segment:'mid',   price_official:35000, price_caba:43000, trend:'flat', specs:{ram:8,  storage:256, screen:6.4, battery:5000, camera:'108+2MP',   os:'Android 13'}, credit_monthly:1600},
{id:'rm_11p',     name:'Realme 11 Pro+ 256GB',      brand:'Realme', segment:'mid',   price_official:52000, price_caba:63000, trend:'flat', specs:{ram:12, storage:256, screen:6.7, battery:5000, camera:'200+8+2MP', os:'Android 13'}, credit_monthly:2375},
{id:'rm_gt5p',    name:'Realme GT5 Pro 256GB',      brand:'Realme', segment:'mid',   price_official:68000, price_caba:83000, trend:'up',   specs:{ram:12, storage:256, screen:6.78,battery:5400, camera:'50+50+8MP', os:'Android 14'}, credit_monthly:3105},
{id:'rm_narzo60', name:'Realme Narzo 60 Pro 256GB', brand:'Realme', segment:'entry', price_official:29000, price_caba:35000, trend:'flat', specs:{ram:8,  storage:256, screen:6.67,battery:5000, camera:'100+2MP',   os:'Android 13'}, credit_monthly:1325},

// ══════════════════════════════════════════════════════
// VIVO
// ══════════════════════════════════════════════════════
{id:'vv_v30',     name:'Vivo V30 5G 256GB',         brand:'Vivo', segment:'mid',   price_official:62000, price_caba:75500, trend:'up',   specs:{ram:12, storage:256, screen:6.78,battery:5000, camera:'50+50+8MP',  os:'Android 14'}, credit_monthly:2830},
{id:'vv_x100',    name:'Vivo X100 Pro 256GB',       brand:'Vivo', segment:'high',  price_official:185000,price_caba:226000,trend:'up',   specs:{ram:12, storage:256, screen:6.78,battery:5400, camera:'50+50+64MP', os:'Android 14'}, credit_monthly:8460},
{id:'vv_y78p',    name:'Vivo Y78+ 256GB',           brand:'Vivo', segment:'mid',   price_official:42000, price_caba:51000, trend:'flat', specs:{ram:12, storage:256, screen:6.78,battery:5000, camera:'64+2MP',     os:'Android 13'}, credit_monthly:1920},
{id:'vv_y36',     name:'Vivo Y36 5G 128GB',         brand:'Vivo', segment:'entry', price_official:26000, price_caba:32000, trend:'flat', specs:{ram:8,  storage:128, screen:6.64,battery:5000, camera:'50+2MP',     os:'Android 13'}, credit_monthly:1190},
{id:'vv_y17s',    name:'Vivo Y17s 128GB',           brand:'Vivo', segment:'entry', price_official:17000, price_caba:21000, trend:'flat', specs:{ram:4,  storage:128, screen:6.56,battery:5000, camera:'13+0.08MP',  os:'Android 13'}, credit_monthly:775},

// ══════════════════════════════════════════════════════
// NOKIA
// ══════════════════════════════════════════════════════
{id:'nk_g60',     name:'Nokia G60 5G 128GB',        brand:'Nokia', segment:'entry', price_official:28000, price_caba:34000, trend:'flat', specs:{ram:6,  storage:128, screen:6.58,battery:4500, camera:'50+5+2MP',  os:'Android 12'}, credit_monthly:1280},
{id:'nk_g42',     name:'Nokia G42 5G 128GB',        brand:'Nokia', segment:'entry', price_official:24000, price_caba:29000, trend:'flat', specs:{ram:6,  storage:128, screen:6.56,battery:4150, camera:'50+2+2MP',  os:'Android 13'}, credit_monthly:1100},
{id:'nk_c32',     name:'Nokia C32 64GB',            brand:'Nokia', segment:'entry', price_official:14500, price_caba:18000, trend:'flat', specs:{ram:2,  storage:64,  screen:6.52,battery:4200, camera:'13+2MP',    os:'Android 13'}, credit_monthly:660},

// ══════════════════════════════════════════════════════
// ITEL
// ══════════════════════════════════════════════════════
{id:'it_a70',     name:'Itel A70 64GB',             brand:'Itel', segment:'entry',  price_official:8500,  price_caba:10500, trend:'flat', specs:{ram:3,  storage:64,  screen:6.6, battery:5000, camera:'8MP',       os:'Android 13'}, credit_monthly:390},
{id:'it_p40',     name:'Itel P40 64GB',             brand:'Itel', segment:'entry',  price_official:10000, price_caba:12500, trend:'flat', specs:{ram:3,  storage:64,  screen:6.6, battery:6000, camera:'13MP',      os:'Android 12'}, credit_monthly:455},
{id:'it_s24',     name:'Itel S24 128GB',            brand:'Itel', segment:'entry',  price_official:13000, price_caba:16000, trend:'flat', specs:{ram:4,  storage:128, screen:6.6, battery:5000, camera:'50+0.3MP',  os:'Android 13'}, credit_monthly:595},

];
