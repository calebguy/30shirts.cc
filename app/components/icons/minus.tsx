import type { ComponentProps } from "react";

export function MinusIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 18 18"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M2 9H16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
