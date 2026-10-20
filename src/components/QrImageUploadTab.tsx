import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon,
  AlertCircle,
  Sparkles,
  Trash2,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { QrScanDetection, scanImageSourceForQr } from '../utils/qrHelper';
import { copyFullUrlToClipboard } from '../utils/clipboard';
import {
  extractUrlParametersList,
  resolveRealRedirectUrl,
} from '../utils/presetParser';

interface QrImageUploadTabProps {
  onQrImageExtracted: (info: {
    title: string;
    sourceLabel: string;
    detection: QrScanDetection;
  }) => void;
}

export const QrImageUploadTab: React.FC<QrImageUploadTabProps> = ({
  onQrImageExtracted,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isResolvingAlight, setIsResolvingAlight] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [detection, setDetection] = useState<QrScanDetection | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'raw' | 'resolved' | null>(null);

  const resolveShortlinkIfNeeded = useCallback(
    async (scannedDetection: QrScanDetection, labelName: string) => {
      if (
        !scannedDetection.isAlightShortlink ||
        scannedDetection.resolvedAlightCreativeUrl
      ) {
        return;
      }

      setIsResolvingAlight(true);
      setDetection((prev) =>
        prev ? { ...prev, resolveStatus: 'resolving' } : prev
      );

      const resolved = await resolveRealRedirectUrl(
        scannedDetection.rawPayload
      );
      setIsResolvingAlight(false);

      const updated: QrScanDetection = {
        ...scannedDetection,
        resolvedAlightCreativeUrl: resolved.resolved
          ? resolved.resolvedUrl
          : undefined,
        resolveStatus: resolved.resolved ? 'resolved' : 'unverified',
      };
      setDetection(updated);
      onQrImageExtracted({
        title: labelName,
        sourceLabel: 'Screenshot Galeri QR',
        detection: updated,
      });
    },
    [onQrImageExtracted]
  );

  const processImageDataUrl = async (dataUrl: string, labelName: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setDetection(null);
    setFileName(labelName);

    try {
      const result = await scanImageSourceForQr(dataUrl);
      setPreviewUrl(result.annotatedDataUrl);

      if (result.detection) {
        setDetection(result.detection);
        onQrImageExtracted({
          title: labelName,
          sourceLabel: 'Screenshot Galeri QR',
          detection: result.detection,
        });

        if (
          result.detection.isAlightShortlink &&
          !result.detection.resolvedAlightCreativeUrl
        ) {
          resolveShortlinkIfNeeded(result.detection, labelName);
        }
      } else {
        setErrorMsg(
          'Kode QR tidak terdeteksi pada gambar ini. Pastikan gambar yang diunggah menampilkan matriks QR Code dengan jelas dan tidak terpotong.'
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memindai gambar QR.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        'Format file tidak didukung. Harap unggah gambar PNG, JPG, atau WEBP.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        processImageDataUrl(reader.result, file.name);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file dari perangkat.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelect(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileSelect(file);
          break;
        }
      }
    }
  };

  const handleCopyUrl = async (type: 'raw' | 'resolved', url: string) => {
    await copyFullUrlToClipboard(url);
    setCopiedType(type);
    window.setTimeout(() => {
      setCopiedType((prev) => (prev === type ? null : prev));
    }, 2200);
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setDetection(null);
    setErrorMsg(null);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const activeTargetUrl =
    detection?.resolvedAlightCreativeUrl || detection?.rawPayload || '';
  const detectedParams = activeTargetUrl
    ? extractUrlParametersList(activeTargetUrl)
    : [];

  const hasResultOrActivity = Boolean(previewUrl || isScanning || errorMsg);

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      {/* Upload Box & Instructions (Penunjuk) */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl p-5 sm:p-8 bg-slate-950/60 border border-dashed transition-colors flex flex-col items-center justify-center text-center min-h-[200px] sm:min-h-[240px] ${
            isDragging
              ? 'border-[#00E5A3] bg-[#00E5A3]/10'
              : 'border-white/15 hover:border-[#00E5A3]/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            id="qr-image-upload-input"
            onChange={(e) => handleFileSelect(e.target.files?.[0])}
            className="sr-only"
          />

          <div className="w-11 h-11 rounded-xl bg-[#00E5A3]/15 border border-[#00E5A3]/30 flex items-center justify-center text-[#00E5A3] mb-3">
            <Upload className="w-5 h-5" aria-hidden="true" />
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            Unggah atau Tarik Screenshot QR Alight Motion
          </h3>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed">
            Pilih gambar tangkapan layar kode QR dari galeri untuk mengekstrak tautan{' '}
            <code className="text-[#00E5A3]">alight.link</code> dan mengubahnya ke format tujuan{' '}
            <code className="text-[#00E5A3]">alightcreative.com</code>.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <label
              htmlFor="qr-image-upload-input"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#00E5A3] text-slate-950 font-semibold text-xs sm:text-sm hover:bg-[#00cca0] transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ImageIcon className="w-4 h-4" aria-hidden="true" />
              <span>Pilih & Cari QR dari Gambar</span>
            </label>

            {hasResultOrActivity && (
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sembunyikan & Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Penunjuk Penggunaan Scan Gambar QR — Flexible 3-Column Grid on Mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-950/50 border border-white/[0.06] space-y-1 text-center sm:text-left">
            <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3]">
              1. Siapkan QR
            </div>
            <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
              Ambil tangkapan layar kode QR preset Alight Motion dari video TikTok, Instagram, atau YouTube.
            </p>
          </div>
          <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-950/50 border border-white/[0.06] space-y-1 text-center sm:text-left">
            <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3]">
              2. Pilih Gambar
            </div>
            <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
              Klik tombol <strong>Pilih & Cari QR dari Gambar</strong> atau tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 font-mono text-[11px] text-slate-300">Ctrl+V</kbd>.
            </p>
          </div>
          <div className="p-2.5 sm:p-3.5 rounded-xl bg-slate-950/50 border border-white/[0.06] space-y-1 text-center sm:text-left">
            <div className="text-[11px] sm:text-xs font-semibold text-[#00E5A3]">
              3. Buka Preset
            </div>
            <p className="hidden sm:block text-xs text-slate-400 leading-relaxed">
              Hasil ekstraksi URL utuh baru ditampilkan secara otomatis setelah gambar QR dipindai.
            </p>
          </div>
        </div>
      </div>

      {/* Decoded Result & Annotated Preview (Hidden automatically until an image is scanned) */}
      {hasResultOrActivity && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#00E5A3]" aria-hidden="true" />
              <span className="text-sm font-semibold text-white">
                Hasil Pencarian & Dekode Kode QR
              </span>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#00E5A3]">
              {isScanning
                ? 'Memindai piksel...'
                : detection
                ? 'QR Valid Terdeteksi'
                : 'Gagal Mendeteksi QR'}
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {previewUrl && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0">
              <div className="lg:col-span-5 min-w-0 relative rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center p-3">
                <img
                  src={previewUrl}
                  alt={fileName || 'Pratinjau screenshot QR Alight Motion'}
                  referrerPolicy="no-referrer"
                  className="max-h-[220px] w-auto object-contain rounded-lg"
                />
              </div>

              {detection && (
                <div className="lg:col-span-7 min-w-0 max-w-full overflow-hidden space-y-3">
                  {/* 1. Raw Exact URL from QR */}
                  <div className="p-3.5 rounded-xl bg-slate-950/85 border border-white/15 space-y-2 min-w-0 max-w-full overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-400">
                      <span>Teks URL Asli di Dalam QR Code (Utuh):</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {detection.rawPayload.length} karakter
                      </span>
                    </div>

                    <a
                      href={detection.rawPayload}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="url-wrap-box block w-full p-2.5 rounded-lg bg-slate-900/95 border border-white/10 font-mono text-xs font-medium text-white hover:text-[#00E5A3] hover:border-[#00E5A3]/40 transition-colors leading-relaxed select-all"
                    >
                      {detection.rawPayload}
                    </a>
                  </div>

                  {/* 2. Resolved alightcreative.com/am/share/u/.../p/... URL if shortlink */}
                  {detection.isAlightShortlink && (
                    <div className="p-3.5 rounded-xl bg-slate-950/85 border border-[#00E5A3]/35 space-y-2 min-w-0 max-w-full overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
                        <span className="text-slate-200 font-medium flex items-center gap-1 min-w-0">
                          <ArrowRight className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" aria-hidden="true" />
                          <span className="truncate">URL Tujuan (`alightcreative.com`):</span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            resolveShortlinkIfNeeded(detection, fileName)
                          }
                          disabled={isResolvingAlight}
                          className="text-[11px] font-semibold text-[#00E5A3] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isResolvingAlight ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>
                            {isResolvingAlight ? 'Meresolve...' : 'Resolve Ulang'}
                          </span>
                        </button>
                      </div>

                      {detection.resolvedAlightCreativeUrl ? (
                        <a
                          href={detection.resolvedAlightCreativeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="url-wrap-box block w-full p-2.5 rounded-lg bg-slate-900/95 border border-[#00E5A3]/30 font-mono text-xs font-semibold text-[#00E5A3] hover:underline leading-relaxed select-all"
                        >
                          {detection.resolvedAlightCreativeUrl}
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400 leading-relaxed url-wrap-box">
                          {isResolvingAlight
                            ? 'Sedang meresolve shortlink alight.link ke https://alightcreative.com/am/share/u/.../p/...'
                            : 'Tidak ditemukan redirect ke alightcreative.com/am/share/. Gunakan URL asli QR di atas.'}
                        </p>
                      )}
                    </div>
                  )}

                  {detectedParams.length > 0 && (
                    <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 min-w-0 max-w-full overflow-hidden">
                      <span className="text-slate-300 font-sans">Parameter Utuh:</span>
                      {detectedParams.map((p, idx) => (
                        <React.Fragment key={`imgqr-param-${p.key}-${idx}`}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span className="url-wrap-box">
                            {p.key}=<span className="text-[#00E5A3]">{p.value}</span>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2 min-w-0 max-w-full">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                      <a
                        href={activeTargetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 px-4 py-2.5 rounded-lg bg-[#00E5A3] text-slate-950 hover:bg-[#00cca0] font-semibold text-xs text-center transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">Buka di Alight Motion</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleCopyUrl('raw', detection.rawPayload)}
                        className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedType === 'raw' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#00E5A3] shrink-0" aria-hidden="true" />
                            <span className="text-[#00E5A3] font-semibold">URL Asli Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Salin URL Asli QR</span>
                          </>
                        )}
                      </button>
                    </div>

                    {detection.resolvedAlightCreativeUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyUrl('resolved', detection.resolvedAlightCreativeUrl!)
                        }
                        className="w-full min-w-0 px-3 py-2 rounded-lg bg-[#00E5A3]/15 hover:bg-[#00E5A3]/25 border border-[#00E5A3]/40 text-[#00E5A3] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {copiedType === 'resolved' ? (
                          <>
                            <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">URL alightcreative.com Tersalin Utuh</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">Salin URL Tujuan (alightcreative.com)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
