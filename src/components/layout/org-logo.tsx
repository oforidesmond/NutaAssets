import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-7 max-w-[7rem]",
  md: "h-10 max-w-[10rem]",
} as const;

export function OrgLogo({
  src,
  alt,
  size = "sm",
  className,
}: {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  const url = src?.trim();
  if (!url) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-supplied arbitrary URL
    <img
      src={url}
      alt={alt}
      className={cn("w-auto object-contain", sizeClasses[size], className)}
    />
  );
}
