import MarkdownIt from 'markdown-it'
// 只引入 highlight.js 核心 + 常用语言（全量会打包约 200 种语言，多出近 1MB）。
// 未注册的语言会降级为普通代码块（不高亮、不报错）；需要新语言时在下面补 import + registerLanguage 即可。
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import java from 'highlight.js/lib/languages/java'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c++', cpp)
hljs.registerLanguage('java', java)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
import matter from 'gray-matter'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// 读取 src/posts/ 下的所有 .md 文件（构建时同步收集）
const files = import.meta.glob('../posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// markdown 渲染器
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        )
      } catch (e) {
        // 高亮失败就退回转义输出
      }
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
  },
})

// ===== 数学公式：$...$ 行内，$$...$$ 块级（直接调最新 katex，不用老旧的 markdown-it-katex） =====

// 判断 $ 是否能作为公式定界符（避免和金额等普通 $ 冲突）
function isValidDelim(state, pos) {
  const max = state.posMax
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1
  const nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1
  let can_open = true
  let can_close = true
  if (prevChar === 0x20 /* 空格 */ || prevChar === 0x09 /* 制表符 */ || (nextChar >= 0x30 && nextChar <= 0x39)) {
    can_close = false
  }
  if (nextChar === 0x20 || nextChar === 0x09) {
    can_open = false
  }
  return { can_open, can_close }
}

// 行内公式：$...$
function math_inline(state, silent) {
  if (state.src[state.pos] !== '$') return false

  let res = isValidDelim(state, state.pos)
  if (!res.can_open) {
    if (!silent) state.pending += '$'
    state.pos += 1
    return true
  }

  const start = state.pos + 1
  let match = start
  while ((match = state.src.indexOf('$', match)) !== -1) {
    let pos = match - 1
    while (state.src[pos] === '\\') pos -= 1
    if ((match - pos) % 2 === 1) break
    match += 1
  }

  if (match === -1 || match - start === 0) {
    if (!silent) state.pending += '$$'.slice(0, match - start === 0 ? 2 : 1)
    state.pos = match === -1 ? start : start + 1
    return true
  }

  res = isValidDelim(state, match)
  if (!res.can_close) {
    if (!silent) state.pending += '$'
    state.pos = start
    return true
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.markup = '$'
    token.content = state.src.slice(start, match)
  }
  state.pos = match + 1
  return true
}

// 块级公式：$$...$$
function math_block(state, start, end, silent) {
  let pos = state.bMarks[start] + state.tShift[start]
  const max = state.eMarks[start]
  if (pos + 2 > max) return false
  if (state.src.slice(pos, pos + 2) !== '$$') return false

  pos += 2
  let firstLine = state.src.slice(pos, max)
  if (silent) return true

  let found = false
  let lastLine = ''
  let next
  if (firstLine.trim().slice(-2) === '$$') {
    firstLine = firstLine.trim().slice(0, -2)
    found = true
  }
  for (next = start; !found; ) {
    next++
    if (next >= end) break
    pos = state.bMarks[next] + state.tShift[next]
    const maxNext = state.eMarks[next]
    if (pos < maxNext && state.tShift[next] < state.blkIndent) break
    if (state.src.slice(pos, maxNext).trim().slice(-2) === '$$') {
      const lastPos = state.src.slice(0, maxNext).lastIndexOf('$$')
      lastLine = state.src.slice(pos, lastPos)
      found = true
    }
  }

  state.line = next + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content =
    (firstLine && firstLine.trim() ? firstLine + '\n' : '') +
    state.getLines(start + 1, next, state.tShift[start], true) +
    (lastLine && lastLine.trim() ? lastLine : '')
  token.map = [start, state.line]
  token.markup = '$$'
  return true
}

// 渲染：用最新 katex，纯 HTML 输出（不掺 MathML），报错时兜底显示而非抛异常
function renderMath(latex, displayMode) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'html',
      strict: false,
    })
  } catch (e) {
    return `<span class="katex-error">${md.utils.escapeHtml(latex)}</span>`
  }
}

md.inline.ruler.after('escape', 'math_inline', math_inline)
md.block.ruler.after('blockquote', 'math_block', math_block, {
  alt: ['paragraph', 'reference', 'blockquote', 'list'],
})
md.renderer.rules.math_inline = (tokens, idx) => renderMath(tokens[idx].content, false)
md.renderer.rules.math_block = (tokens, idx) => renderMath(tokens[idx].content, true)

// 收集标题，生成目录（slug 用递增序号，避免中文/重复问题）
const defaultHeadingOpen =
  md.renderer.rules.heading_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const level = Number(tokens[idx].tag.slice(1))
  const inline = tokens[idx + 1]
  const text = inline
    ? (inline.children || [])
        .filter(
          (c) =>
            c.type === 'text' ||
            c.type === 'code_inline' ||
            c.type === 'math_inline'
        )
        .map((c) => c.content || '')
        .join('')
    : ''
  const slug = 'heading-' + (env.toc.length + 1)
  env.toc.push({ level, text, slug })
  tokens[idx].attrSet('id', slug)
  return defaultHeadingOpen(tokens, idx, options, env, self)
}

// mermaid 代码块：输出 .mermaid 占位节点，稍后由组件用 mermaid 库渲染成图
const defaultFence =
  md.renderer.rules.fence ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = token.info.trim().split(/\s+/)[0]
  if (lang === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`
  }
  return defaultFence(tokens, idx, options, env, self)
}

// 解析所有文章
const posts = Object.entries(files)
  .map(([path, raw]) => {
    const { data, content } = matter(raw)
    const slug = path.split('/').pop().replace(/\.md$/, '')
    // gray-matter 会把 date 解析成 Date 对象，这里统一转回 YYYY-MM-DD 字符串
    if (data.date instanceof Date) {
      const y = data.date.getFullYear()
      const m = String(data.date.getMonth() + 1).padStart(2, '0')
      const d = String(data.date.getDate()).padStart(2, '0')
      data.date = `${y}-${m}-${d}`
    }
    return { slug, ...data, content }
  })
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

// 所有标签（去重）
const allTags = [...new Set(posts.flatMap((p) => p.tags || []))]

export function getPosts() {
  return posts
}

export function getAllTags() {
  return allTags
}

export function getPost(slug) {
  return posts.find((p) => p.slug === slug)
}

// 渲染 markdown，返回 { html, toc }
export function renderMarkdown(content) {
  const env = { toc: [] }
  const html = md.render(content, env)
  return { html, toc: env.toc }
}
