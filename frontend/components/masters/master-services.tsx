"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, Euro, Loader2 } from "lucide-react"
import { getMasterServices } from "@/lib/api/masters"
import type { Service } from "@/lib/api/types"

interface MasterServicesProps {
  masterId: string
  profileId?: number
}

export function MasterServices({ masterId, profileId }: MasterServicesProps) {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profileId) {
      loadServices(profileId)
    } else {
      // If profileId not provided, try to parse masterId as number
      const id = parseInt(masterId)
      if (!isNaN(id)) {
        loadServices(id)
      } else {
        setLoading(false)
      }
    }
  }, [masterId, profileId])

  const loadServices = async (profileId: number) => {
    try {
      setLoading(true)
      const data = await getMasterServices(profileId)
      setServices(data || [])
    } catch (error: any) {
      console.error("Failed to load services:", error)
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Keine Service verfügbar</p>
        <p className="text-sm">This master hasn't added any services yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {services.map((service) => (
        <Card key={service.id}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                {service.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{service.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-1.5 text-sm">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">€{service.price_from}</span>
                <span className="text-muted-foreground text-xs">starting from</span>
              </div>
              <Button>Book Service</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
