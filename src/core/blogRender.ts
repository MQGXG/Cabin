/**
 * 博客 Markdown 渲染（markdown-it：html:false 防 XSS、linkify 自动链接）
 */
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false, // 不放行内联 HTML，防 XSS
  linkify: true,
  breaks: true,
})

/** Markdown → 安全 HTML */
export function renderMarkdown(src: string): string {
  try {
    return md.render(src ?? '')
  } catch {
    return ''
  }
}
