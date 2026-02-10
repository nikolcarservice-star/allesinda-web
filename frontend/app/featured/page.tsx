import { redirect } from "next/navigation"

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic'

export default async function FeaturedPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const queryString = params
    ? new URLSearchParams(
        Object.entries(params).reduce(
          (acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = String(value)
            }
            return acc
          },
          {} as Record<string, string>
        )
      ).toString()
    : ""
  
  redirect(queryString ? `/?${queryString}` : "/")
}
