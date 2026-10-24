import type { ComponentProps } from "react";

export function CloseIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 45 45"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      {...props}
    >
      <line x1="5" x2="40" y1="5" y2="40" />
      <line x1="5" x2="40" y1="40" y2="5" />
    </svg>
  );
}
