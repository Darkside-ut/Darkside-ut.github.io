// 把 Relax 的软件图标缩放到网页用尺寸（纯 Node，无第三方依赖）
// 用法：node scripts/resize-icon.mjs <源 png> <目标 png> <边长>
import fs from 'node:fs'
import zlib from 'node:zlib'

const [src, dst, sizeArg] = process.argv.slice(2)
if (!src || !dst) {
  console.error('用法: node scripts/resize-icon.mjs <源.png> <目标.png> [边长=128]')
  process.exit(1)
}
const SIZE = Number(sizeArg) || 128

// ---------- PNG 解码 ----------
const buf = fs.readFileSync(src)
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG')

let pos = 8
let width = 0
let height = 0
let bitDepth = 0
let colorType = 0
const idat = []

while (pos < buf.length) {
  const len = buf.readUInt32BE(pos)
  const type = buf.toString('ascii', pos + 4, pos + 8)
  const data = buf.subarray(pos + 8, pos + 8 + len)
  if (type === 'IHDR') {
    width = data.readUInt32BE(0)
    height = data.readUInt32BE(4)
    bitDepth = data[8]
    colorType = data[9]
    if (data[12] !== 0) throw new Error('不支持隔行扫描 PNG')
    if (bitDepth !== 8) throw new Error('仅支持 8 位 PNG')
  } else if (type === 'IDAT') {
    idat.push(data)
  } else if (type === 'IEND') {
    break
  }
  pos += 12 + len
}

const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]
if (!channels) throw new Error('不支持的颜色类型 ' + colorType)
if (colorType === 3) throw new Error('不支持调色板 PNG')

const raw = zlib.inflateSync(Buffer.concat(idat))
const bpp = channels
const stride = width * bpp
const pixels = Buffer.alloc(height * stride)

// 反滤波
let rp = 0
for (let y = 0; y < height; y++) {
  const filter = raw[rp++]
  const row = raw.subarray(rp, rp + stride)
  rp += stride
  const out = y * stride
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? pixels[out + x - bpp] : 0
    const b = y > 0 ? pixels[out - stride + x] : 0
    const c = x >= bpp && y > 0 ? pixels[out - stride + x - bpp] : 0
    let v = row[x]
    switch (filter) {
      case 0: break
      case 1: v += a; break
      case 2: v += b; break
      case 3: v += (a + b) >> 1; break
      case 4: {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        break
      }
      default: throw new Error('未知滤波类型 ' + filter)
    }
    pixels[out + x] = v & 0xff
  }
}

// 转预乘 alpha 的浮点 RGBA（预乘可避免缩小后边缘发黑）
const srcRGBA = new Float32Array(width * height * 4)
for (let i = 0, p = 0; i < width * height; i++, p += bpp) {
  let r, g, b, a
  if (channels === 4) { r = pixels[p]; g = pixels[p + 1]; b = pixels[p + 2]; a = pixels[p + 3] }
  else if (channels === 3) { r = pixels[p]; g = pixels[p + 1]; b = pixels[p + 2]; a = 255 }
  else if (channels === 2) { r = g = b = pixels[p]; a = pixels[p + 1] }
  else { r = g = b = pixels[p]; a = 255 }
  const af = a / 255
  srcRGBA[i * 4] = r * af
  srcRGBA[i * 4 + 1] = g * af
  srcRGBA[i * 4 + 2] = b * af
  srcRGBA[i * 4 + 3] = a
}

// ---------- 面积平均缩小（两趟可分离） ----------
function boxResize(input, sw, sh, dw, dh) {
  // 横向
  const mid = new Float32Array(dw * sh * 4)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      const x0 = (x * sw) / dw
      const x1 = ((x + 1) * sw) / dw
      let r = 0, g = 0, b = 0, a = 0, wsum = 0
      for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
        const w = Math.min(sx + 1, x1) - Math.max(sx, x0)
        if (w <= 0) continue
        const p = (y * sw + sx) * 4
        r += input[p] * w; g += input[p + 1] * w; b += input[p + 2] * w; a += input[p + 3] * w
        wsum += w
      }
      const q = (y * dw + x) * 4
      mid[q] = r / wsum; mid[q + 1] = g / wsum; mid[q + 2] = b / wsum; mid[q + 3] = a / wsum
    }
  }
  // 纵向
  const out = new Float32Array(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const y0 = (y * sh) / dh
    const y1 = ((y + 1) * sh) / dh
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const w = Math.min(sy + 1, y1) - Math.max(sy, y0)
        if (w <= 0) continue
        const p = (sy * dw + x) * 4
        r += mid[p] * w; g += mid[p + 1] * w; b += mid[p + 2] * w; a += mid[p + 3] * w
        wsum += w
      }
      const q = (y * dw + x) * 4
      out[q] = r / wsum; out[q + 1] = g / wsum; out[q + 2] = b / wsum; out[q + 3] = a / wsum
    }
  }
  return out
}

const small = boxResize(srcRGBA, width, height, SIZE, SIZE)

// ---------- PNG 编码 ----------
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8   // bit depth
ihdr[9] = 6   // RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const rawOut = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  rawOut[y * (SIZE * 4 + 1)] = 0 // filter none
  for (let x = 0; x < SIZE; x++) {
    const p = (y * SIZE + x) * 4
    const a = small[p + 3]
    const af = a > 0 ? a / 255 : 0
    const o = y * (SIZE * 4 + 1) + 1 + x * 4
    rawOut[o] = af > 0 ? Math.min(255, Math.round(small[p] / af)) : 0
    rawOut[o + 1] = af > 0 ? Math.min(255, Math.round(small[p + 1] / af)) : 0
    rawOut[o + 2] = af > 0 ? Math.min(255, Math.round(small[p + 2] / af)) : 0
    rawOut[o + 3] = Math.round(a)
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rawOut, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

fs.writeFileSync(dst, png)
console.log(`已写出 ${dst}（${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KB）`)
