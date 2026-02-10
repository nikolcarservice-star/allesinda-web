import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function BookingsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-sides py-8">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-5 w-96 mb-6" />

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <Skeleton className="w-32 h-32 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-64" />
                    <Skeleton className="h-4 w-32" />
                    <div className="grid grid-cols-3 gap-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
