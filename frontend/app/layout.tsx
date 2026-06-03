import type React from "react"
import type { Metadata } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { AppToaster } from "../components/layout/app-toaster"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { DebugGrid } from "@/components/debug-grid"
import { isDevelopment } from "@/lib/constants"
import { Header } from "../components/layout/header"
import { MobileAppChrome } from "../components/layout/mobile-app-chrome"
import { BodyScrollReset } from "../components/layout/body-scroll-reset"
import { MobileViewportReset } from "../components/layout/mobile-viewport-reset"
import { GlobalMessageNotifier } from "../components/layout/global-message-notifier"
import { ConditionalFooter } from "../components/layout/conditional-footer"
import { InstallPrompt } from "../components/layout/install-prompt"
import { PushSubscriptionSetup } from "../components/layout/push-subscription-setup"
import dynamic from "next/dynamic"
import { V0Provider } from "../lib/context"
import { AuthProvider } from "../lib/context/auth-context"
import { CartProvider } from "../lib/context/cart-context"
import { cn } from "../lib/utils"
import { Suspense } from "react"

const V0Setup = dynamic(() => import("@/components/v0-setup"))

const isV0 = process.env["VERCEL_URL"]?.includes("vusercontent.net") ?? false

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Get the base URL for metadata (Open Graph, Twitter cards, etc.)
const getMetadataBase = (): string => {
  // In production, use the environment variable or Vercel URL
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Default to localhost in development
  return 'http://localhost:3000'
}

const THEME_COLOR = "#3adcd5"

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBase()),
  title: "Allesinda – Handwerker finden",
  description: "Ihr Marktplatz für geprüfte Handwerker und Reparaturdienste in ganz Deutschland.",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-maskable.svg", type: "image/svg+xml" },
      { url: "/icon-maskable-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Allesinda",
    statusBarStyle: "default",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
  themeColor: THEME_COLOR,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body
        className={cn(inter.variable, spaceGrotesk.variable, "antialiased min-h-screen bg-white", { "is-v0": isV0 })}
        suppressHydrationWarning
      >
        <V0Provider isV0={isV0}>
          <AuthProvider>
            <CartProvider>
              <NuqsAdapter>
              <BodyScrollReset />
              <MobileViewportReset />
              <GlobalMessageNotifier />
              <main data-vaul-drawer-wrapper="true" className="min-h-screen overflow-x-hidden">
                <Suspense fallback={
                  <div className="h-16 bg-background border-b" />
                }>
                  <Header />
                </Suspense>
                <MobileAppChrome>{children}</MobileAppChrome>
              </main>
              <ConditionalFooter />
              <InstallPrompt />
              <PushSubscriptionSetup />
              {isDevelopment && <DebugGrid />}
              <AppToaster />
              </NuqsAdapter>
              {isV0 && <V0Setup />}
            </CartProvider>
          </AuthProvider>
        </V0Provider>
      </body>
    </html>
  )
}
