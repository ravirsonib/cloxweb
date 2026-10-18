import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva('clox-btn', {
  variants: {
    variant: {
      primary: 'clox-btn-primary',
      secondary: 'clox-btn-secondary',
      ghost: 'clox-btn-ghost',
      destructive: 'clox-btn-destructive',
      cta: 'clox-btn-cta',
    },
    size: {
      md: '',
      sm: 'px-3 py-1.5 text-[12.5px]',
      block: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
