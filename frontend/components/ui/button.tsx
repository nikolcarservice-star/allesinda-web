import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-base transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:!m-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary border border-transparent text-primary-foreground shadow-none hover:bg-primary/90 hover:text-black hover:font-bold',
        destructive:
          'bg-destructive text-white shadow-none hover:bg-destructive/90 hover:text-black hover:font-bold focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-none hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-background/10 backdrop-blur-lg text-foreground hover:bg-background/20',
        ghost: 'font-medium text-foreground/50 hover:bg-accent hover:text-foreground/70 dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: "h-8 rounded-sm gap-1.5 py-1 px-2 [&_svg:not([class*='size-'])]:size-4",
        default: "h-10 px-3 py-2 gap-1.5 [&_svg:not([class*='size-'])]:size-5",
        lg: "h-12 rounded-md px-3 gap-1.5 [&_svg:not([class*='size-'])]:size-6",
        large: "h-12 rounded-md font-semibold shadow-none hover:shadow-none transition-all px-3 gap-1.5 [&_svg:not([class*='size-'])]:size-6",
        xl: "h-12 text-base font-semibold rounded-md shadow-none hover:shadow-none transition-all px-3 gap-1.5 [&_svg:not([class*='size-'])]:size-6",
        'icon-sm': "size-9 gap-0 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10 gap-0 [&_svg:not([class*='size-'])]:size-6",
        'icon-lg': "size-12 gap-0 [&_svg:not([class*='size-'])]:size-7",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
