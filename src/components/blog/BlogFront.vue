<script setup lang="ts">
/**
 * 博客前台：列表（搜索/分类/标签/排序/分页/置顶）+ 详情（Markdown 渲染/相关文章）
 * 视觉：Cabin 暗色玻璃 + 小木屋绿主色（区别于原版白底蓝阅读风）
 */
import { ref, computed, watch } from 'vue'
import { ArrowLeft, Pin, Eye, Clock, Search, BookOpen, PenLine } from 'lucide-vue-next'
import { useBlogStore } from '@/stores/blog'
import { openBlogAdmin, backToNav } from '@/composables/ui'
import { renderMarkdown } from '@/core/blogRender'
import {
  filterPosts, sortPosts, paginate, relativeTime, categoriesWithPosts, tagUsageCount,
} from '@/core/blogCore'
import type { BlogPost, BlogSort } from '@/types'

const blog = useBlogStore()

/* ---------- 列表态 ---------- */
const keyword = ref('')
const statusFilter = ref<'all' | 'published'>('published')
const categoryFilter = ref('')
const tagFilter = ref('')
const sort = ref<BlogSort>('updated-desc')
const page = ref(1)
const pagedSize = computed(() => blog.settings.pageSize)

/** 前台基准：已发布（后台可切"全部"预览草稿） */
const basePosts = computed(() =>
  blog.activePosts.filter((p) => statusFilter.value === 'all' || p.status === 'published'),
)

const filtered = computed(() =>
  sortPosts(
    filterPosts(basePosts.value, {
      keyword: keyword.value,
      categoryId: categoryFilter.value,
      tagId: tagFilter.value,
    }),
    sort.value,
  ),
)

const paged = computed(() => paginate(filtered.value, page.value, pagedSize.value))

/** 有文章的分类（空分类不显示） */
const shownCategories = computed(() =>
  categoriesWithPosts(blog.categories, blog.activePosts),
)
const shownTags = computed(() =>
  blog.tags
    .map((t) => ({ ...t, count: tagUsageCount(blog.activePosts, t.id) }))
    .filter((t) => t.count > 0),
)

watch([keyword, categoryFilter, tagFilter, sort, statusFilter], () => {
  page.value = 1
})

function pickCategory(id: string) {
  categoryFilter.value = categoryFilter.value === id ? '' : id
}
function pickTag(id: string) {
  tagFilter.value = tagFilter.value === id ? '' : id
}

/* ---------- 详情态 ---------- */
const viewing = ref<BlogPost | null>(null)

function openPost(post: BlogPost) {
  viewing.value = post
  blog.incrementView(post.id)
  window.scrollTo({ top: 0 })
}

const html = computed(() => (viewing.value ? renderMarkdown(viewing.value.contentMarkdown) : ''))

/** 相关文章：同分类优先补足到 4 篇 */
const related = computed(() => {
  if (!viewing.value) return []
  const others = blog.publishedPosts.filter((p) => p.id !== viewing.value!.id)
  const sameCat = others.filter((p) => p.categoryId === viewing.value!.categoryId)
  const rest = others.filter((p) => p.categoryId !== viewing.value!.categoryId)
  return [...sameCat, ...rest].slice(0, 4)
})

const wordCount = computed(() =>
  viewing.value ? viewing.value.contentMarkdown.replace(/\s/g, '').length : 0,
)

/** 分类色块（详情封面用渐变占位） */
function coverGradient(post: BlogPost): string {
  const seed = post.id.charCodeAt(post.id.length - 1) % 6
  const gradients = [
    'linear-gradient(135deg,#0ea5e9,#22c58b)',
    'linear-gradient(135deg,#8b5cf6,#0ea5e9)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#22c58b,#84cc16)',
    'linear-gradient(135deg,#ec4899,#8b5cf6)',
    'linear-gradient(135deg,#14b8a6,#3b82f6)',
  ]
  return gradients[seed]
}
</script>

<template>
  <div class="blog-shell">
    <!-- 顶栏 -->
    <header class="bf-top">
      <button class="bf-back" @click="viewing ? (viewing = null) : backToNav()">
        <ArrowLeft :size="16" /> {{ viewing ? '返回文章列表' : '返回导航' }}
      </button>
      <div class="bf-brand">
        <BookOpen :size="17" class="bf-brand-ic" />
        <span class="bf-name">{{ blog.settings.blogName }}</span>
      </div>
      <div class="bf-top-actions">
        <button class="bf-mini-btn" title="博客管理（后台）" @click="openBlogAdmin()">
          <PenLine :size="14" /> 管理
        </button>
      </div>
    </header>

    <!-- ========== 列表视图 ========== -->
    <template v-if="!viewing">
      <div class="bf-intro">
        <h1>{{ blog.settings.blogName }}</h1>
        <p>{{ blog.settings.blogDescription }}</p>
      </div>

      <!-- 筛选条 -->
      <div class="bf-filter">
        <div class="bf-search">
          <Search :size="14" />
          <input v-model="keyword" type="text" placeholder="搜索文章标题、内容…" />
        </div>
        <select v-model="sort" class="bf-select">
          <option value="updated-desc">最近更新</option>
          <option value="updated-asc">最早更新</option>
          <option value="created-desc">最新创建</option>
          <option value="published-desc">最近发布</option>
          <option value="views-desc">阅读最多</option>
          <option value="title-asc">标题 A→Z</option>
        </select>
        <select v-model="statusFilter" class="bf-select" title="后台预览用：可查看草稿">
          <option value="published">已发布</option>
          <option value="all">全部（含草稿）</option>
        </select>
      </div>

      <!-- 分类 / 标签 pills -->
      <div v-if="shownCategories.length" class="bf-pills">
        <button
          class="bf-pill"
          :class="{ active: !categoryFilter }"
          @click="categoryFilter = ''"
        >
          全部 <span class="cnt">{{ basePosts.length }}</span>
        </button>
        <button
          v-for="c in shownCategories"
          :key="c.id"
          class="bf-pill"
          :class="{ active: categoryFilter === c.id }"
          @click="pickCategory(c.id)"
        >
          {{ c.name }}
          <span class="cnt">{{ blog.activePosts.filter((p) => p.categoryId === c.id && p.status === 'published').length }}</span>
        </button>
      </div>
      <div v-if="shownTags.length" class="bf-pills tags">
        <button
          v-for="t in shownTags"
          :key="t.id"
          class="bf-pill tag"
          :class="{ active: tagFilter === t.id }"
          @click="pickTag(t.id)"
        >
          #{{ t.name }} <span class="cnt">{{ t.count }}</span>
        </button>
      </div>

      <!-- 文章卡片 -->
      <div v-if="paged.items.length" class="bf-grid">
        <article
          v-for="post in paged.items"
          :key="post.id"
          class="bf-card"
          @click="openPost(post)"
        >
          <span v-if="post.pinned" class="bf-pin"><Pin :size="11" /> 置顶</span>
          <div class="bf-card-cover" :style="{ background: coverGradient(post) }" />
          <div class="bf-card-body">
            <div class="bf-card-meta-top">
              <span class="bf-cat">{{ blog.categoryName(post.categoryId) || '未分类' }}</span>
              <span v-if="post.status === 'draft'" class="bf-draft">草稿</span>
            </div>
            <h3 class="bf-card-title">{{ post.title }}</h3>
            <p v-if="post.subtitle" class="bf-card-sub">{{ post.subtitle }}</p>
            <p class="bf-card-excerpt">{{ post.excerpt }}</p>
            <div class="bf-card-foot">
              <span>{{ relativeTime(post.updatedAt) }}</span>
              <span class="bf-dot">·</span>
              <span><Clock :size="11" /> {{ post.readingMinutes }} 分钟</span>
              <span class="bf-dot">·</span>
              <span><Eye :size="11" /> {{ post.viewCount }}</span>
            </div>
            <div v-if="post.tagIds.length" class="bf-card-tags">
              <span v-for="tid in post.tagIds.slice(0, 4)" :key="tid" class="bf-tag">
                #{{ blog.tagName(tid) }}
              </span>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="bf-empty">
        <BookOpen :size="40" :stroke-width="1.4" />
        <p>还没有文章</p>
        <p class="sub">去「管理」写第一篇吧</p>
      </div>

      <!-- 分页 -->
      <div v-if="paged.totalPages > 1" class="bf-pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="pagedSize"
          :total="paged.total"
          layout="prev, pager, next, total"
          background
        />
      </div>

      <footer class="bf-footer">
        {{ blog.settings.blogName }} · 本地离线博客 · 共 {{ blog.publishedPosts.length }} 篇已发布
      </footer>
    </template>

    <!-- ========== 详情视图 ========== -->
    <template v-else-if="viewing">
      <article class="bf-post">
        <div class="bf-post-cover" :style="{ background: coverGradient(viewing) }" />
        <div class="bf-post-cat">{{ blog.categoryName(viewing.categoryId) || '未分类' }}</div>
        <h1 class="bf-post-title">{{ viewing.title }}</h1>
        <p v-if="viewing.subtitle" class="bf-post-sub">{{ viewing.subtitle }}</p>
        <div class="bf-post-meta">
          <span>{{ relativeTime(viewing.publishedAt ?? viewing.createdAt) }}</span>
          <span class="bf-dot">·</span>
          <span><Clock :size="12" /> {{ viewing.readingMinutes }} 分钟阅读</span>
          <span class="bf-dot">·</span>
          <span>约 {{ wordCount }} 字</span>
          <span class="bf-dot">·</span>
          <span><Eye :size="12" /> {{ viewing.viewCount + 1 }} 次阅读</span>
        </div>

        <div class="bf-post-body md-body" v-html="html" />

        <div v-if="viewing.tagIds.length" class="bf-post-tags">
          <span v-for="tid in viewing.tagIds" :key="tid" class="bf-tag lg">
            #{{ blog.tagName(tid) }}
          </span>
        </div>

        <!-- 相关文章 -->
        <section v-if="related.length" class="bf-related">
          <h4>相关文章</h4>
          <div class="bf-grid small">
            <article v-for="p in related" :key="p.id" class="bf-card" @click="openPost(p)">
              <div class="bf-card-body">
                <h3 class="bf-card-title">{{ p.title }}</h3>
                <div class="bf-card-foot">
                  <span>{{ relativeTime(p.updatedAt) }}</span>
                  <span class="bf-dot">·</span>
                  <span>{{ p.readingMinutes }} 分钟</span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </article>
    </template>
  </div>
</template>

<style scoped>
.blog-shell {
  min-height: 100vh;
  background: var(--c-bg);
  color: var(--c-text);
}

/* 顶栏 */
.bf-top {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: color-mix(in srgb, var(--c-header-bg) 78%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--c-border);
}
.bf-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--c-text-dim);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
}
.bf-back:hover {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}
.bf-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--c-primary);
}
.bf-top-actions {
  margin-left: auto;
}
.bf-mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text-dim);
  border-radius: 9px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
}
.bf-mini-btn:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}

/* 内容壳 */
.blog-shell > .bf-intro,
.blog-shell > .bf-filter,
.blog-shell > .bf-pills,
.blog-shell > .bf-grid,
.blog-shell > .bf-empty,
.blog-shell > .bf-pager,
.blog-shell > .bf-footer {
  max-width: 1080px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 24px;
  padding-right: 24px;
}
.blog-shell > .bf-intro {
  padding-top: 40px;
}
.bf-intro h1 {
  margin: 0 0 8px;
  font-size: 32px;
  color: var(--c-text);
}
.bf-intro p {
  margin: 0;
  color: var(--c-text-dim);
}

/* 筛选 */
.bf-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}
.bf-search {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 9px 14px;
  color: var(--c-text-dim);
}
.bf-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--c-text);
  font-size: 14px;
}
.bf-search input::placeholder {
  color: var(--c-text-dim);
}
.bf-select {
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  color: var(--c-text);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 13px;
  cursor: pointer;
}

/* pills */
.bf-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.bf-pill {
  border: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  color: var(--c-text-dim);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bf-pill:hover {
  border-color: var(--c-primary);
  color: var(--c-primary);
}
.bf-pill.active {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
  font-weight: 600;
}
.bf-pill .cnt {
  font-size: 11px;
  opacity: 0.75;
}
.bf-pill.tag {
  border-style: dashed;
}

/* 卡片网格 */
.bf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
  margin-top: 22px;
}
.bf-grid.small {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.bf-card {
  position: relative;
  background: var(--c-card);
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}
.bf-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border));
  background: var(--c-card-hover);
}
.bf-card-cover {
  height: 90px;
}
.bf-card-body {
  padding: 16px 18px 16px;
}
.bf-card-meta-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.bf-cat {
  font-size: 11px;
  color: var(--c-primary);
  background: var(--c-primary-soft);
  border-radius: 5px;
  padding: 2px 8px;
}
.bf-draft {
  font-size: 11px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  border-radius: 5px;
  padding: 2px 8px;
}
.bf-card-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 700;
  color: var(--c-text);
}
.bf-card-sub {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--c-text-dim);
}
.bf-card-excerpt {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--c-text-dim);
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bf-card-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--c-text-dim);
}
.bf-card-foot span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.bf-dot {
  opacity: 0.5;
}
.bf-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.bf-tag {
  font-size: 11px;
  color: var(--c-primary);
  background: var(--c-primary-soft);
  border-radius: 5px;
  padding: 2px 8px;
}
.bf-tag.lg {
  font-size: 13px;
  padding: 5px 12px;
}
.bf-pin {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(245, 158, 11, 0.92);
  color: #fff;
  font-size: 11px;
  border-radius: 6px;
  padding: 3px 9px;
}

/* 空态 / 分页 / 页脚 */
.bf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 70px 0;
  color: var(--c-text-dim);
}
.bf-empty .sub {
  font-size: 13px;
  opacity: 0.75;
}
.bf-pager {
  display: flex;
  justify-content: center;
  margin-top: 26px;
}
.bf-footer {
  text-align: center;
  color: var(--c-text-dim);
  font-size: 12px;
  padding-top: 40px;
  padding-bottom: 50px;
}

/* ========== 详情 ========== */
.bf-post {
  max-width: 780px;
  margin: 0 auto;
  padding: 32px 24px 70px;
}
.bf-post-cover {
  height: 160px;
  border-radius: 16px;
  margin-bottom: 26px;
}
.bf-post-cat {
  display: inline-block;
  font-size: 12px;
  color: var(--c-primary);
  background: var(--c-primary-soft);
  border-radius: 6px;
  padding: 3px 10px;
  margin-bottom: 14px;
}
.bf-post-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 800;
  line-height: 1.3;
  color: var(--c-text);
}
.bf-post-sub {
  margin: 0 0 16px;
  color: var(--c-text-dim);
  font-size: 15px;
}
.bf-post-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  font-size: 13px;
  color: var(--c-text-dim);
  padding-bottom: 18px;
  border-bottom: 1px solid var(--c-border);
  margin-bottom: 26px;
}
.bf-post-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.bf-post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 30px;
}

/* 相关文章 */
.bf-related {
  margin-top: 44px;
  border-top: 1px solid var(--c-border);
  padding-top: 26px;
}
.bf-related h4 {
  margin: 0 0 16px;
  font-size: 15px;
  color: var(--c-text-dim);
}

@media (max-width: 720px) {
  .bf-grid {
    grid-template-columns: 1fr;
  }
  .bf-post-title {
    font-size: 25px;
  }
}
</style>
