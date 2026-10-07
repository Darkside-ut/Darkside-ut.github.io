import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import matter from 'gray-matter'
import markdownItKatex from 'markdown-it-katex'
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

// 数学公式：$...$ 行内，$$...$$ 块级
md.use(markdownItKatex)

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
