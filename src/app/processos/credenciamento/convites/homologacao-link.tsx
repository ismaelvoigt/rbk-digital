'use client';

import { useEffect, useState } from 'react';
import { invitationEntry } from '../../../../lib/credenciamento/navigation';

export default function HomologacaoLink() {
  const [href, setHref] = useState(invitationEntry(''));
  useEffect(() => {
    const destination = invitationEntry(window.location.origin);
    setHref(destination);
    window.location.replace(destination);
  }, []);
  return (
    <main className="rbk-shell min-h-screen">
      <div className="rbk-container py-8">
        <p role="status">Abrindo credenciamento…</p>
        <a href={href} className="mt-4 inline-block text-red-600">
          Continuar para novo credenciamento
        </a>
      </div>
    </main>
  );
}
