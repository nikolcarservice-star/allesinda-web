'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        modern: 'bg-muted/50 rounded-lg border border-border/40 shadow-none gap-1.5 sm:gap-2 h-auto p-1.5 sm:p-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default:
          'flex-1 h-[calc(100%-1px)] data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground data-[state=active]:shadow-sm',
        modern:
          'flex-1 text-xs sm:text-sm rounded-lg font-medium py-2 sm:py-2.5 px-2 sm:px-3 text-muted-foreground transition-all duration-300 ease-in-out border-2 border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:[&_svg]:text-primary-foreground data-[state=active]:[&_span]:text-primary-foreground hover:text-foreground hover:bg-muted/80 hover:[&_svg]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 relative [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4 [&_svg]:transition-colors [&_svg]:duration-300 min-w-0',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
