/* eslint-disable formatjs/no-literal-string-in-jsx */
/* eslint-disable react/prop-types */
import { useCallback, useMemo, useState } from "react";
import { Button, Rows, Text, LoadingIndicator } from "@canva/app-ui-kit";
import { requestExport, getDesignToken } from "@canva/design";
import { auth } from "@canva/user";
import { requestOpenExternalUrl } from "@canva/platform";

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
  error?: string;
};

export function App() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultInfo, setResultInfo] = useState<ExportResponse | null>(null);
  const [title, setTitle] = useState<string>("");

  // Fixos conforme pedido
  const modelo = "2 Canecas Padrão";
  const cor = "Branca";

  // -------------- helpers --------------
  const formatBytes = (value?: number) => {
    if (typeof value !== "number" || !isFinite(value)) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let v = value;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
  };

  const formatMs = (ms?: number) => {
    if (typeof ms !== "number" || !isFinite(ms)) return "—";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const s = ms / 1000;
    return `${s.toFixed(s >= 10 ? 1 : 2)} s`;
  };

  // -------------- styles --------------
  const SP = 12; // spacing unit
  const appStyle: React.CSSProperties = {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: SP,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 180px) 1fr",
    rowGap: 6,
    columnGap: 10,
    alignItems: "start",
  };

  // -------------- small UI components --------------
  const DetailRow: React.FC<{
    label: string;
    value?: React.ReactNode;
    code?: boolean;
  }> = ({ label, value, code }) => (
    <>
      <Text variant="bold">{label}</Text>

      {code ? (
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          <Text>{value ?? "—"}</Text>
        </div>
      ) : (
        <Text>{value ?? "—"}</Text>
      )}
    </>
  );

  const StateBlock: React.FC<{ text: string }> = ({ text }) => (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <LoadingIndicator />
      <Text>{text}</Text>
    </div>
  );

  // -------------- computed --------------
  // helper pra montar a URL com qualquer título
  const buildMockupUrl = (artTitle?: string) => {
    const finalTitle = (artTitle && artTitle.trim()) || title || "arte";
    return (
      "https://admin.levebrasa.com/internal/mockup" +
      `?modelo=${encodeURIComponent(modelo)}` +
      `&arte=${encodeURIComponent(finalTitle)}` +
      `&cor=${encodeURIComponent(cor)}`
    );
  };

  // mantém seu memo para o botão manual (usa o state `title`)
  const mockupUrl = useMemo(() => buildMockupUrl(), [title, modelo, cor]);

  const openMockup = useCallback(async () => {
    await requestOpenExternalUrl({ url: mockupUrl });
  }, [mockupUrl]);

  // -------------- actions --------------
  const handleExportAndSend = useCallback(async () => {
    setErrorMessage(null);
    setResultInfo(null);
    setLoading(true);

    try {
      // 1) Export dialog (Canva)
      const result = await requestExport({ acceptedFileTypes: ["png"] });

      // usuário pode cancelar
      if (result.status !== "completed") {
        setLoading(false);
        return;
      }

      setTitle(result.title || "arte");

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

      if (resp.ok && json?.ok) {
        // 3) Abre o mockup oficialmente (sem window.open)
        try {
          await requestOpenExternalUrl({ url: buildMockupUrl(result.title) });
        } catch {
          // fallback: botão visível na UI
        }
      } else {
        setErrorMessage(json?.error || "Falha ao enviar a arte.");
      }
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMessage(err?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, [mockupUrl]);

  const reset = useCallback(() => {
    setErrorMessage(null);
    setResultInfo(null);
    setTitle("");
  }, []);

  // -------------- render --------------
  return (
    <div style={appStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <Text size="large" variant="bold">
          Brasa • Export & Mockup
        </Text>
        <Text>
          Otimizamos sua arte (largura máx. 1000 px) e salvamos com segurança.
          Em seguida, abrimos o mockup pra você conferir.
        </Text>
      </div>

      {/* Estados */}
      {loading ? (
        <StateBlock text="Exportando e salvando…" />
      ) : errorMessage ? (
        <>
          <Text variant="bold">Ops! Algo deu errado</Text>
          <Text>{errorMessage}</Text>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={handleExportAndSend}>
              Tentar novamente
            </Button>
            <Button variant="secondary" onClick={reset}>
              Limpar
            </Button>
          </div>
        </>
      ) : resultInfo?.ok ? (
        <>
          <Text size="large" variant="bold">
            Prontinho! Sua arte foi enviada
          </Text>
          <Text>
            Link temporário gerado e arquivo salvo no Storage. Você pode abrir o
            mockup agora.
          </Text>
          <div style={{ marginTop: 2 }}>
            <Text variant="bold">Detalhes do envio</Text>
          </div>

          <div style={gridStyle}>
            <DetailRow label="Arte:" value={title} />
            <DetailRow label="Tamanho:" value={formatBytes(resultInfo.size)} />
            <DetailRow
              label="Formato (saída):"
              value={resultInfo.contentTypeOut}
            />
            <DetailRow
              label="Tempo total:"
              value={formatMs(resultInfo?.timings?.totalMs)}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={openMockup}>
              Abrir mockup
            </Button>
            <Button variant="secondary" onClick={reset}>
              Tentar novamente
            </Button>
          </div>
        </>
      ) : (
        <Rows spacing="2u">
          <Button
            variant="primary"
            onClick={handleExportAndSend}
            disabled={loading}
          >
            Exportar e enviar
          </Button>
        </Rows>
      )}
    </div>
  );
}
