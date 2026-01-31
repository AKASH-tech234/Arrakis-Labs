import { cn } from "./cn";

export default function Card({ as: Comp = "div", className, children, ...props }) {
  return (
    <Comp
      className={cn(
        "bg-[#121210] border border-[#1A1814] shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
