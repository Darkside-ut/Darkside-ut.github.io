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
// 拿到构建后的 CSS 文件 URL，供打印窗口用 <link> 引用，从而正确加载 KaTeX 字体
import katexCssUrl from 'katex/dist/katex.min.css?url'
import hljsCssUrl from 'highlight.js/styles/github.css?url'

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

// 去掉 LaTeX 颜色命令（\color / \textcolor / \colorbox / \fcolorbox），仅用于目录文本转换。
// 目录里公式只显示纯文本符号、不需要颜色；正文公式仍保留颜色。例如 \color{red}{x} → x。
function stripColor(latex) {
  return latex
    .replace(/\\fcolorbox\{[^{}]*\}\{[^{}]*\}\{/g, '{')
    .replace(/\\colorbox\{[^{}]*\}\{/g, '{')
    .replace(/\\textcolor\{[^{}]*\}\{/g, '{')
    .replace(/\\color\{[^{}]*\}\{/g, '{')
    .replace(/\\color\{[^{}]*\}/g, '')
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

// 把 LaTeX 转成纯文本（用于目录标题，避免显示 \Omega 这种原始命令）。
// 渲染成 HTML 后去掉所有标签和实体，得到可读的 Unicode 符号（\Omega → Ω）。
function latexToText(latex) {
  try {
    return katex
      .renderToString(stripColor(latex), {
        throwOnError: false,
        output: 'html',
        strict: false,
      })
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  } catch (e) {
    return latex
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
  // 目录文本：公式用 latexToText 转成可读符号（Ω 而非 \Omega），纯文本、无颜色
  const text = inline
    ? (inline.children || [])
        .map((c) => {
          if (c.type === 'text' || c.type === 'code_inline') return c.content || ''
          if (c.type === 'math_inline') return latexToText(c.content)
          return ''
        })
        .join('')
    : ''
  const slug = 'heading-' + (env.toc.length + 1)
  env.toc.push({ level, text, slug })
  tokens[idx].attrSet('id', slug)
  return defaultHeadingOpen(tokens, idx, options, env, self)
}

// 外链：新标签打开 + 防钓鱼（站内 # 锚点等内链不受影响）
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || ''
  if (/^https?:\/\//.test(href)) {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// ===== 伪代码块：```pseudocode / ```algorithm 渲染成带行号 + 关键字高亮的代码块 =====
// 用法：
//   ```pseudocode 算法名
//   @input 输入说明
//   @output 输出说明
//   （空一行）
//   伪代码正文……
//   （空一行）
//   @note 注解说明
//   ```
function renderPseudocode(code, title) {
  const esc = md.utils.escapeHtml
  const lines = code.split('\n')
  // 去掉结尾换行产生的空行，避免多出一个空行号
  if (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

  // 拆解元信息（@input / @output / @note）与正文
  const meta = [] // { type: 'input' | 'output', text }
  const notes = [] // 注解行
  const body = [] // 伪代码正文
  for (const raw of lines) {
    if (raw.trim() === '') continue // 空行只作分隔，不参与正文行号
    const m = raw.match(/^@(input|output|note)\s+(.*)$/)
    if (m) {
      if (m[1] === 'note') notes.push(m[2])
      else meta.push({ type: m[1], text: m[2] })
    } else {
      body.push(raw)
    }
  }

  const parts = []

  // 标题栏：算法名 + 输入 / 输出
  if (title || meta.length) {
    const head = []
    if (title) head.push(`<div class="pc-title">${esc(title)}</div>`)
    for (const m of meta) {
      const label = m.type === 'input' ? '输入' : '输出'
      head.push(
        `<div class="pc-meta"><span class="pc-meta-label">${label}：</span>${esc(m.text)}</div>`
      )
    }
    parts.push(`<div class="pc-head">${head.join('')}</div>`)
  }

  // 正文：带行号 + 关键字高亮（先转义，再插 <span>）
  const kwRe =
    /\b(if|else|elif|then|for|while|do|return|function|procedure|def|begin|end|repeat|until|foreach|switch|case|break|continue|and|or|not|true|false)\b/g
  const bodyHtml = body
    .map((line, i) => {
      const highlighted = esc(line)
        .replace(kwRe, '<span class="pc-kw">$1</span>')
        .replace(/←|→|:=/g, (m) => `<span class="pc-op">${m}</span>`)
      return `<div class="pc-line"><span class="pc-no">${i + 1}</span><code>${
        highlighted || '&nbsp;'
      }</code></div>`
    })
    .join('')
  parts.push(bodyHtml)

  // 注解
  if (notes.length) {
    const noteHtml = notes.map((n) => `<div class="pc-note-line">${esc(n)}</div>`).join('')
    parts.push(`<div class="pc-note">${noteHtml}</div>`)
  }

  return `<div class="pseudocode">${parts.join('')}</div>`
}

// ===== 折叠块：```fold 标题 ... ```，点击标题栏展开/收起 =====
// 内容递归走 markdown 渲染，所以支持公式、代码高亮、列表等
function renderFold(content, title) {
  const esc = md.utils.escapeHtml
  // 传空 toc：避免内容里出现 # 标题时 env.toc 为 undefined 导致崩溃，也不污染外层目录
  const bodyHtml = md.render(content, { toc: [] })
  return (
    '<div class="fold">' +
    '<button type="button" class="fold-head" onclick="this.parentElement.classList.toggle(\'open\')">' +
    '<span>' + esc(title || '展开') + '</span>' +
    '<span class="fold-arrow"></span>' +
    '</button>' +
    '<div class="fold-body">' +
    '<div class="fold-inner">' + bodyHtml + '</div>' +
    '</div>' +
    '</div>'
  )
}

// 普通代码块：语言标签 + 复制按钮 + 行号
function renderCodeBlock(code, lang) {
  const esc = md.utils.escapeHtml
  let highlighted
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      highlighted = esc(code)
    }
  } else {
    highlighted = esc(code)
  }
  const lines = highlighted.replace(/\n$/, '').split('\n')
  const body = lines
    .map((line) => `<span class="code-line">${line || ' '}</span>`)
    .join('')
  return (
    '<div class="code-block">' +
    '<div class="code-head">' +
    `<span class="code-lang">${esc(lang || 'text')}</span>` +
    '<button type="button" class="code-copy">复制</button>' +
    '</div>' +
    `<pre class="hljs"><code>${body}</code></pre>` +
    '</div>'
  )
}

md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const info = token.info.trim()
  const sp = info.indexOf(' ')
  const lang = sp === -1 ? info : info.slice(0, sp)
  const title = sp === -1 ? '' : info.slice(sp + 1).trim()
  if (lang === 'mermaid') {
    return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>`
  }
  if (lang === 'pseudocode' || lang === 'algorithm' || lang === 'algo') {
    return renderPseudocode(token.content, title)
  }
  if (lang === 'fold') {
    return renderFold(token.content, title)
  }
  return renderCodeBlock(token.content, lang)
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

/* ============================================================
   打印 / 导出：生成一份自包含、适合打印的 HTML 文档
   - KaTeX 与 highlight.js 的样式通过 <link> 引用构建产物，
     从而正确加载数学字体（直接内联 CSS 字符串会导致字体 url 失效）
   - 正文复用 markdown 渲染结果，折叠块强制展开，复制按钮隐藏
   ============================================================ */

const PRINT_CSS = `
  :root { --accent: #2563eb; --text-dark: #1a202c; --text-dim: #5b6b85; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
      "Noto Sans SC", "Segoe UI", Roboto, sans-serif;
    color: var(--text-dark);
    line-height: 1.8;
    background: #fff;
  }
  .print-article { max-width: 820px; margin: 0 auto; padding: 40px 28px; }

  .print-title { font-size: 27px; font-weight: 800; line-height: 1.3; margin: 0 0 10px; }
  .print-meta { font-size: 13px; color: var(--text-dim); margin-bottom: 6px; }
  .print-meta .tag {
    display: inline-block; margin-left: 6px; padding: 1px 9px;
    border: 1px solid #c7d2e4; border-radius: 20px; color: #4a5a73; font-size: 12px;
  }
  .print-meta .tag:first-of-type { margin-left: 8px; }

  /* 目录 */
  .print-toc { margin: 20px 0 26px; padding: 14px 20px; border: 1px solid #e2e8f2;
    border-radius: 10px; background: #f7f9fc; }
  .print-toc h2 { font-size: 15px; margin: 0 0 8px; color: var(--text-dark); }
  .print-toc ol { margin: 0; padding-left: 20px; }
  .print-toc li { font-size: 13px; line-height: 1.9; }
  .print-toc li.lvl-2 { padding-left: 14px; }
  .print-toc li.lvl-3 { padding-left: 28px; }
  .print-toc li.lvl-4 { padding-left: 42px; }
  .print-toc a { color: #33415c; text-decoration: none; }

  /* 正文标题 */
  .print-body h1, .print-body h2, .print-body h3, .print-body h4 {
    color: var(--text-dark); line-height: 1.3; margin: 1.5em 0 0.5em; break-after: avoid;
  }
  .print-body h2 { font-size: 21px; padding-bottom: 5px; border-bottom: 1px solid #d7deea; }
  .print-body h3 { font-size: 17px; }
  .print-body h4 { font-size: 15px; }
  .print-body p { margin: 0.7em 0; }
  .print-body a { color: var(--accent); text-decoration: none; }
  .print-body ul, .print-body ol { padding-left: 1.6em; margin: 0.7em 0; }
  .print-body blockquote { margin: 1em 0; padding: 0.4em 1em; border-left: 4px solid var(--accent);
    color: var(--text-dim); background: #f4f7fb; }
  .print-body img { max-width: 100%; border-radius: 6px; }
  .print-body hr { border: none; border-top: 1px solid #e2e8f2; margin: 1.4em 0; }

  /* 行内代码 */
  .print-body p code, .print-body li code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    font-size: 0.85em; background: #eef2f8; color: #1e40af;
    padding: 0.12em 0.4em; border-radius: 4px;
  }

  /* 代码块（renderCodeBlock） */
  .print-body .code-block { margin: 1.1em 0; border: 1px solid #dbe3f0; border-radius: 8px; overflow: hidden; }
  .print-body .code-head { display: flex; align-items: center; justify-content: space-between;
    padding: 4px 12px; background: #f0f4fa; border-bottom: 1px solid #e2e8f2; }
  .print-body .code-lang { font-family: monospace; font-size: 11px; color: var(--accent); }
  .print-body .code-copy { display: none; }
  .print-body pre.hljs { margin: 0; padding: 12px 14px; background: #f7f9fc; overflow-x: auto;
    font-size: 13px; line-height: 1.6; counter-reset: code-line; }
  .print-body pre.hljs code { background: none; padding: 0; }
  .print-body .code-line { display: block; }
  .print-body .code-line::before { counter-increment: code-line; content: counter(code-line);
    display: inline-block; width: 2em; margin-right: 1em; text-align: right; color: #a6b4ca; }

  /* 伪代码块 */
  .print-body .pseudocode { margin: 1.2em 0; border: 1px solid #d7e0ef; border-left: 4px solid var(--accent);
    border-radius: 8px; padding: 12px 16px; overflow-x: auto; }
  .print-body .pc-head { padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px dashed #cdd7e6; }
  .print-body .pc-title { font-weight: 800; font-size: 14px; margin-bottom: 4px; }
  .print-body .pc-meta { font-size: 12px; color: var(--text-dim); }
  .print-body .pc-meta-label { color: var(--accent); font-weight: 600; }
  .print-body .pc-line { display: flex; font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px; line-height: 1.7; }
  .print-body .pc-no { flex-shrink: 0; width: 2em; margin-right: 1em; text-align: right;
    color: #a6b4ca; user-select: none; }
  .print-body .pc-line code { white-space: pre-wrap; color: var(--text-dark); background: none;
    padding: 0; font-family: inherit; font-size: inherit; }
  .print-body .pc-kw { color: #7c3aed; font-weight: 700; }
  .print-body .pc-op { color: var(--accent); font-weight: 600; }
  .print-body .pc-note { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cdd7e6; }
  .print-body .pc-note-line { font-size: 12px; color: var(--text-dim); }

  /* 折叠块：打印时强制展开，标题保留为标签 */
  .print-body .fold { margin: 1em 0; border: 1px solid #d7e0ef; border-radius: 8px; width: 100%; }
  .print-body .fold-head { display: flex; align-items: center; gap: 6px; width: 100%;
    padding: 7px 14px; font-weight: 700; font-size: 14px; color: var(--text-dark);
    background: #f0f4fa; border: none; }
  .print-body .fold-arrow { display: none; }
  .print-body .fold-body { display: block !important; }
  .print-body .fold-inner { padding: 4px 14px 12px; }

  /* 表格 */
  .print-body table { border-collapse: collapse; margin: 1em 0; }
  .print-body th, .print-body td { border: 1px solid #c9d3e2; padding: 6px 12px; font-size: 13px; }
  .print-body th { background: #eef2f8; }

  /* KaTeX 块级公式 */
  .print-body .katex-display { margin: 1.1em 0; padding: 0.2em 0; text-align: center; overflow-x: auto; }

  /* Mermaid 占位（未被渲染时显示原始代码） */
  .print-body .mermaid { margin: 1.1em 0; padding: 12px; border: 1px dashed #c9d3e2; border-radius: 8px;
    background: #fafbfd; white-space: pre-wrap; font-family: monospace; font-size: 12px; color: var(--text-dim); }
  /* 已渲染的图表：居中、去掉占位框 */
  .print-body .print-mermaid { display: flex; justify-content: center; padding: 0; border: none;
    background: none; white-space: normal; break-inside: avoid; }
  .print-body .print-mermaid svg { max-width: 100%; height: auto; }

  @page { margin: 20mm 18mm; }
`

function absUrl(u) {
  if (typeof window === 'undefined') return u
  try {
    return new URL(u, window.location.href).href
  } catch {
    return u
  }
}

// 生成一份适合打印 / 另存为 PDF 的完整 HTML 文档字符串
// mermaidHtml：页面里已渲染好的图表 HTML（SVG），按出现顺序替换掉原始代码占位
export function renderPrintableHtml(post, mermaidHtml = []) {
  const { html, toc } = renderMarkdown(post.content)
  let body = html
  if (mermaidHtml.length) {
    let i = 0
    body = body.replace(/<div class="mermaid">[\s\S]*?<\/div>/g, (m) =>
      i < mermaidHtml.length ? `<div class="mermaid print-mermaid">${mermaidHtml[i++]}</div>` : m
    )
  }
  const esc = md.utils.escapeHtml
  const title = esc(post.title || '未命名随笔')
  const date = esc(post.date || '')
  const tags = (post.tags || [])
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join('')

  const tocHtml = toc.length
    ? `<nav class="print-toc"><h2>目录</h2><ol>${toc
        .map(
          (h) =>
            `<li class="lvl-${h.level}"><a href="#${h.slug}">${esc(h.text)}</a></li>`
        )
        .join('')}</ol></nav>`
    : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="${absUrl(katexCssUrl)}">
<link rel="stylesheet" href="${absUrl(hljsCssUrl)}">
<style>${PRINT_CSS}</style>
</head>
<body>
<article class="print-article">
  <header>
    <h1 class="print-title">${title}</h1>
    <div class="print-meta">${date}${tags ? tags : ''}</div>
  </header>
  ${tocHtml}
  <div class="print-body">${body}</div>
</article>
<script>
window.addEventListener('load', function () {
  var go = function () { setTimeout(function () { window.print(); }, 200); };
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); } else { go(); }
});
// 打印/取消后关闭这个临时窗口，避免每次导出都留下一个标签页
if (window.opener) window.addEventListener('afterprint', function () { window.close(); });
<\/script>
</body>
</html>`
}
