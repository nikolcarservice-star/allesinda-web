"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

interface AddToHomeScreenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddToHomeScreenSheet({ open, onOpenChange }: AddToHomeScreenSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>App auf den Startbildschirm hinzufügen</SheetTitle>
          <SheetDescription className="text-left">
            So installieren Sie Allesinda wie eine App:
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-1 text-sm text-foreground">
          <div>
            <p className="font-semibold mb-1">iPhone / iPad (Safari):</p>
            <p className="text-muted-foreground">
              Tippen Sie unten auf <strong>Teilen</strong> (Quadrat mit Pfeil) → dann auf{" "}
              <strong>„Zum Home-Bildschirm“</strong> → <strong>Hinzufügen</strong>.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Android (Chrome):</p>
            <p className="text-muted-foreground">
              Tippen Sie auf das <strong>Menü</strong> (drei Punkte) →{" "}
              <strong>„Zum Startbildschirm hinzufügen“</strong> oder{" "}
              <strong>„App installieren“</strong>.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
