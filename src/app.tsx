import { useState } from "react";
import { Button, Rows, Text, LoadingIndicator } from "@canva/app-ui-kit";
import { requestExport, getDesignToken } from "@canva/design";
import { auth } from "@canva/user";
import { defineMessages, useIntl } from "react-intl";
import { requestOpenExternalUrl } from "@canva/platform";

// Mensagens sem id manual (formatjs/no-id ok) e com description (enforce-description ok)
const messages = defineMessages({
  exportButton: {
    defaultMessage: "Exportar e enviar",
    description:
      "Botão que exporta a arte atual do Canva e envia para a API da Brasa",
  },
  exporting: {
    defaultMessage: "Exportando e salvando…",
    description: "Texto exibido enquanto está processando",
  },
  successTitle: {
    defaultMessage: "Prontinho! Sua arte foi enviada",
    description: "Título de sucesso após upload",
  },
  successBody: {
    defaultMessage:
      "Salvo com sucesso! Você já pode abrir o mockup para conferir.",
    description: "Descrição após sucesso",
  },
  openMockup: {
    defaultMessage: "Abrir mockup em nova aba",
    description: "Rótulo do botão que abre o mockup",
  },
  tryAgain: {
    defaultMessage: "Tentar novamente",
    description: "Botão de tentar novamente após erro",
  },
  errorTitle: {
    defaultMessage: "Ops! Algo deu errado",
    description: "Título exibido no estado de erro",
  },
  exportTitle: {
    defaultMessage: "Brasa • Export & Mockup",
    description: "Título da página",
  },
  clear: {
    defaultMessage: "Limpar",
    description: "Botão de limpar",
  },
  empty: {
    defaultMessage: "—",
    description: "Vazio",
  },
});

const API_BASE = "https://admin.levebrasa.com";

type ExportResponse = {
  ok: boolean;
  path: string;
  url: string;
  requestId?: string;
  bucket?: string;
  size?: number;
  contentTypeOut?: string;
  timings?: { totalMs?: number };
};

export function App() {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<ExportResponse | null>(null);
  const [title, setTitle] = useState<string>("");

  // Parâmetros fixos pro mockup
  const modelo = "2 Canecas Padrão";
  const cor = "Branca";

  const mockupUrl = (titleParam?: string) => {
    return (
      "https://admin.levebrasa.com/internal/mockup" +
      `?modelo=${encodeURIComponent(modelo)}` +
      `&arte=${encodeURIComponent(titleParam || title || "arte")}` +
      `&cor=${encodeURIComponent(cor)}`
    );
  };

  async function handleExportAndSend() {
    setErrorMessage(null);
    setResultInfo(null);
    setLoading(true);

    const t0 = Date.now();
    try {
      // 1) Abre export dialog
      const result = await requestExport({
        acceptedFileTypes: ["png"], // adicione "jpg"/"pdf_standard" se quiser
      });

      // usuário pode cancelar
      if (result.status !== "completed") {
        setLoading(false);
        return;
      }

      setTitle(result.title || "arte"); // Canva já envia sem extensão

      const userToken = await auth.getCanvaUserToken();
      const designToken = await getDesignToken();

      // 2) Envia para sua API
      const resp = await fetch(`${API_BASE}/api/canva/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          title: result.title,
          files: result.exportBlobs,
          designToken,
        }),
      });

      const json: ExportResponse = await resp.json();
      setResultInfo(json);

      // Logs estruturados (Vercel-friendly)
      // eslint-disable-next-line no-console
      console.info(
        JSON.stringify({
          level: "info",
          msg: "canva-export-finished",
          ok: json?.ok,
          status: resp.status,
          requestId: json?.requestId,
          timings: json?.timings,
          path: json?.path,
          bucket: json?.bucket,
          elapsedMs: Date.now() - t0,
        }),
      );

      // 3) Se deu tudo certo, tenta abrir o mockup
      if (resp.ok && json?.ok) {
        try {
          requestOpenExternalUrl({ url: mockupUrl(result.title) });
        } catch {
          // se o popup for bloqueado, o botão de fallback aparece na UI
        }
      } else {
        setErrorMessage(
          (json as unknown as { error: string })?.error ||
            "Falha ao enviar a arte.",
        );
      }
    } catch (errorP: unknown) {
      const error = errorP as Error;

      setErrorMessage(error?.message || "Erro inesperado.");
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: "error",
          msg: "canva-export-error",
          error: error?.message || String(error),
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setErrorMessage(null);
    setResultInfo(null);
    setTitle("");
  }

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Text size="large" variant="bold">
          {intl.formatMessage(messages.exportTitle)}
        </Text>
      </div>

      {/* Conteúdo por estado */}
      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <LoadingIndicator />
          <Text>{intl.formatMessage(messages.exporting)}</Text>
        </div>
      ) : errorMessage ? (
        <div
          style={{
            border: "1px solid rgba(255,0,0,0.2)",
            background: "rgba(255,0,0,0.06)",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Text variant="bold">{intl.formatMessage(messages.errorTitle)}</Text>
          <Text>{errorMessage}</Text>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={handleExportAndSend}>
              {intl.formatMessage(messages.tryAgain)}
            </Button>
            <Button variant="secondary" onClick={reset}>
              {intl.formatMessage(messages.clear)}
            </Button>
          </div>
        </div>
      ) : resultInfo?.ok ? (
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(0,0,0,0.03)",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Text size="large" variant="bold">
            {intl.formatMessage(messages.successTitle)}
          </Text>
          <Text>{intl.formatMessage(messages.successBody)}</Text>

          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="primary"
              onClick={() => {
                try {
                  requestOpenExternalUrl({ url: mockupUrl() });
                } catch {
                  // Do nothing
                }
              }}
            >
              {intl.formatMessage(messages.openMockup)}
            </Button>
            <Button variant="secondary" onClick={reset}>
              {intl.formatMessage(messages.tryAgain)}
            </Button>
          </div>
        </div>
      ) : (
        <Rows spacing="2u">
          <Button variant="primary" onClick={handleExportAndSend}>
            {intl.formatMessage(messages.exportButton)}
          </Button>
        </Rows>
      )}
    </div>
  );
}
