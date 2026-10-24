import type { ComponentProps } from "react";

export function PlusIcon(props: ComponentProps<"svg">) {
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
        d="M9 2V16M16 9L2 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
