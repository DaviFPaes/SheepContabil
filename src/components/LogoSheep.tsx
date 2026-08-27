export function LogoSheep({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="SheepContabil"
    >
      <circle cx="24" cy="24" r="24" fill="currentColor" />
      <path
        d="M15 21c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v6c0 3.3-2.7 6-6 6h-6c-3.3 0-6-2.7-6-6v-6z"
        fill="white"
      />
      <circle cx="13" cy="19" r="3.5" fill="white" />
      <circle cx="35" cy="19" r="3.5" fill="white" />
      <circle cx="19" cy="27" r="1.6" fill="currentColor" />
      <circle cx="29" cy="27" r="1.6" fill="currentColor" />
    </svg>
  );
}
