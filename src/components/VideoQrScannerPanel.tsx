import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  ExternalLink,
  Copy,
  Check,
  ScanLine,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { QrScanDetection, scanCanvasForQr } from '../utils/qrHelper';
import { SocialVideoData } from '../utils/tikwmApi';
import { copyFullUrlToClipboard } from '../utils/clipboard';
import {
  extractUrlParametersList,
  resolveRealRedirectUrl,
} from '../utils/presetParser';
import { CardCornerWatermark } from './AmLogoWatermark';
import { liquidPointerHandlers } from '../utils/liquidGlass';

interface VideoQrScannerPanelProps {
  videoData: SocialVideoData;
  autoStartScan?: boolean;
  onQrDetected: (detection: QrScanDetection) => void;
}

export const VideoQrScannerPanel: React.FC<VideoQrScannerPanelProps> = ({
  videoData,
  autoStartScan = true,
  onQrDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const onQrDetectedRef = useRef(onQrDetected);
  onQrDetectedRef.current = onQrDetected;

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [framesScanned, setFramesScanned] = useState<number>(0);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(videoData.durationSec || 0);
  const [detectedQr, setDetectedQr] = useState<QrScanDetection | null>(null);
  const [isResolvingAlight, setIsResolvingAlight] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<'raw' | 'resolved' | null>(null);

  const stopScannerLoop = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setIsScanning(false);
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {
        // Ignore
      }
    }
  }, []);

  const triggerAlightShortlinkResolve = useCallback(
    async (detection: QrScanDetection) => {
      if (!detection.isAlightShortlink || detection.resolvedAlightCreativeUrl) {
        return;
      }

      setIsResolvingAlight(true);
      setDetectedQr((prev) =>
        prev ? { ...prev, resolveStatus: 'resolving' } : prev
      );

      const res = await resolveRealRedirectUrl(detection.rawPayload);
      setIsResolvingAlight(false);

      const updated: QrScanDetection = {
        ...detection,
        resolvedAlightCreativeUrl: res.resolved ? res.resolvedUrl : undefined,
        resolveStatus: res.resolved ? 'resolved' : 'unverified',
      };
      setDetectedQr(updated);
      onQrDetectedRef.current(updated);
    },
    []
  );

  const scanCurrentVideoFrame = useCallback((): boolean => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      return false;
    }

    const vWidth = video.videoWidth || 480;
    const vHeight = video.videoHeight || 640;
    const scale = Math.min(1, 720 / Math.max(vWidth, vHeight));
    const targetW = Math.max(240, Math.round(vWidth * scale));
    const targetH = Math.max(240, Math.round(vHeight * scale));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    try {
      ctx.drawImage(video, 0, 0, targetW, targetH);
      const nowSec = Number(video.currentTime.toFixed(2));
      setCurrentTimestamp(nowSec);
      setFramesScanned((prev) => prev + 1);

      const detection = scanCanvasForQr(ctx, targetW, targetH, nowSec);
      if (detection) {
        setDetectedQr(detection);
        stopScannerLoop();
        onQrDetectedRef.current(detection);

        if (detection.isAlightShortlink && !detection.resolvedAlightCreativeUrl) {
          triggerAlightShortlinkResolve(detection);
        }
        return true;
      }
    } catch {
      setVideoLoadError(
        'Gagal membaca piksel frame video karena batasan CORS pada sumber stream.'
      );
      stopScannerLoop();
    }
    return false;
  }, [stopScannerLoop, triggerAlightShortlinkResolve]);

  const startVideoQrScan = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    stopScannerLoop();
    setVideoLoadError(null);
    setDetectedQr(null);
    setFramesScanned(0);
    setIsScanning(true);

    if (video.ended || (video.duration && video.currentTime >= video.duration - 0.2)) {
      video.currentTime = 0;
    }

    video.play().catch(() => {});

    scanCurrentVideoFrame();

    scanTimerRef.current = window.setInterval(() => {
      const v = videoRef.current;
      if (!v) return;

      const found = scanCurrentVideoFrame();
      if (found) return;

      if (v.ended || (v.duration > 0 && v.currentTime >= v.duration - 0.1)) {
        stopScannerLoop();
        return;
      }

      if (v.paused && v.readyState >= 2 && v.duration > 0) {
        v.currentTime = Math.min(v.duration, Number((v.currentTime + 0.5).toFixed(2)));
      }
    }, 500);
  }, [scanCurrentVideoFrame, stopScannerLoop]);

  useEffect(() => {
    stopScannerLoop();
    setDetectedQr(null);
    setFramesScanned(0);
    setCurrentTimestamp(0);
    setVideoReady(false);
    setVideoLoadError(null);
    setVideoDuration(videoData.durationSec || 0);
  }, [videoData.id, videoData.proxiedPlayUrl, videoData.durationSec, stopScannerLoop]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoReady(true);
    if (video.duration && Number.isFinite(video.duration)) {
      setVideoDuration(Number(video.duration.toFixed(1)));
    }
  };

  const handleLoadedData = () => {
    setVideoReady(true);
    scanCurrentVideoFrame();
    if (autoStartScan) {
      startVideoQrScan();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const newTime = Number(e.target.value);
    v.currentTime = newTime;
    setCurrentTimestamp(newTime);
  };

  const handleCopyUrl = async (type: 'raw' | 'resolved', url: string) => {
    await copyFullUrlToClipboard(url);
    setCopiedKey(type);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === type ? null : prev));
    }, 2200);
  };

  const activeTargetUrl =
    detectedQr?.resolvedAlightCreativeUrl || detectedQr?.rawPayload || '';
  const qrParams = activeTargetUrl
    ? extractUrlParametersList(activeTargetUrl)
    : [];

  return (
    <div
      id="video-qr-scanner-panel"
      {...liquidPointerHandlers}
      className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 sm:gap-4 overflow-hidden"
    >
      <CardCornerWatermark />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-[#f1f5f9] flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-[#2dd4bf] shrink-0" aria-hidden="true" />
            <span>
              Auto Video QR Scanner
              <span className="hidden sm:inline">
                {' '}
                (jsQR · Frame Video Asli Tiap 0.5 Detik)
              </span>
            </span>
          </h3>
          <p className="hidden sm:block text-xs text-[#94a3b8] mt-0.5">
            Memindai piksel frame video TikTok asli secara langsung dan mengekstrak teks URL QR Code apa adanya tanpa dimodifikasi.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          {isScanning ? (
            <button
              type="button"
              {...liquidPointerHandlers}
              onClick={stopScannerLoop}
              className="liquid-btn-primary min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 text-[#2dd4bf] fill-current shrink-0" aria-hidden="true" />
              <span>Hentikan Scan ({currentTimestamp.toFixed(1)}s)</span>
            </button>
          ) : (
            <button
              type="button"
              {...liquidPointerHandlers}
              onClick={startVideoQrScan}
              disabled={!videoReady && !videoData.proxiedPlayUrl}
              className="liquid-btn-primary min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-[#2dd4bf] fill-current shrink-0" aria-hidden="true" />
              <span>Scan QR dari Video</span>
            </button>
          )}

          <button
            type="button"
            {...liquidPointerHandlers}
            onClick={() => scanCurrentVideoFrame()}
            className="liquid-btn-secondary min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pindai Frame Saat Ini
          </button>
        </div>
      </div>

      {videoLoadError && (
        <div
          role="alert"
          className="relative z-10 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
          <span>{videoLoadError}</span>
        </div>
      )}

      {/* Real Video + Canvas Dual Inspection Surface */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch min-w-0">
        <div className="md:col-span-7 min-w-0 flex flex-col gap-2.5">
          <div className="relative rounded-xl overflow-hidden bg-[#0b0c0e] border border-white/[0.08] flex items-center justify-center min-h-[210px] sm:min-h-[260px]">
            <video
              ref={videoRef}
              src={
                videoData.proxiedPlayUrl
                  ? `${videoData.proxiedPlayUrl}&scanner=qr`
                  : ''
              }
              crossOrigin="anonymous"
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={handleLoadedMetadata}
              onLoadedData={handleLoadedData}
              onSeeked={() => scanCurrentVideoFrame()}
              onError={() =>
                setVideoLoadError(
                  'Stream video tidak dapat dimuat. Pastikan link video TikTok valid dan dapat diakses.'
                )
              }
              className="hidden"
              aria-label="Sumber stream video asli untuk pemindaian QR"
            />

            <canvas
              ref={canvasRef}
              width={480}
              height={320}
              data-testid="video-qr-canvas"
              className="w-full h-auto max-h-[240px] sm:max-h-[320px] object-contain block"
            />

            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b0c0e]/90 border border-white/[0.08] text-xs font-mono tabular-nums text-[#94a3b8]">
              <span>
                Posisi: {currentTimestamp.toFixed(1)}s / {videoDuration.toFixed(1)}s
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline text-[#38bdf8]">
                Frame Dipindai: {framesScanned}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  detectedQr
                    ? 'text-[#2dd4bf] font-semibold'
                    : isScanning
                    ? 'text-[#38bdf8]'
                    : 'text-[#94a3b8]'
                }
              >
                {detectedQr
                  ? 'QR Terdeteksi'
                  : isScanning
                  ? 'Memindai (0.5s)'
                  : videoReady
                  ? 'Video Siap'
                  : 'Memuat Video...'}
              </span>
            </div>
          </div>

          <div
            {...liquidPointerHandlers}
            className="glass-subpanel rounded-xl px-3.5 py-2.5 flex items-center gap-3 min-w-0"
          >
            <label
              htmlFor="video-frame-scrubber"
              className="text-xs text-[#94a3b8] whitespace-nowrap shrink-0 font-mono tabular-nums"
            >
              Geser Detik Video:
            </label>
            <input
              id="video-frame-scrubber"
              type="range"
              min={0}
              max={Math.max(1, videoDuration)}
              step={0.5}
              value={currentTimestamp}
              onChange={handleSeekChange}
              className="flex-1 min-w-0 accent-[#2dd4bf] cursor-pointer"
            />
            <span className="text-xs font-mono tabular-nums text-[#2dd4bf] w-12 text-right shrink-0">
              {currentTimestamp.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Decoded QR Output Card */}
        <div
          data-testid="jsqr-decode-status-card"
          {...liquidPointerHandlers}
          className="md:col-span-5 min-w-0 max-w-full overflow-hidden glass-subpanel rounded-xl p-4 flex flex-col justify-between gap-4"
        >
          <div className="space-y-3 min-w-0 max-w-full overflow-hidden">
            <div className="text-xs font-semibold text-[#f1f5f9] font-display tracking-wide border-b border-white/[0.08] pb-2">
              Status Dekode jsQR Frame Video Asli
            </div>

            {detectedQr ? (
              <div className="space-y-3 pt-0.5 min-w-0 max-w-full">
                <div className="text-xs font-medium text-[#2dd4bf]">
                  QR Code ditemukan pada detik ke-{detectedQr.timestampSec.toFixed(1)}s
                </div>

                <div className="p-3 rounded-xl bg-[#0b0c0e]/70 space-y-2 min-w-0 max-w-full overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[#94a3b8]">
                    <span>Teks URL Asli di Dalam QR Code (Utuh):</span>
                    <span className="font-mono tabular-nums text-[#38bdf8]">
                      {detectedQr.rawPayload.length} karakter
                    </span>
                  </div>

                  <a
                    href={detectedQr.rawPayload}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="qr-video-raw-url"
                    className="url-wrap-box block w-full p-2.5 rounded-lg bg-[#0b0c0e]/90 text-xs font-mono text-[#f1f5f9] hover:text-[#2dd4bf] transition-colors leading-relaxed select-all"
                  >
                    {detectedQr.rawPayload}
                  </a>
                </div>

                {detectedQr.isAlightShortlink && (
                  <div className="p-3 rounded-xl bg-[#0b0c0e]/70 space-y-2 min-w-0 max-w-full overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs min-w-0">
                      <span className="text-[#f1f5f9] font-medium flex items-center gap-1 min-w-0">
                        <ArrowRight className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0" aria-hidden="true" />
                        <span className="truncate">URL Tujuan Alight Motion:</span>
                      </span>

                      <button
                        type="button"
                        {...liquidPointerHandlers}
                        onClick={() => triggerAlightShortlinkResolve(detectedQr)}
                        disabled={isResolvingAlight}
                        className="text-[11px] font-semibold text-[#2dd4bf] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isResolvingAlight ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        <span>{isResolvingAlight ? 'Meresolve...' : 'Resolve Ulang'}</span>
                      </button>
                    </div>

                    {detectedQr.resolvedAlightCreativeUrl ? (
                      <a
                        href={detectedQr.resolvedAlightCreativeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="qr-video-resolved-url"
                        className="url-wrap-box block w-full p-2.5 rounded-lg bg-[#0b0c0e]/90 text-xs font-mono font-semibold text-[#2dd4bf] hover:underline leading-relaxed select-all"
                      >
                        {detectedQr.resolvedAlightCreativeUrl}
                      </a>
                    ) : (
                      <p className="text-xs text-[#94a3b8] leading-relaxed url-wrap-box">
                        {isResolvingAlight
                          ? 'Sedang meresolve shortlink alight.link ke format https://alightcreative.com/am/share/u/.../p/...'
                          : 'Shortlink alight.link tidak mengembalikan redirect ke alightcreative.com/am/share/. Gunakan URL asli di atas.'}
                      </p>
                    )}
                  </div>
                )}

                {qrParams.length > 0 && (
                  <div className="text-[11px] text-[#94a3b8] font-mono flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 min-w-0 max-w-full overflow-hidden">
                    <span className="text-[#f1f5f9] font-sans">Parameter:</span>
                    {qrParams.map((p, idx) => (
                      <React.Fragment key={`vqr-param-${p.key}-${idx}`}>
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <span className="url-wrap-box">
                          {p.key}=<span className="text-[#2dd4bf]">{p.value}</span>
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-xs text-[#94a3b8] space-y-2.5 min-w-0 max-w-full overflow-hidden">
                <p className="text-[#f1f5f9] font-medium leading-relaxed">
                  {isScanning
                    ? 'Memindai piksel frame video asli setiap 0.5 detik menggunakan jsQR...'
                    : 'Klik Scan QR dari Video atau geser slider detik ke bagian video yang menampilkan kode QR Alight Motion.'}
                </p>
                <div className="p-3 rounded-xl bg-[#0b0c0e]/70 space-y-1.5 min-w-0 max-w-full overflow-hidden">
                  <p className="text-[#94a3b8] leading-relaxed">
                    Jika di dalam video terdapat QR Code, jsQR mengekstrak teks URL aslinya secara utuh dan meresolve shortlink{' '}
                    <code className="text-[#2dd4bf] font-mono">alight.link</code> ke format tujuan:
                  </p>
                  <code className="url-wrap-box block px-2.5 py-1.5 rounded-lg bg-[#0b0c0e]/90 text-[11px] text-[#38bdf8] font-mono leading-relaxed">
                    https://alightcreative.com/am/share/u/.../p/...
                  </code>
                </div>
              </div>
            )}
          </div>

          {detectedQr ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08] min-w-0 max-w-full">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                <a
                  href={activeTargetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...liquidPointerHandlers}
                  className="liquid-btn-primary flex-1 min-w-0 px-3.5 py-2.5 rounded-xl font-semibold text-xs text-center flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" aria-hidden="true" />
                  <span className="truncate">Buka di Alight Motion</span>
                </a>
                <button
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() => handleCopyUrl('raw', detectedQr.rawPayload)}
                  className="liquid-btn-secondary px-3 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedKey === 'raw' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" aria-hidden="true" />
                      <span className="text-[#2dd4bf] font-semibold">URL Asli Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Salin URL Asli QR</span>
                    </>
                  )}
                </button>
              </div>

              {detectedQr.resolvedAlightCreativeUrl && (
                <button
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={() =>
                    handleCopyUrl('resolved', detectedQr.resolvedAlightCreativeUrl!)
                  }
                  className="liquid-btn-secondary w-full min-w-0 px-3 py-2 rounded-xl text-[#2dd4bf] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'resolved' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" aria-hidden="true" />
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
          ) : (
            <div className="text-xs text-[#94a3b8] border-t border-white/[0.08] pt-3 flex items-center justify-between gap-2 font-mono tabular-nums min-w-0">
              <span className="truncate">Engine: jsQR (Frame Video Asli)</span>
              <span className="shrink-0 text-[#38bdf8]">Interval: 500ms</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
