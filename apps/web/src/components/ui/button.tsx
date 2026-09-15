import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/*
 * Buttons are drawn, not rendered: a pen outline around lighter paper, lettered
 * by hand. Only the ones that matter take ink or colour, so the eye has
 * somewhere to go.
 */
const buttonVariants = cva(
  "penned inline-flex items-center justify-center gap-2 whitespace-nowrap font-hand text-[0.95rem] leading-none tracking-wide transition-all disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          'border-[1.5px] border-ink bg-primary text-primary-foreground shadow-[1px_1.5px_0_#2a211a55] hover:bg-primary/90',
        destructive:
          'border-[1.5px] border-ink bg-destructive text-white shadow-[1px_1.5px_0_#2a211a55] hover:bg-destructive/90',
        outline:
          'border-[1.5px] border-ink/70 bg-papyrus-light text-ink shadow-[1px_1.5px_0_#2a211a2e] hover:bg-papyrus hover:border-ink',
        secondary:
          'border-[1.5px] border-ink/40 bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'border-[1.5px] border-transparent text-ink/80 hover:bg-secondary/70 hover:text-ink',
        accent:
          'border-[1.5px] border-ink bg-accent text-accent-foreground shadow-[1px_1.5px_0_#2a211a55] hover:brightness-105',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 pt-0.5 has-[>svg]:px-2.5',
        xs: 'h-7 gap-1 px-2 text-xs has-[>svg]:px-2',
        lg: 'h-10 px-6 text-base has-[>svg]:px-4',
        icon: 'size-9 penned-alt',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
