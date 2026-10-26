import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — doc 06 (Botões) + doc 08 (hover scale 1.02).
 * Primary: laranja sólido, texto branco, radius 14px, height 52px.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-button) font-medium transition-all duration-200 ease-(--ease-out-quart) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100 cursor-pointer",
  {
    variants: {
      variant: {
        /* Texto quase preto sobre o laranja, não branco: com o tom do escuro
           (#ff6a1a) o branco dá 3,1:1 e reprova no AA; o quase preto dá
           5,6:1. É a mesma razão pela qual o botão do WhatsApp tem texto
           escuro sobre o verde. */
        primary:
          "bg-primary text-[#1b0c02] hover:bg-primary-hover hover:scale-[1.02] motion-reduce:hover:scale-100 shadow-soft",
        secondary:
          "border border-white/[0.08] bg-panel text-chalk hover:bg-white/[0.05] hover:border-white/20 hover:scale-[1.02] motion-reduce:hover:scale-100",
        ghost: "text-chalk hover:bg-white/[0.06]",
        dark: "bg-ink text-white hover:bg-panel-high hover:scale-[1.02] motion-reduce:hover:scale-100",
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
