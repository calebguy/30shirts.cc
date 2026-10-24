import type { ComponentProps } from "react";

export function BagIcon(props: ComponentProps<"svg">) {
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
        d="M12.3497 4.60923C12.3497 2.61374 10.7306 0.999817 8.74027 0.999817C6.74994 0.999817 5.13086 2.61889 5.13086 4.60923M16.4689 17.0002H1L2.54689 6.00177H14.922L16.4689 17.0002Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
