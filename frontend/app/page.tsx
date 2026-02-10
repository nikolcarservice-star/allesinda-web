import { getHomeContent } from "@/lib/api"
import type { HomeContent } from "@/lib/api"
import { HomePageContent } from "@/components/home/home-page-content"
import { logger } from "@/lib/logger"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

const FALLBACK_HOME_CONTENT: HomeContent = {
  featured_subcategories: [],
  work_gallery: [],
  recently_viewed: [],
}

export default async function HomePage() {
  let initialContent = FALLBACK_HOME_CONTENT

  try {
    const content = await getHomeContent()
    if (content) {
      initialContent = content
    }
  } catch (error) {
    logger.error("Failed to load home content", error)
  }

  return <HomePageContent initialContent={initialContent} />
}
