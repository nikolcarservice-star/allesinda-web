import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const inputVariants = cva(
  'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border border-border/40 bg-transparent px-3 py-1 text-base shadow-none transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring aria-invalid:border-destructive',
  {
    variants: {
      size: {
        default: 'h-9',
        medium: 'h-11 sm:h-12 text-sm sm:text-base rounded-md border border-border/40 shadow-none hover:shadow-none transition-all bg-background focus-visible:border-border/60',
        large: 'h-12 sm:h-14 text-sm sm:text-base rounded-md border border-border/40 focus:border-primary shadow-none hover:shadow-none transition-all bg-background focus-visible:border-border/60',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

type InputSize = 'default' | 'medium' | 'large'

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  size?: InputSize
}

function Input({ className, type, size = 'default', id, name, ...props }: InputProps) {
  const computedName = name ?? id
  return (
    <input
      type={type}
      id={id}
      name={computedName}
      data-slot="input"
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
