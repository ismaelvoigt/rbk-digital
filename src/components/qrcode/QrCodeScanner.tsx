"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type QrCodeScannerProps = {
  onClose: () => void;
};

function ehUrl(valor: string) {
  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function QrCodeScanner({ onClose }: QrCodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [resultado, setResultado] = useState("");
  const [erro, setErro] = useState("");
  const [iniciando, setIniciando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  async function pararScanner() {
    const scanner = scannerRef.current;

    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Scanner já pode estar parado.
    }

    try {
      scanner.clear();
    } catch {
      // Scanner já pode ter sido limpo.
    }

    scannerRef.current = null;
  }

  async function iniciarScanner() {
    setErro("");
    setResultado("");
    setCopiado(false);
    setIniciando(true);

    try {
      await pararScanner();

      const scanner = new Html5Qrcode("rbk-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const tamanho = Math.floor(
              Math.min(viewfinderWidth, viewfinderHeight) * 0.72
            );

            return {
              width: tamanho,
              height: tamanho,
            };
          },
        },
        async (decodedText) => {
          setResultado(decodedText);
          setErro("");
          setIniciando(false);

          await pararScanner();
        },
        () => {
          // Enquanto não encontrar QR Code, continua procurando.
        }
      );

      setIniciando(false);
    } catch (error) {
      console.error(error);
      setIniciando(false);
      setErro(
        "Não foi possível acessar a câmera. Verifique a permissão ou escolha uma imagem com QR Code."
      );
    }
  }

  useEffect(() => {
    void iniciarScanner();

    return () => {
      void pararScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lerImagem(file: File | null) {
    if (!file) return;

    setErro("");
    setResultado("");
    setCopiado(false);
    setIniciando(true);

    try {
      await pararScanner();

      const scanner = new Html5Qrcode("rbk-qr-reader");
      scannerRef.current = scanner;

      const decodedText = await scanner.scanFile(file, true);

      setResultado(decodedText);
      setIniciando(false);

      try {
        scanner.clear();
      } catch {
        // Sem ação.
      }

      scannerRef.current = null;
    } catch (error) {
      console.error(error);
      setIniciando(false);
      setErro(
        "Não foi possível identificar um QR Code nessa imagem. Tente outra foto."
      );
    }
  }

  async function copiarResultado() {
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);

      window.setTimeout(() => {
        setCopiado(false);
      }, 2000);
    } catch {
      setErro("Não foi possível copiar o conteúdo.");
    }
  }

  async function fechar() {
    await pararScanner();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-5">
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">

        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">
              RBK Digital
            </p>

            <h2 className="mt-1 text-xl font-bold text-gray-900">
              Ler QR Code
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Aponte a câmera para o código.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fechar()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600"
            aria-label="Fechar leitor"
          >
            ×
          </button>
        </div>

        <div className="p-5">

          {!resultado && (
            <>
              <div className="overflow-hidden rounded-2xl bg-black">
                <div
                  id="rbk-qr-reader"
                  className="min-h-[280px] w-full"
                />
              </div>

              {iniciando && (
                <p className="mt-3 text-center text-sm font-medium text-gray-500">
                  Preparando câmera...
                </p>
              )}

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />

                <span className="text-xs font-bold uppercase text-gray-400">
                  ou
                </span>

                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <label className="flex w-full cursor-pointer items-center justify-center rounded-[13px] border border-gray-200 bg-white px-5 py-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50">
                Escolher imagem com QR Code

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    void lerImagem(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </>
          )}

          {erro && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
              {erro}
            </div>
          )}

          {resultado && (
            <div>
              <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white font-bold text-green-600">
                  ✓
                </div>

                <div>
                  <p className="font-bold text-green-800">
                    QR Code identificado
                  </p>

                  <p className="mt-1 text-xs text-green-700">
                    {ehUrl(resultado)
                      ? "O conteúdo identificado é um link."
                      : "Conteúdo lido com sucesso."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Conteúdo
                </p>

                <p className="mt-2 break-all text-sm leading-6 text-gray-800">
                  {resultado}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                {ehUrl(resultado) && (
                  <a
                    href={resultado}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rbk-primary rounded-[13px] px-5 py-4 text-center text-sm font-bold"
                  >
                    Abrir link
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => void copiarResultado()}
                  className="rounded-[13px] border border-gray-200 bg-white px-5 py-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  {copiado ? "Conteúdo copiado ✓" : "Copiar conteúdo"}
                </button>

                <button
                  type="button"
                  onClick={() => void iniciarScanner()}
                  className="rounded-[13px] border border-gray-200 bg-white px-5 py-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  Ler outro QR Code
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
