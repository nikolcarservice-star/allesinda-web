import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
}

/** Wordmark from /logo_dark.webp, tinted with brand primary (cyan). */
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "block bg-primary",
        "[mask-image:url(/logo_dark.webp)] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center]",
        "[-webkit-mask-image:url(/logo_dark.webp)] [-webkit-mask-size:contain] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center]",
        className,
      )}
    />
  )
}
