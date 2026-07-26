import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — doc 06 (Botões) + doc 08 (hover scale 1.02).
 * Primary: laranja sólido, texto branco, radius 14px, height 52px.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius-button] font-medium transition-all duration-200 ease-[--ease-out-quart] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white hover:bg-primary-hover hover:scale-[1.02] motion-reduce:hover:scale-100 shadow-soft",
        secondary:
          "border border-gray-200 bg-white text-dark hover:bg-gray-50 hover:border-gray-300 hover:scale-[1.02] motion-reduce:hover:scale-100",
        ghost: "text-dark hover:bg-gray-100",
        dark: "bg-dark text-white hover:bg-dark-soft hover:scale-[1.02] motion-reduce:hover:scale-100",
      },
      size: {
        sm: "h-10 px-4 text-[0.9375rem]",
        md: "h-[52px] px-6 text-base",
        lg: "h-14 px-8 text-[1.0625rem]",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
