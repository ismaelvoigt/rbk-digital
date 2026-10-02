"use client";

import { useEffect, useState } from "react";
import { retornoFarmacias } from "./navegacao";

export function useRetornoFarmacias() {
  const [retorno, setRetorno] = useState("/usuarios");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setRetorno(retornoFarmacias(window.location.search));
    });
    return () => { active = false; };
  }, []);
  return retorno;
}
