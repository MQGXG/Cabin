/**
 * 精选图标集（显式注册，保证 tree-shake 体积可控）
 * 存储格式：`lucide:名称`（旧 emoji 数据由 AppIcon 兼容渲染）
 */
import type { Component } from 'vue'
import {
  Star, Wrench, BookOpen, Gamepad2, Folder, FolderOpen, Film, Briefcase,
  House, Lightbulb, Rocket, Palette, Heart, Camera, Music, Code, Gift,
  Coffee, MapPin, Bookmark, Zap, Link2, Globe, Users, Newspaper, Bot,
} from 'lucide-vue-next'

export const ICON_MAP: Record<string, Component> = {
  Star, Wrench, BookOpen, Gamepad2, Folder, FolderOpen, Film, Briefcase,
  House, Lightbulb, Rocket, Palette, Heart, Camera, Music, Code, Gift,
  Coffee, MapPin, Bookmark, Zap, Link2, Globe, Users, Newspaper, Bot,
}

/** 图标选择器可选项（名称列表） */
export const ICON_CHOICES = Object.keys(ICON_MAP)
