import Image from "next/image";

export function RbkBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "relative h-14 w-[210px] overflow-hidden"
          : "relative h-[75px] w-[280px] overflow-hidden"
      }
      aria-label="RBK Digital"
    >
      <Image
        src="/rbk-digital-logo.png"
        alt="RBK Digital"
        fill
        priority
        sizes={compact ? "210px" : "280px"}
        className="object-cover object-center"
      />
    </div>
  );
}

export function RbkMark() {
  return null;
}
