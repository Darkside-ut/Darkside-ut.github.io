// 一次性构建脚本：把 DataV 全国 GeoJSON 转成旅迹组件用的紧凑 SVG path 数据
// 运行：node scripts/build-china-map.mjs
// 产出：src/views/lvji/mapData.js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const TMP = process.env.TEMP || '/tmp'

const DATA_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound'

// ---------- 工具 ----------
function fetchJSON(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`)
    return r.json()
  })
}

// 轻量 Douglas-Peucker 抽稀
function simplify(points, tol) {
  if (points.length <= 2) return points
  const [first, last] = [points[0], points[points.length - 1]]
  let maxD = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last)
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > tol) {
    const left = simplify(points.slice(0, idx + 1), tol)
    const right = simplify(points.slice(idx), tol)
    return left.slice(0, -1).concat(right)
  }
  return [first, last]
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
  const cx = a[0] + t * dx
  const cy = a[1] + t * dy
  return Math.hypot(p[0] - cx, p[1] - cy)
}

// 等距圆柱投影（按中线纬度修正横向比例），把经纬度转成视图坐标
function makeProjector(bbox, W, H, pad = 10) {
  const midLat = ((bbox[1] + bbox[3]) / 2) * (Math.PI / 180)
  const cosMid = Math.cos(midLat)
  const lonSpan = (bbox[2] - bbox[0]) * cosMid
  const latSpan = bbox[3] - bbox[1]
  const scale = Math.min((W - pad * 2) / lonSpan, (H - pad * 2) / latSpan)
  const w = lonSpan * scale
  const h = latSpan * scale
  const ox = (W - w) / 2
  const oy = (H - h) / 2
  return ([lon, lat]) => [
    ox + (lon - bbox[0]) * cosMid * scale,
    oy + (bbox[3] - lat) * scale,
  ]
}

// 单个环转 SVG 子路径字符串
function ringToPath(ring, proj, tol) {
  let pts = ring.map((c) => proj(c))
  pts = simplify(pts, tol)
  if (pts.length < 3) return ''
  let s = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    s += 'L' + fmt(pts[i][0]) + ' ' + fmt(pts[i][1])
  }
  return s + 'Z'
}

const fmt = (n) => Math.round(n * 10) / 10

function geometryToPath(geometry, proj, tol) {
  const parts = []
  const walk = (polygons) => {
    for (const poly of polygons) {
      for (const ring of poly) {
        const p = ringToPath(ring, proj, tol)
        if (p) parts.push(p)
      }
    }
  }
  if (geometry.type === 'Polygon') walk([geometry.coordinates])
  else if (geometry.type === 'MultiPolygon') walk(geometry.coordinates)
  return parts.join(' ')
}

function bboxOf(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of features) {
    const g = f.geometry
    const walk = (polygons) => {
      for (const poly of polygons)
        for (const ring of poly)
          for (const [lon, lat] of ring) {
            if (lon < minX) minX = lon
            if (lon > maxX) maxX = lon
            if (lat < minY) minY = lat
            if (lat > maxY) maxY = lat
          }
    }
    if (g.type === 'Polygon') walk([g.coordinates])
    else if (g.type === 'MultiPolygon') walk(g.coordinates)
  }
  return [minX, minY, maxX, maxY]
}

// ---------- 主流程 ----------
const provinceFull = await fetchJSON(`${DATA_BASE}/100000_full.json`)
const provinces = provinceFull.features.filter((f) => f.properties.level === 'province')

// 全国投影（所有省共用一套坐标系，拼成完整中国地图）
const chinaBBox = bboxOf(provinces)
const CHINA_W = 800
const CHINA_H = 700
const chinaProj = makeProjector(chinaBBox, CHINA_W, CHINA_H, 16)

const provincesOut = []
const citiesByProvince = {}
let cityCount = 0

for (const prov of provinces) {
  const adcode = prov.properties.adcode
  const name = prov.properties.name
  const d = geometryToPath(prov.geometry, chinaProj, 1.0)
  const center = chinaProj(prov.properties.centroid || prov.properties.center)

  // 拉取该省市区数据
  let cities = []
  let cityProj = null
  let cityBBox = null
  try {
    const cityFC = await fetchJSON(`${DATA_BASE}/${adcode}_full.json`)
    cities = cityFC.features.filter((f) =>
      f.properties.level === 'city' || f.properties.level === 'district'
    )
    // 海南特殊处理：去掉三沙市（含南沙/中沙群岛），主岛放大 1.3 倍
    if (adcode === 460000) {
      cities = cities.filter((c) => Number(c.properties.adcode) !== 460300)
    }
    if (cities.length) {
      cityBBox = bboxOf(cities)
      if (adcode === 460000) {
        const [x0, y0, x1, y1] = cityBBox
        const cx = (x0 + x1) / 2
        const cy = (y0 + y1) / 2
        const zoom = 1 / 1.3
        cityBBox = [
          cx - (x1 - x0) / 2 * zoom,
          cy - (y1 - y0) / 2 * zoom,
          cx + (x1 - x0) / 2 * zoom,
          cy + (y1 - y0) / 2 * zoom,
        ]
      }
      // 每个省自己的视图框，保持比例
      const cw = 800
      const ch = 620
      cityProj = makeProjector(cityBBox, cw, ch, 20)
    }
  } catch (e) {
    console.error('  !! 拉取市区失败', adcode, name, e.message)
  }

  const cityList = cities.map((c) => {
    const cc = c.properties.centroid || c.properties.center
    if (!cc) return null
    return {
      adcode: c.properties.adcode,
      name: c.properties.name,
      d: cityProj ? geometryToPath(c.geometry, cityProj, 0.8) : '',
      centroid: cityProj ? cityProj(cc) : null,
    }
  }).filter(Boolean)

  citiesByProvince[adcode] = {
    viewBox: cityProj ? `0 0 800 620` : null,
    bbox: cityBBox, // 原始经纬度范围，用于运行时投影景点坐标
    cities: cityList,
  }
  cityCount += cityList.length

  provincesOut.push({
    adcode,
    name,
    d,
    center: [Math.round(center[0]), Math.round(center[1])],
  })

  console.log(`  ${adcode} ${name}: ${cityList.length} 市区`)
}

console.log(`\n省份 ${provincesOut.length}，市区 ${cityCount}`)

// ---------- 写出 JS 模块 ----------
const outDir = path.join(ROOT, 'src', 'views', 'lvji')
fs.mkdirSync(outDir, { recursive: true })

const header = `// 本文件由 scripts/build-china-map.mjs 生成，请勿手改
// 数据来源：阿里云 DataV GeoJSON（全国 34 省级 / ${cityCount} 市级）
export const chinaViewBox = '0 0 ${CHINA_W} ${CHINA_H}'

export const provinces = ${JSON.stringify(provincesOut)}

export const cityMaps = ${JSON.stringify(citiesByProvince)}
`

fs.writeFileSync(path.join(outDir, 'mapData.js'), header, 'utf8')
const size = fs.statSync(path.join(outDir, 'mapData.js')).size
console.log(`\n已写出 mapData.js（${(size / 1024).toFixed(1)} KB）`)
