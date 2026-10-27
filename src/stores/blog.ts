/**
 * 博客状态：文章 / 分类 / 标签 / 设置 / 回收站 / 静态导出
 * 规则（校验、状态机、派生字段）全部走 blogCore 纯函数
 */
import { defineStore } from 'pinia'
import {
  loadPosts, insertPost, updatePost, loadSlugs,
  loadCategories, insertCategory, updateCategory, deleteCategory,
  loadTags, insertTag, updateTag, deleteTag,
  loadBlogSettings, saveBlogSettings,
} from '@/db/blogRepositories'
import {
  newId, slugify, makeUniqueSlug, defaultSlug, autoExcerpt, estimateReadingMinutes,
  nextStatus, collectPublishErrors, buildStaticExport,
} from '@/core/blogCore'
import type { BlogPost, BlogCategory, BlogTag, BlogSettings } from '@/types'

export const useBlogStore = defineStore('blog', {
  state: () => ({
    ready: false,
    posts: [] as BlogPost[],
    categories: [] as BlogCategory[],
    tags: [] as BlogTag[],
    settings: {
      blogName: '小木屋手记',
      blogDescription: '记录与分享，存在自己的浏览器里',
      pageSize: 9,
      excerptLength: 120,
    } as BlogSettings,
  }),

  getters: {
    /** 未删除文章 */
    activePosts(state): BlogPost[] {
      return state.posts.filter((p) => p.deletedAt === null)
    },
    /** 回收站 */
    recycledPosts(state): BlogPost[] {
      return state.posts.filter((p) => p.deletedAt !== null)
    },
    /** 已发布（前台） */
    publishedPosts(): BlogPost[] {
      return this.activePosts.filter((p) => p.status === 'published')
    },
    categoryMap(state): Map<string, BlogCategory> {
      return new Map(state.categories.map((c) => [c.id, c]))
    },
    categoryName(): (id: string) => string {
      return (id) => this.categoryMap.get(id)?.name ?? ''
    },
    tagMap(state): Map<string, BlogTag> {
      return new Map(state.tags.map((t) => [t.id, t]))
    },
    tagName(): (id: string) => string {
      return (id) => this.tagMap.get(id)?.name ?? id
    },
  },

  actions: {
    /** 初始化加载 */
    async init() {
      const db = this.getDbOrThrow()
      this.posts = loadPosts(db)
      this.categories = loadCategories(db)
      this.tags = loadTags(db)
      this.settings = loadBlogSettings(db)
      this.ready = true
    },

    getDbOrThrow() {
      // 复用主 store 的 SQLite 单例（main init 时经 window 注入，避免循环依赖）
      const db = (window as unknown as { __cabinDb?: unknown }).__cabinDb
      if (!db) throw new Error('数据库尚未初始化')
      return db as ReturnType<typeof import('@/db/connection').getDb>
    },

    /** 保存文章（编辑器）：派生字段 + slug 唯一化 + 校验 */
    savePost(
      draft: {
        id?: string
        title: string
        subtitle: string
        slug: string
        contentMarkdown: string
        categoryId: string
        tagIds: string[]
      },
      publish: boolean,
    ): { ok: boolean; errors: string[]; post?: BlogPost } {
      const db = this.getDbOrThrow()
      const now = Date.now()
      const slug = draft.slug.trim() || defaultSlug(now)
      const errors = publish
        ? collectPublishErrors(
            { title: draft.title, slug, contentMarkdown: draft.contentMarkdown },
            loadSlugs(db, draft.id),
          )
        : draft.title.trim()
          ? []
          : ['草稿也需标题']
      if (errors.length > 0) return { ok: false, errors }

      const existing = draft.id ? this.posts.find((p) => p.id === draft.id) : undefined
      const uniqueSlug = makeUniqueSlug(slug, loadSlugs(db, draft.id))

      if (existing) {
        const updated: BlogPost = {
          ...existing,
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim(),
          slug: uniqueSlug,
          excerpt: autoExcerpt(draft.contentMarkdown, this.settings.excerptLength),
          contentMarkdown: draft.contentMarkdown,
          categoryId: draft.categoryId,
          tagIds: draft.tagIds,
          readingMinutes: estimateReadingMinutes(draft.contentMarkdown),
          updatedAt: now,
        }
        if (publish && existing.status === 'draft') {
          updated.status = 'published'
          updated.publishedAt = now
        }
        updatePost(db, updated)
        this.posts = loadPosts(db)
        return { ok: true, errors: [], post: updated }
      }

      const post: BlogPost = {
        id: newId('bp'),
        slug: uniqueSlug,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        excerpt: autoExcerpt(draft.contentMarkdown, this.settings.excerptLength),
        contentMarkdown: draft.contentMarkdown,
        status: publish ? 'published' : 'draft',
        categoryId: draft.categoryId,
        tagIds: draft.tagIds,
        pinned: false,
        viewCount: 0,
        readingMinutes: estimateReadingMinutes(draft.contentMarkdown),
        createdAt: now,
        updatedAt: now,
        publishedAt: publish ? now : null,
        deletedAt: null,
      }
      insertPost(db, post)
      this.posts = loadPosts(db)
      return { ok: true, errors: [], post }
    },

    /** 状态切换（发布/撤回） */
    transit(postId: string, action: 'publish' | 'unpublish'): boolean {
      const db = this.getDbOrThrow()
      const post = this.posts.find((p) => p.id === postId)
      if (!post) return false
      const next = nextStatus(post.status, action)
      if (!next) return false
      const now = Date.now()
      const updated: BlogPost = {
        ...post,
        status: next,
        updatedAt: now,
        publishedAt: next === 'published' ? (post.publishedAt ?? now) : post.publishedAt,
      }
      updatePost(db, updated)
      this.posts = loadPosts(db)
      return true
    },

    /** 置顶切换 */
    togglePin(postId: string): void {
      const db = this.getDbOrThrow()
      const post = this.posts.find((p) => p.id === postId)
      if (!post) return
      updatePost(db, { ...post, pinned: !post.pinned, updatedAt: Date.now() })
      this.posts = loadPosts(db)
    },

    /** 软删（进回收站） */
    softDelete(postId: string): void {
      const db = this.getDbOrThrow()
      const post = this.posts.find((p) => p.id === postId)
      if (!post) return
      updatePost(db, { ...post, deletedAt: Date.now(), updatedAt: Date.now() })
      this.posts = loadPosts(db)
    },

    /** 回收站恢复 */
    restore(postId: string): void {
      const db = this.getDbOrThrow()
      const post = this.posts.find((p) => p.id === postId)
      if (!post) return
      updatePost(db, { ...post, deletedAt: null, updatedAt: Date.now() })
      this.posts = loadPosts(db)
    },

    /** 彻底删除 */
    purge(postId: string): void {
      const db = this.getDbOrThrow()
      db.run('DELETE FROM blog_posts WHERE id=?', [postId])
      this.posts = loadPosts(db)
    },

    /** 阅读量自增（前台进详情时调用） */
    incrementView(postId: string): void {
      const db = this.getDbOrThrow()
      const post = this.posts.find((p) => p.id === postId)
      if (!post) return
      updatePost(db, { ...post, viewCount: post.viewCount + 1 })
      this.posts = loadPosts(db)
    },

    /* ---------- 分类 ---------- */

    createCategory(name: string): { ok: boolean; msg?: string } {
      const db = this.getDbOrThrow()
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, msg: '名称不能为空' }
      if (this.categories.some((c) => c.name === trimmed)) return { ok: false, msg: '分类已存在' }
      const cat: BlogCategory = {
        id: newId('bc'),
        name: trimmed,
        slug: slugify(trimmed) || defaultSlug(),
        createdAt: Date.now(),
      }
      insertCategory(db, cat)
      this.categories = loadCategories(db)
      return { ok: true }
    },

    renameCategory(id: string, name: string): { ok: boolean; msg?: string } {
      const db = this.getDbOrThrow()
      const cat = this.categories.find((c) => c.id === id)
      if (!cat) return { ok: false, msg: '分类不存在' }
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, msg: '名称不能为空' }
      updateCategory(db, { ...cat, name: trimmed, slug: slugify(trimmed) || cat.slug })
      this.categories = loadCategories(db)
      return { ok: true }
    },

    removeCategory(id: string): void {
      const db = this.getDbOrThrow()
      deleteCategory(db, id)
      this.categories = loadCategories(db)
      this.posts = loadPosts(db)
    },

    /* ---------- 标签 ---------- */

    createTag(name: string): { ok: boolean; msg?: string } {
      const db = this.getDbOrThrow()
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, msg: '名称不能为空' }
      if (this.tags.some((t) => t.name === trimmed)) return { ok: false, msg: '标签已存在' }
      const tag: BlogTag = {
        id: newId('bt'),
        name: trimmed,
        slug: slugify(trimmed) || defaultSlug(),
        createdAt: Date.now(),
      }
      insertTag(db, tag)
      this.tags = loadTags(db)
      return { ok: true }
    },

    renameTag(id: string, name: string): { ok: boolean; msg?: string } {
      const db = this.getDbOrThrow()
      const tag = this.tags.find((t) => t.id === id)
      if (!tag) return { ok: false, msg: '标签不存在' }
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, msg: '名称不能为空' }
      updateTag(db, { ...tag, name: trimmed, slug: slugify(trimmed) || tag.slug })
      this.tags = loadTags(db)
      return { ok: true }
    },

    removeTag(id: string): void {
      const db = this.getDbOrThrow()
      deleteTag(db, id)
      this.tags = loadTags(db)
      this.posts = loadPosts(db)
    },

    /* ---------- 设置 ---------- */

    async saveSettings(patch: Partial<BlogSettings>): Promise<void> {
      const db = this.getDbOrThrow()
      this.settings = { ...this.settings, ...patch }
      saveBlogSettings(db, this.settings)
    },

    /* ---------- 静态导出 ---------- */

    exportStaticHtml(): void {
      const html = buildStaticExport(
        { blogName: this.settings.blogName, blogDescription: this.settings.blogDescription },
        this.posts,
        (id) => this.categoryName(id),
      )
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'cabin-blog.html'
      a.click()
      URL.revokeObjectURL(a.href)
    },
  },
})
