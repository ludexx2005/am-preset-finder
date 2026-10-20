import jsQR from 'jsqr';
import { inspectQrCodePayload } from './presetParser';

export interface QrScanDetection {
  /** Exact, unmodified string decoded from the QR Code by jsQR */
  rawPayload: string;
  isAlightPreset: boolean;
  isAlightShortlink: boolean;
  isAlightCreativeShare: boolean;
  /** If resolved from alight.link or already in https://alightcreative.com/am/share/u/.../p/... format */
  resolvedAlightCreativeUrl?: string;
  resolveStatus?: 'idle' | 'resolving' | 'resolved' | 'unverified';
  timestampSec: number;
  corners?: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  };
}

/**
 * Scans an ImageData buffer from a real <video> or <img> canvas with jsQR
 * and returns the exact, unmodified text (`code.data`) inside the QR Code.
 */
export function scanCanvasForQr(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timestampSec = 0
): QrScanDetection | null {
  if (width <= 0 || height <= 0) return null;

  const imageData = ctx.getImageData(0, 0, width, height);
  const code = jsQR(imageData.data, width, height, {
    inversionAttempts: 'attemptBoth',
  });

  if (!code || !code.data) {
    return null;
  }

  // Highlight QR detection box on canvas with Alight Motion Neon Green (#00E5A3)
  const loc = code.location;
  ctx.save();
  ctx.strokeStyle = '#00E5A3';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
  ctx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
  ctx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
  ctx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 229, 163, 0.16)';
  ctx.fill();
  ctx.restore();

  const inspected = inspectQrCodePayload(code.data);

  return {
    rawPayload: code.data,
    isAlightPreset: inspected.isAlightPreset,
    isAlightShortlink: inspected.isAlightShortlink,
    isAlightCreativeShare: inspected.isAlightCreativeShare,
    resolvedAlightCreativeUrl: inspected.directAlightCreativeUrl || undefined,
    resolveStatus: inspected.directAlightCreativeUrl
      ? 'resolved'
      : inspected.isAlightShortlink
      ? 'idle'
      : undefined,
    timestampSec,
    corners: {
      topLeft: loc.topLeftCorner,
      topRight: loc.topRightCorner,
      bottomRight: loc.bottomRightCorner,
      bottomLeft: loc.bottomLeftCorner,
    },
  };
}

/**
 * Decodes an uploaded image File or DataURL using an offscreen canvas and jsQR.
 * Extracts the exact text stored inside the QR code without altering a single character.
 */
export async function scanImageSourceForQr(
  imageSrc: string
): Promise<{
  detection: QrScanDetection | null;
  annotatedDataUrl: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalW = img.naturalWidth || img.width || 600;
      const naturalH = img.naturalHeight || img.height || 600;

      // First scan at full native resolution (up to 1600px) for maximum QR accuracy
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
      const width = Math.max(100, Math.round(naturalW * scale));
      const height = Math.max(100, Math.round(naturalH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Gagal menginisialisasi Canvas 2D untuk pemindaian QR.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      let detection = scanCanvasForQr(ctx, width, height, 0);

      // If QR code occupies a small portion of a tall phone screenshot, also try center-cropped pass
      if (!detection && (width > 400 || height > 400)) {
        const cropCanvas = document.createElement('canvas');
        const cropW = Math.round(width * 0.85);
        const cropH = Math.round(height * 0.65);
        const sx = Math.round((width - cropW) / 2);
        const sy = Math.round((height - cropH) / 2);
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
        if (cropCtx) {
          cropCtx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
          const cropDetection = scanCanvasForQr(cropCtx, cropW, cropH, 0);
          if (cropDetection) {
            detection = cropDetection;
            ctx.drawImage(cropCanvas, sx, sy);
          }
        }
      }

      const annotatedDataUrl = canvas.toDataURL('image/png');
      resolve({
        detection,
        annotatedDataUrl,
        width,
        height,
      });
    };
    img.onerror = () => {
      reject(new Error('Gagal memuat file gambar. Pastikan format PNG, JPG, atau WEBP valid.'));
    };
    img.src = imageSrc;
  });
}
