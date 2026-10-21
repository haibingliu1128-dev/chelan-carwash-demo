"""澈蓝洗车工坊 · 示例服务配图（程序绘制）。用法：python scripts/gen_seed_images.py（需要 playwright + Chrome）"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from seedimg import *
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'seed-images'

def car(c='#3E86FF', suv=False):
    roof = 'M150 120 L210 40 H380 L450 120 Z' if not suv else 'M140 120 L170 30 H420 L470 120 Z'
    return (f'<ellipse cx="300" cy="235" rx="270" ry="16" fill="#000" opacity=".12"/>'
            f'<path d="M40 200 Q40 130 120 120 L480 115 Q560 120 565 180 L565 205 Q565 215 555 215 H50 Q40 215 40 205Z" fill="{c}"/>'
            f'<path d="{roof}" fill="{c}"/><path d="{"M175 112 L222 52 H290 V112Z" if not suv else "M168 112 L188 44 H290 V112Z"}" fill="#CFE6FF"/><path d="{"M305 112 V52 H372 L425 112Z" if not suv else "M305 112 V44 H410 L445 112Z"}" fill="#CFE6FF"/>'
            f'<rect x="470" y="140" width="60" height="14" rx="7" fill="#FFE8A3"/><rect x="48" y="150" width="34" height="12" rx="6" fill="#FF9A8B"/>'
            f'<circle cx="150" cy="215" r="44" fill="#2B2F38"/><circle cx="150" cy="215" r="20" fill="#C9D2DE"/><circle cx="450" cy="215" r="44" fill="#2B2F38"/><circle cx="450" cy="215" r="20" fill="#C9D2DE"/>'
            f'<path d="M80 165 H520" stroke="#fff" stroke-width="6" opacity=".35" stroke-linecap="round"/>')
def drops(pts, c='#5BB8FF'):
    return ''.join(f'<path transform="translate({x} {y}) scale({s})" d="M0 -20 C 8 -8 12 -2 12 6 A12 12 0 0 1 -12 6 C -12 -2 -8 -8 0 -20Z" fill="{c}" opacity=".85"/>' for x, y, s in pts)
def foam(pts):
    return ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff"/>' for x, y, r in pts)
SEAT = ('<path d="M-60 -200 Q-80 -60 -60 40 H60 Q80 -60 60 -200 Q0 -230 -60 -200Z" fill="#7255E0"/><rect x="-90" y="30" width="200" height="70" rx="26" fill="#8D74F0"/>'
        '<rect x="-34" y="-260" width="68" height="60" rx="22" fill="#7255E0"/><path d="M-40 -150 Q0 -165 40 -150 M-44 -90 Q0 -105 44 -90" stroke="#fff" stroke-width="8" opacity=".35" fill="none" stroke-linecap="round"/>')
VAC = '<rect x="-14" y="-160" width="28" height="200" rx="14" fill="#5B6270"/><path d="M-60 40 H60 L44 80 H-44Z" fill="#3A3F4B"/><rect x="-30" y="-200" width="60" height="50" rx="16" fill="#E39B17"/>'
IMGS = {}
IMGS['c1_basic'] = bg('#E6EFFF', '#F5F9FF', '#1E6BFF') + g(car('#3E86FF'), 150, 300, 1.3) + foam([(400, 330, 40), (480, 312, 50), (570, 325, 42), (660, 310, 52), (750, 328, 40)]) + \
    drops([(300, 220, 2.2), (420, 180, 1.6), (560, 210, 2.4), (700, 170, 1.8), (820, 230, 2.0)]) + bubbles([(220, 220, 26), (900, 280, 32), (870, 420, 16)]) + label('普洗 · 示例插画')
IMGS['c2_fine'] = bg('#E0F7FB', '#F3FCFE', '#0FA7C4') + g(car('#0FA7C4', True), 150, 300, 1.3) + drops([(260, 230, 2), (380, 190, 2.6), (520, 170, 1.8), (680, 200, 2.4), (820, 240, 1.6)], '#7FD6E8') + \
    ''.join(sparkle(x, y, s) for x, y, s in [(330, 420, 3), (720, 400, 2.6), (880, 220, 2.2)]) + label('精洗 · 示例插画')
IMGS['c3_wax'] = bg('#FFF3DD', '#FFFAF0', '#E39B17') + g(car('#E39B17'), 150, 300, 1.3) + \
    ''.join(sparkle(x, y, s, '#fff', .95) for x, y, s in [(360, 420, 4), (560, 400, 3), (760, 430, 3.6), (880, 250, 2.6), (220, 240, 2.2)]) + \
    '<path d="M330 380 q100 -50 200 0" stroke="#fff" stroke-width="10" fill="none" opacity=".6" stroke-linecap="round"/>' + label('打蜡 · 示例插画')
IMGS['c4_interior'] = bg('#EEE9FF', '#F9F7FF', '#7255E0') + '<circle cx="520" cy="420" r="250" fill="#fff" opacity=".7"/>' + g(SEAT, 470, 470, 1.15) + g(VAC, 780, 470, 1.1, 18) + \
    ''.join(sparkle(x, y, s, '#7255E0', .45) for x, y, s in [(240, 220, 3), (300, 560, 2.2), (880, 220, 2.6)]) + label('内饰清洁 · 示例插画')
render(OUT, IMGS)
