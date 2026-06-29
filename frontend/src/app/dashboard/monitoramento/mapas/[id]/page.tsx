"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamicImport from "next/dynamic";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { connectMonitoringSocket, disconnectMonitoringSocket, type StatusChange } from "@/lib/monitoringSocket";
import { ChevronLeft, Save, Plus, Image as ImgIcon } from "lucide-react";

// Konva: client-only — Next bail-out to CSR
const Stage  = dynamicImport(() => import("react-konva").then(m => m.Stage),  { ssr: false });
const Layer  = dynamicImport(() => import("react-konva").then(m => m.Layer),  { ssr: false });
const Circle = dynamicImport(() => import("react-konva").then(m => m.Circle), { ssr: false });
const Rect   = dynamicImport(() => import("react-konva").then(m => m.Rect),   { ssr: false });
const KText  = dynamicImport(() => import("react-konva").then(m => m.Text),   { ssr: false });
const KImage = dynamicImport(() => import("react-konva").then(m => m.Image),  { ssr: false });

type Pos = {
  id?: string; assetId: string; x: number; y: number; z?: number; width?: number; height?: number; rotulo?: string;
  asset?: { id: string; nome: string; ip: string; categoria: string; ultimoStatus: string; ultimaLatenciaMs: number | null };
};
type Asset = { id: string; nome: string; ip: string; categoria: string; ultimoStatus: string };

const STATUS_COLOR: Record<string, string> = {
  ONLINE: "#22c55e", OFFLINE: "#ef4444", INSTAVEL: "#f59e0b", NAO_MONITORADO: "#94a3b8",
};

export default function MapaEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [mapa, setMapa]         = useState<any>(null);
  const [positions, setPositions]= useState<Pos[]>([]);
  const [allAssets, setAllAssets]= useState<Asset[]>([]);
  const [dirty, setDirty]       = useState(false);
  const [bgImg, setBgImg]       = useState<HTMLImageElement | null>(null);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize]         = useState({ w: 1200, h: 700 });

  const load = useCallback(async () => {
    const [m, a] = await Promise.all([api.get(`/monitoramento/mapas/${id}`), api.get("/monitoramento/assets")]);
    setMapa(m.data);
    setPositions(m.data.positions || []);
    setAllAssets(a.data);
    if (m.data.backgroundUrl) {
      const img = new window.Image();
      img.src = m.data.backgroundUrl;
      img.onload = () => setBgImg(img);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Tamanho responsivo do palco
  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: Math.max(500, el.clientHeight) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // WS: atualizar status dos icones em tempo real
  useEffect(() => {
    const sock = connectMonitoringSocket();
    const onStatus = (ev: StatusChange) => {
      setPositions(prev => prev.map(p => p.assetId === ev.assetId && p.asset
        ? { ...p, asset: { ...p.asset, ultimoStatus: ev.novo } }
        : p));
    };
    sock.on("status_change", onStatus);
    return () => { sock.off("status_change", onStatus); disconnectMonitoringSocket(); };
  }, []);

  const addAsset = (assetId: string) => {
    if (positions.find(p => p.assetId === assetId)) return;
    const a = allAssets.find(x => x.id === assetId);
    if (!a) return;
    setPositions(prev => [...prev, { assetId, x: 50, y: 50, asset: { ...a, ultimaLatenciaMs: null } as any }]);
    setDirty(true);
  };

  const onDrag = (assetId: string, x: number, y: number) => {
    setPositions(prev => prev.map(p => p.assetId === assetId ? { ...p, x, y } : p));
    setDirty(true);
  };

  const save = async () => {
    await api.put(`/monitoramento/mapas/${id}/positions`, {
      positions: positions.map(p => ({ assetId: p.assetId, x: p.x, y: p.y, z: p.z||0, width: p.width||40, height: p.height||40, rotulo: p.rotulo||null })),
    });
    setDirty(false);
  };

  const uploadBg = async (file: File) => {
    // Por simplicidade: base64 inline no campo backgroundUrl. Producao real subiria pro upload service.
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await api.patch(`/monitoramento/mapas/${id}`, { backgroundUrl: dataUrl });
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => setBgImg(img);
    };
    reader.readAsDataURL(file);
  };

  const naoNoMapa = allAssets.filter(a => !positions.find(p => p.assetId === a.id));

  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: 24 }}>
        <Link href="/dashboard/monitoramento/mapas" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={12} style={{ display: "inline" }} /> Mapas
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)" }}>{mapa?.nome || "..."}</h1>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{positions.length} equipamentos no mapa</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn btn-ghost" style={{ fontSize: 12, cursor: "pointer" }}>
              <ImgIcon size={14} style={{ marginRight: 4 }} /> Background
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadBg(e.target.files[0])} />
            </label>
            <button className="btn btn-violet" onClick={save} disabled={!dirty}>
              <Save size={14} style={{ marginRight: 4 }} /> {dirty ? "Salvar layout" : "Salvo"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, alignItems: "start" }}>
          <div ref={stageWrapRef} className="card" style={{ padding: 0, overflow: "hidden", minHeight: 500, background: "#0f0f12" }}>
            <Stage width={size.w} height={size.h} style={{ display: "block" }}>
              <Layer>
                {bgImg && <KImage image={bgImg} width={size.w} height={size.h} opacity={0.5} />}
                {positions.map(p => {
                  const cor = STATUS_COLOR[p.asset?.ultimoStatus || "NAO_MONITORADO"];
                  return (
                    <KGroup key={p.assetId} pos={p} cor={cor} onDrag={(x, y) => onDrag(p.assetId, x, y)} />
                  );
                })}
              </Layer>
            </Stage>
          </div>

          <div className="card" style={{ padding: 14, maxHeight: size.h, overflow: "auto" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: 8 }}>EQUIPAMENTOS FORA DO MAPA</div>
            {naoNoMapa.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Todos no mapa.</div>}
            {naoNoMapa.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{a.nome}</span>
                <button className="btn-icon" title="Adicionar" onClick={() => addAsset(a.id)}><Plus size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// Konva Group (texto + dot)
function KGroup({ pos, cor, onDrag }: { pos: Pos; cor: string; onDrag: (x: number, y: number) => void }) {
  return (
    <>
      <Circle x={pos.x} y={pos.y} radius={14} fill={cor} stroke="#fff" strokeWidth={2}
              draggable onDragEnd={(e: any) => onDrag(e.target.x(), e.target.y())} />
      <KText x={pos.x + 18} y={pos.y - 6} text={pos.asset?.nome || ""} fill="#fff" fontSize={11} listening={false} />
    </>
  );
}
