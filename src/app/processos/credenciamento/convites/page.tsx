import { assertStaging } from '../../../../lib/auditoria/server';
import ConvitesClient from './convites-client';
import HomologacaoLink from './homologacao-link';

export const dynamic = 'force-dynamic';

export default function Credenciamento() {
  // Use the same environment gate as the invitation API before mounting its form.
  let localAvailable = false;
  try {
    assertStaging();
    localAvailable = true;
  } catch {
    // Existing test records belong to the separate, already published environment.
  }
  if (localAvailable) return <ConvitesClient />;

  return <HomologacaoLink />;
}
