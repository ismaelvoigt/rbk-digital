import Image from "next/image";
import HeaderSearch from './HeaderSearch';

export function RbkBrand({
  compact = false,
  light = false,
  search = true,
}: {
  compact?: boolean;
  light?: boolean;
  search?: boolean;
}) {
  return (
    <>
      <div
        className={
          compact
            ? "relative h-14 w-[220px] overflow-hidden"
            : "relative h-[86px] w-[320px] overflow-hidden"
        }
        aria-label="RBK Digital"
      >
        <Image
          src={light ? "/rbk-digital-logo-blue.png" : "/rbk-digital-logo-original.png"}
          alt="RBK Digital"
          fill
          priority
          sizes={compact ? "220px" : "320px"}
          className="object-contain object-center"
        />
      </div>
      {search && <HeaderSearch />}
    </>
  );
}

export function RbkMark() {
  return null;
}
