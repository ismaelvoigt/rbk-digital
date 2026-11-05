# Recebimento de ZIP e RAR em auditorias

No portal de envio da farmácia, o seletor passa a aceitar PDF, JPG/JPEG, PNG, TIF/TIFF, ZIP e RAR. ZIP e RAR são recebidos como arquivos únicos e preservados sem extração automática. Os limites continuam em100MiB por arquivo,100 arquivos e1GiB por lote. Ofícios continuam com os formatos anteriores.

A autorização de envio, hashes para duplicidade, upload retomável e confirmação efetiva do Storage antes de concluir o lote permanecem iguais. O MIME canônico de RAR é application/vnd.rar, independentemente do MIME indicado pelo navegador. O bucket privado e a validação SQL foram atualizados exclusivamente no desenvolvimento.

Para conferir: selecionar um ZIP e um RAR pequenos junto de PDF/JPG/PNG/TIFF; enviar; aguardar confirmação; baixar os arquivos e comparar tamanho/conteúdo. Testar interrupção e retomada; arquivo acima de100MiB deve ser recusado. Compactado não é contado como seus arquivos internos: conta como um documento recebido.

Validação automatizada:35 testes de domínio, SQL, upload, assinatura e ZIP passaram; lint e build passaram. Teste SQL confirma que iniciar lote com ZIP não permite concluir antes do recebimento dos bytes. Revisão independente sem bloqueadores.

Produção depende de publicação específica; migração atual aplicada somente em ympeqcycjadvvumanmwm.
