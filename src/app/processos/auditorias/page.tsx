import { Suspense } from "react";
import Audits from "./audits";
export default function Page() {
  return (
    <Suspense fallback={<p>Carregando auditorias…</p>}>
      <Audits />
    </Suspense>
  );
}
