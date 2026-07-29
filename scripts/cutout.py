#!/usr/bin/env python3
"""抠图脚本：把立绘的深色背景变为透明。

策略：
1. 从图像四条边界开始 flood fill
2. 颜色距离小于阈值的连通像素标记为背景
3. 边缘像素按距离做羽化（部分透明），避免锯齿
"""
import sys
from collections import deque
from PIL import Image
import numpy as np

THRESH = 48      # 颜色距离阈值：小于此值视为背景
FEATHER = 28     # 羽化范围：阈值+feather 内的像素部分透明

def color_dist(a, b):
    """RGB 欧氏距离"""
    return np.sqrt(np.sum((a.astype(float) - b.astype(float)) ** 2, axis=-1))

def cutout(path):
    img = Image.open(path).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]
    alpha = np.full((h, w), 255, dtype=np.uint8)

    # 取边界像素中最暗 30% 的 RGB 中位数作为背景色
    # （角色通常比背景亮，这样能排除角色像素的污染）
    border_pixels = np.concatenate([
        rgb[0, :, :],      # 顶边
        rgb[h-1, :, :],    # 底边
        rgb[:, 0, :],      # 左边
        rgb[:, w-1, :],    # 右边
    ], axis=0)
    lum = border_pixels.mean(axis=1)
    dark_mask = lum < np.percentile(lum, 30)
    dark_pixels = border_pixels[dark_mask]
    bg = np.median(dark_pixels, axis=0)

    # BFS flood fill：从边界开始，跟"来源像素"比较颜色差异（处理渐变背景）
    # 种子点 = 距全局背景色 < THRESH 的边界像素
    visited = np.zeros((h, w), dtype=bool)
    bg_dist = np.sqrt(np.sum((rgb.astype(float) - bg) ** 2, axis=-1))
    queue = deque()
    # 初始种子：边界上距背景色足够近的像素
    bg_ref = bg.astype(float).copy()
    for x in range(w):
        for y in [0, h-1]:
            if bg_dist[y, x] < THRESH:
                queue.append((y, x, bg_ref))  # 携带参考色
    for y in range(h):
        for x in [0, w-1]:
            if bg_dist[y, x] < THRESH:
                queue.append((y, x, bg_ref))

    while queue:
        y, x, ref = queue.popleft()
        if visited[y, x]:
            continue
        visited[y, x] = True
        # 跟参考色比较（局部自适应，处理渐变背景）
        d = np.sqrt(np.sum((rgb[y, x].astype(float) - ref) ** 2))
        if d > THRESH + FEATHER:
            continue  # 不是背景，停止蔓延
        # 在阈值内 → 完全透明；在羽化范围 → 部分透明
        if d <= THRESH:
            alpha[y, x] = 0
            # 更新参考色为当前像素（渐变背景跟踪）
            ref = rgb[y, x].astype(float)
        else:
            alpha[y, x] = int((d - THRESH) / FEATHER * 255)
        # 继续蔓延到 4 邻域
        for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                queue.append((ny, nx, ref))

    arr[:, :, 3] = alpha
    out = Image.fromarray(arr)
    out.save(path)
    # 统计透明率
    transparent = np.sum(alpha == 0)
    total = h * w
    print(f'{path}: bg={bg.astype(int).tolist()} 透明率={transparent/total*100:.1f}%')

if __name__ == '__main__':
    files = sys.argv[1:] if len(sys.argv) > 1 else [
        'public/portraits/linn.png',
        'public/portraits/zero.png',
        'public/portraits/lily.png',
        'public/portraits/vera.png',
        'public/portraits/boss_skull.png',
        'public/portraits/boss_ghost.png',
        'public/portraits/boss_chameleon.png',
    ]
    for f in files:
        cutout(f)
