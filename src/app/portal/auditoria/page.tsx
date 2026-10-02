import type { Metadata } from "next";
import Portal from "./portal";
export const metadata: Metadata = {
  title: "Envio de documentos | RBK Digital",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <Portal />;
}
