import Image from "next/image";

export function RbkBrand({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "relative h-14 w-[220px] overflow-hidden"
          : "relative h-[86px] w-[320px] overflow-hidden"
      }
      aria-label="RBK Digital"
    >
      <Image
        src="/rbk-digital-logo-original.png"
        alt="RBK Digital"
        fill
        priority
        sizes={compact ? "220px" : "320px"}
        className="object-contain object-center"
      />
    </div>
  );
}

export function RbkMark() {
  return null;
}
