import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  ExternalLink,
  Copy,
  Check,
  User,
  ScanLine,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SocialVideoData } from '../utils/tikwmApi';
import {
  formatVideoTimestamp,
  buildYouTubeEmbedUrl,
} from '../utils/presetParser';
import { QrScanDetection } from '../utils/qrHelper';
import { copyFullUrlToClipboard } from '../utils/clipboard';
import { CardCornerWatermark } from './AmLogoWatermark';
import { liquidPointerHandlers } from '../utils/liquidGlass';

interface UnifiedVideoCaptionSectionProps {
  videoData: SocialVideoData;
  captionLinksCount: number;
  commentLinksCount: number;
  detectedQr: QrScanDetection | null;
  onJumpToQrScanner?: () => void;
}

const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

export const UnifiedVideoCaptionSection: React.FC<
  UnifiedVideoCaptionSectionProps
> = ({
  videoData,
  captionLinksCount,
  commentLinksCount,
  detectedQr,
  onJumpToQrScanner,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(videoData.durationSec || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [useDirectFallback, setUseDirectFallback] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState<boolean>(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(videoData.durationSec || 0);
    setPlaybackRate(1);
    setUseDirectFallback(false);
    setCopiedCaption(false);
    setIsCaptionExpanded(false);
  }, [videoData.id, videoData.sourceUrl, videoData.durationSec]);

  const effectiveVideoSrc = useDirectFallback
    ? videoData.playUrl
    : videoData.proxiedPlayUrl
    ? `${videoData.proxiedPlayUrl}&player=main`
    : videoData.playUrl;

  const youtubeEmbedUrl =
    videoData.platform === 'youtube'
      ? buildYouTubeEmbedUrl(videoData.id || videoData.sourceUrl)
      : null;

  const handleTogglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      v.play().catch(() => {
        v.muted = true;
        setIsMuted(true);
        v.play().catch(() => {});
      });
    } else {
      v.pause();
    }
  };

  const handleRestartVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setCurrentTime(0);
    if (v.paused) {
      v.play().catch(() => {});
    }
  };

  const handleToggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const nextVol = Number(e.target.value);
    setVolume(nextVol);
    if (v) {
      v.volume = nextVol;
      v.muted = nextVol === 0;
      setIsMuted(nextVol === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (v) {
      v.currentTime = nextTime;
    }
  };

  const handleCycleSpeed = () => {
    const v = videoRef.current;
    const currentIndex = PLAYBACK_RATES.indexOf(
      playbackRate as (typeof PLAYBACK_RATES)[number]
    );
    const nextRate =
      PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(nextRate);
    if (v) {
      v.playbackRate = nextRate;
    }
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (typeof v.requestFullscreen === 'function') {
      v.requestFullscreen().catch(() => {});
    }
  };

  const handleCopyCaption = async () => {
    if (!videoData.caption) return;
    await copyFullUrlToClipboard(videoData.caption);
    setCopiedCaption(true);
    window.setTimeout(() => setCopiedCaption(false), 2000);
  };

  const platformName =
    videoData.platform === 'youtube'
      ? 'YouTube'
      : videoData.platform === 'instagram'
      ? 'Instagram'
      : 'TikTok';

  const captionText =
    videoData.caption || '(Tidak ada teks deskripsi atau caption pada video ini)';
  const isLongCaption = captionText.length > 260 || captionText.split('\n').length > 5;

  return (
    <section
      aria-label="Pemutar Video dan Detail Caption"
      data-testid="unified-video-caption-section"
      {...liquidPointerHandlers}
      className="glass-panel transform-gpu rounded-2xl overflow-hidden"
    >
      <CardCornerWatermark />

      {/* Top Section Header Bar */}
      <div className="relative z-10 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] bg-[#111317]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-[#94a3b8]">
          <span className="text-xs sm:text-sm font-sans font-semibold text-[#f1f5f9]">
            Pemutar Video & Detail Caption
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[#2dd4bf] font-sans font-semibold">
            {platformName}
          </span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="hidden sm:inline text-[#38bdf8]">ID {videoData.id}</span>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
          {videoData.playUrl && (
            <a
              href={videoData.playUrl}
              target="_blank"
              rel="noopener noreferrer"
              {...liquidPointerHandlers}
              className="liquid-btn-secondary transform-gpu min-h-[44px] sm:min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold text-[#2dd4bf] flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Unduh Video
                <span className="sr-only sm:not-sr-only"> Tanpa Watermark</span>
              </span>
            </a>
          )}

          <a
            href={videoData.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            {...liquidPointerHandlers}
            className="liquid-btn-secondary transform-gpu min-h-[44px] sm:min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-medium text-[#f1f5f9] flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" aria-hidden="true" />
            <span>Buka Video Asli</span>
          </a>
        </div>
      </div>

      {/* Unified 2-Column Body (Vertical stack on Mobile: flex-col lg:flex-row) */}
      <div className="relative z-10 p-4 sm:p-6 flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch">
        {/* LEFT COLUMN: Interactive Video Player */}
        <div className="w-full lg:w-5/12 flex flex-col justify-between gap-3 min-w-0">
          {effectiveVideoSrc ? (
            <>
              <div
                className={`relative rounded-xl overflow-hidden bg-[#0b0c0e] border flex items-center justify-center min-h-[220px] sm:min-h-[340px] transition-[transform,opacity,background-color,border-color] duration-300 ease-out ${
                  isPlaying
                    ? 'border-[#38bdf8]/45 shadow-[0_0_24px_-6px_rgba(56,189,248,0.28)]'
                    : 'border-white/[0.08]'
                }`}
              >
                <video
                  ref={videoRef}
                  src={effectiveVideoSrc}
                  poster={videoData.coverUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  crossOrigin={useDirectFallback ? undefined : 'anonymous'}
                  data-testid="unified-video-player"
                  aria-label={`Pemutar video ${
                    videoData.title || videoData.author.nickname
                  }`}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (d && Number.isFinite(d)) {
                      setDuration(d);
                    }
                    setIsMuted(e.currentTarget.muted);
                    setVolume(e.currentTarget.volume);
                  }}
                  onTimeUpdate={(e) => {
                    setCurrentTime(e.currentTarget.currentTime);
                  }}
                  onVolumeChange={(e) => {
                    setIsMuted(e.currentTarget.muted);
                    setVolume(e.currentTarget.volume);
                  }}
                  onError={() => {
                    if (!useDirectFallback && videoData.playUrl) {
                      setUseDirectFallback(true);
                    }
                  }}
                  className="w-full max-h-[300px] sm:max-h-[400px] object-contain bg-[#0b0c0e] block"
                />
              </div>

              {/* Dedicated Interactive Full Control Bar */}
              <div
                aria-label="Kontrol Pemutar Video"
                {...liquidPointerHandlers}
                className="glass-subpanel rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono tabular-nums text-[#2dd4bf] w-10">
                    {formatVideoTimestamp(currentTime)}
                  </span>
                  <input
                    type="range"
                    aria-label="Geser posisi waktu pemutaran video"
                    min={0}
                    max={Math.max(1, duration)}
                    step={0.1}
                    value={Math.min(currentTime, Math.max(1, duration))}
                    onChange={handleSeek}
                    className="flex-1 accent-[#2dd4bf] cursor-pointer h-1.5"
                  />
                  <span className="text-xs font-mono tabular-nums text-[#94a3b8] w-10 text-right">
                    {formatVideoTimestamp(duration)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.08]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handleTogglePlay}
                      className="liquid-btn-primary min-h-[38px] px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isPlaying ? (
                        <span
                          key="pause-state"
                          className="animate-state-pop flex items-center gap-1.5"
                        >
                          <Pause
                            className="w-3.5 h-3.5 text-[#2dd4bf] fill-current"
                            aria-hidden="true"
                          />
                          <span>Jeda</span>
                        </span>
                      ) : (
                        <span
                          key="play-state"
                          className="animate-state-pop flex items-center gap-1.5"
                        >
                          <Play
                            className="w-3.5 h-3.5 text-[#2dd4bf] fill-current"
                            aria-hidden="true"
                          />
                          <span>Putar Video</span>
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handleRestartVideo}
                      aria-label="Ulangi dari awal"
                      className="liquid-btn-secondary min-h-[38px] min-w-[38px] p-1.5 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handleToggleMute}
                      aria-label={
                        isMuted ? 'Aktifkan suara' : 'Bisukan suara'
                      }
                      className="liquid-btn-secondary min-h-[38px] min-w-[38px] p-1.5 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX
                          key="muted-icon"
                          className="w-3.5 h-3.5 text-[#38bdf8] animate-state-pop"
                          aria-hidden="true"
                        />
                      ) : (
                        <Volume2
                          key="unmuted-icon"
                          className="w-3.5 h-3.5 text-[#2dd4bf] animate-state-pop"
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    <input
                      type="range"
                      aria-label="Volume suara"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-12 accent-[#2dd4bf] cursor-pointer hidden sm:block shrink-0"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handleCycleSpeed}
                      aria-label={`Ubah kecepatan (${playbackRate}x)`}
                      className="liquid-btn-secondary min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span
                        key={`rate-${playbackRate}`}
                        className="animate-state-pop inline-block"
                      >
                        {playbackRate}x
                      </span>
                    </button>

                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={handleFullscreen}
                      aria-label="Layar penuh"
                      className="liquid-btn-secondary min-h-[38px] min-w-[38px] p-1.5 rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : youtubeEmbedUrl ? (
            <div className="flex flex-col justify-between gap-3 h-full">
              <div className="relative rounded-xl overflow-hidden bg-[#0b0c0e] border border-white/[0.08] aspect-video lg:flex-1 min-h-[220px] sm:min-h-[260px]">
                <iframe
                  src={youtubeEmbedUrl}
                  title={
                    videoData.title ||
                    `Pemutar Video YouTube @${videoData.author.uniqueId}`
                  }
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  data-testid="unified-youtube-player"
                  className="w-full h-full border-0 block"
                />
              </div>

              <div className="glass-subpanel rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[#94a3b8]">
                <span>Pemutar Interaktif YouTube</span>
                <span className="font-mono tabular-nums text-[#2dd4bf]">
                  Durasi: {formatVideoTimestamp(videoData.durationSec)}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#0b0c0e] border border-white/[0.08] p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[220px]">
              {videoData.coverUrl && (
                <img
                  src={videoData.coverUrl}
                  alt={videoData.author.nickname}
                  referrerPolicy="no-referrer"
                  className="w-32 h-44 object-cover rounded-lg border border-white/10"
                />
              )}
              <p className="text-xs text-[#94a3b8]">
                Stream video langsung tidak tersedia. Gunakan tombol Buka Video Asli di kanan atas.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Unified Creator Info & Full Caption Details */}
        <div className="w-full lg:w-7/12 min-w-0 flex flex-col justify-between gap-4">
          <div className="flex-1 flex flex-col gap-4">
            <div
              {...liquidPointerHandlers}
              className="glass-subpanel transform-gpu rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {videoData.author.avatar ? (
                  <img
                    src={videoData.author.avatar}
                    alt={videoData.author.nickname}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-[#2dd4bf]/35 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#2dd4bf]/15 border border-[#2dd4bf]/30 flex items-center justify-center text-[#2dd4bf] shrink-0">
                    <User className="w-5 h-5" aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm sm:text-base font-bold text-[#f1f5f9] truncate">
                    {videoData.author.nickname}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-[#94a3b8] font-mono tabular-nums">
                    <span className="text-[#2dd4bf]">
                      @{videoData.author.uniqueId}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#38bdf8]">
                      {formatVideoTimestamp(videoData.durationSec)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{videoData.commentCount} komentar</span>
                  </div>
                </div>
              </div>

              {videoData.playUrl && onJumpToQrScanner && (
                <button
                  type="button"
                  {...liquidPointerHandlers}
                  onClick={onJumpToQrScanner}
                  className="liquid-btn-secondary transform-gpu w-full sm:w-auto min-h-[44px] sm:min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ScanLine
                    className="w-3.5 h-3.5 text-[#2dd4bf]"
                    aria-hidden="true"
                  />
                  <span>Panel Scan QR Video</span>
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2.5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-[#f1f5f9]">
                    {videoData.platform === 'youtube'
                      ? 'Detail Judul & Deskripsi Video YouTube'
                      : 'Detail Caption Video'}
                  </h3>
                  <p className="text-xs text-[#94a3b8] font-mono tabular-nums">
                    <span className="text-[#2dd4bf]">{captionLinksCount} tautan caption</span> ·{' '}
                    <span className="text-[#38bdf8]">{commentLinksCount} tautan komentar</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isLongCaption && (
                    <button
                      type="button"
                      {...liquidPointerHandlers}
                      onClick={() => setIsCaptionExpanded((prev) => !prev)}
                      className="liquid-btn-secondary transform-gpu flex-1 sm:flex-initial min-h-[40px] sm:min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isCaptionExpanded ? (
                        <span
                          key="collapse-caption"
                          className="animate-state-pop flex items-center gap-1"
                        >
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Ringkas Caption</span>
                        </span>
                      ) : (
                        <span
                          key="expand-caption"
                          className="animate-state-pop flex items-center gap-1"
                        >
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Tampilkan Penuh</span>
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    {...liquidPointerHandlers}
                    onClick={handleCopyCaption}
                    disabled={!videoData.caption}
                    className="liquid-btn-secondary transform-gpu flex-1 sm:flex-initial min-h-[40px] sm:min-h-[38px] px-3 py-1.5 rounded-lg disabled:opacity-50 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedCaption ? (
                      <span
                        key="caption-copied"
                        className="animate-state-pop flex items-center gap-1.5"
                      >
                        <Check
                          className="w-3.5 h-3.5 text-[#10b981]"
                          aria-hidden="true"
                        />
                        <span className="text-[#2dd4bf]">Caption Tersalin</span>
                      </span>
                    ) : (
                      <span
                        key="caption-copy-idle"
                        className="animate-state-pop flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Salin Caption</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {videoData.title &&
                videoData.platform === 'youtube' && (
                  <div className="glass-subpanel px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#f1f5f9] break-words">
                    {videoData.title}
                  </div>
                )}

              <div
                key={isCaptionExpanded ? 'caption-exp' : 'caption-col'}
                data-testid="unified-video-caption-box"
                className={`flex-1 glass-subpanel p-4 rounded-xl text-xs sm:text-sm text-[#f1f5f9] whitespace-pre-wrap break-all font-mono leading-relaxed overflow-y-auto transition-all min-h-[180px] animate-expand-reveal url-wrap-box ${
                  isCaptionExpanded ? 'max-h-[440px]' : 'max-h-[280px]'
                }`}
              >
                {captionText}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
            {detectedQr ? (
              <div className="glass-subpanel px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#f1f5f9] break-all">
                  QR Code Video Terdeteksi:{' '}
                  <strong className="font-mono text-[#2dd4bf]">
                    {detectedQr.resolvedAlightCreativeUrl ||
                      detectedQr.rawPayload}
                  </strong>
                </span>
                <a
                  href={
                    detectedQr.resolvedAlightCreativeUrl ||
                    detectedQr.rawPayload
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2dd4bf] hover:underline whitespace-nowrap shrink-0"
                >
                  Buka di Alight Motion →
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#94a3b8] font-mono tabular-nums">
                <span>
                  Status Ekstraksi:{' '}
                  <strong className="text-[#f1f5f9] font-sans">
                    {captionLinksCount + commentLinksCount > 0
                      ? `${captionLinksCount + commentLinksCount} Tautan Preset Ditemukan`
                      : 'Memindai Tautan & Kode QR Video'}
                  </strong>
                </span>
                <span>
                  Caption ({captionLinksCount}) · Komentar ({commentLinksCount}) · QR (
                  {detectedQr ? 1 : 0})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
