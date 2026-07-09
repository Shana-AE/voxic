/** Shared client-side types (mirrors the server's list response shapes). */
export interface ArticleListItem {
  id: string
  date: string
  title: string
  source: "maimemo" | "import"
  forgetCount?: number
  vagueCount?: number
  familiarCount?: number
}

export interface ArticlesListResponse {
  maimemo: ArticleListItem[]
  imports: ArticleListItem[]
  nasError: string | null
}
