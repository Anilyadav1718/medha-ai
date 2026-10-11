"use client";

import Image from "next/image";

type ThinkingStatusProps = {
  label?: string;
};

export default function ThinkingStatus({
  label = "Medha is thinking...",
}: ThinkingStatusProps) {
  return (
    <div
      className="thinking-row"
      role="status"
      aria-live="polite"
    >
      <div className="assistant-avatar thinking-avatar">
        <Image
          src="/medha-avatar.png"
          alt="Medha AI"
          width={34}
          height={34}
          priority
        />
      </div>

      <div className="thinking-content">
        <span
          className="thinking-dot"
          aria-hidden="true"
        />

        <span className="thinking-label">
          {label}
        </span>

        <span
          className="thinking-ellipsis"
          aria-hidden="true"
        >
          ...
        </span>
      </div>
    </div>
  );
}