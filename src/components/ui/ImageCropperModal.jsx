import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCw, RotateCcw, ZoomIn, ZoomOut, Image as ImageIcon, Upload, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { extractDominantColor } from '../../lib/categories';
import { useLanguage } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import { FrostedGlass } from './FrostedGlass';

// Apple Design rubber-band formula for elastic resistance
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Generate squircle path (continuous curvature rounded rect)
function drawSquirclePath(ctx, x, y, size, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.closePath();
}

export function ImageCropperModal({
  isOpen,
  onClose,
  initialImage = null, // image URL, base64, or File
  onApply, // ({ dataUrl, dominantColor }) => void
}) {
  const { t, language, isRtl } = useLanguage();
  const [imageSrc, setImageSrc] = useState(null);
  const [imageObj, setImageObj] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom] = useState(3.5);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, imgX: 0, imgY: 0 });

  const CROP_SIZE = 240; // Diameter / side of crop aperture
  const VIEWPORT_SIZE = 300; // Visible interactive container
  const SQUIRCLE_RADIUS = 54; // Smooth ~22.5% corner radius for Apple squircle

  // Load image whenever initialImage changes or user loads a new one
  useEffect(() => {
    if (!isOpen) return;

    if (initialImage) {
      if (typeof initialImage === 'string') {
        loadImage(initialImage);
      } else if (initialImage instanceof File || initialImage instanceof Blob) {
        const reader = new FileReader();
        reader.onload = (e) => loadImage(e.target.result);
        reader.readAsDataURL(initialImage);
      }
    } else {
      setImageSrc(null);
      setImageObj(null);
    }
  }, [initialImage, isOpen]);

  const loadImage = (src) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageObj(img);
      setImageSrc(src);
      resetTransform(img, 0);
    };
    img.src = src;
  };

  // Reset zoom, position, and rotation to fit frame perfectly
  const resetTransform = (img = imageObj, rot = 0) => {
    if (!img) return;
    const isSideways = rot === 90 || rot === 270;
    const w = isSideways ? img.height : img.width;
    const h = isSideways ? img.width : img.height;

    // Scale so the shortest dimension covers the CROP_SIZE
    const scale = Math.max(CROP_SIZE / w, CROP_SIZE / h);
    setMinZoom(scale);
    setZoom(scale);
    setPosition({ x: 0, y: 0 });
    setRotation(rot);
  };

  // Clamp position so image stays filled within squircle frame
  const clampPosition = useCallback(
    (pos, currentZoom, currentRot) => {
      if (!imageObj) return pos;
      const isSideways = currentRot === 90 || currentRot === 270;
      const w = (isSideways ? imageObj.height : imageObj.width) * currentZoom;
      const h = (isSideways ? imageObj.width : imageObj.height) * currentZoom;

      const maxDeltaX = Math.max(0, (w - CROP_SIZE) / 2);
      const maxDeltaY = Math.max(0, (h - CROP_SIZE) / 2);

      return {
        x: Math.min(maxDeltaX, Math.max(-maxDeltaX, pos.x)),
        y: Math.min(maxDeltaY, Math.max(-maxDeltaY, pos.y)),
      };
    },
    [imageObj]
  );

  // Redraw canvas preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = VIEWPORT_SIZE * dpr;
    canvas.height = VIEWPORT_SIZE * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    // Draw the image transformed
    ctx.save();
    ctx.translate(VIEWPORT_SIZE / 2 + position.x, VIEWPORT_SIZE / 2 + position.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.drawImage(imageObj, -imageObj.width / 2, -imageObj.height / 2);
    ctx.restore();

    // Draw vignette overlay with squircle cutout
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    // Squircle cutout
    const cropX = (VIEWPORT_SIZE - CROP_SIZE) / 2;
    const cropY = (VIEWPORT_SIZE - CROP_SIZE) / 2;
    ctx.roundRect(cropX, cropY, CROP_SIZE, CROP_SIZE, SQUIRCLE_RADIUS);
    ctx.fill('evenodd');

    // Squircle border guideline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }, [imageObj, zoom, rotation, position]);

  // Pointer event handlers for 1:1 Direct Manipulation with Apple Rubber-Banding
  const handlePointerDown = (e) => {
    if (!imageObj) return;
    e.target.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      imgX: position.x,
      imgY: position.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !imageObj) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const rawX = dragStartRef.current.imgX + dx;
    const rawY = dragStartRef.current.imgY + dy;

    // Apply rubber-banding if dragging past boundary
    const isSideways = rotation === 90 || rotation === 270;
    const w = (isSideways ? imageObj.height : imageObj.width) * zoom;
    const h = (isSideways ? imageObj.width : imageObj.height) * zoom;
    const maxDeltaX = Math.max(0, (w - CROP_SIZE) / 2);
    const maxDeltaY = Math.max(0, (h - CROP_SIZE) / 2);

    let nextX = rawX;
    let nextY = rawY;

    if (Math.abs(rawX) > maxDeltaX) {
      const overshoot = Math.abs(rawX) - maxDeltaX;
      const sign = rawX > 0 ? 1 : -1;
      nextX = sign * (maxDeltaX + rubberband(overshoot, CROP_SIZE, 0.45));
    }
    if (Math.abs(rawY) > maxDeltaY) {
      const overshoot = Math.abs(rawY) - maxDeltaY;
      const sign = rawY > 0 ? 1 : -1;
      nextY = sign * (maxDeltaY + rubberband(overshoot, CROP_SIZE, 0.45));
    }

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDragging(false);

    // Spring settle back into boundary if overshot
    setPosition((prev) => clampPosition(prev, zoom, rotation));
  };

  // Wheel and trackpad zoom handler
  const handleWheel = (e) => {
    if (!imageObj) return;
    e.preventDefault();
    const zoomFactor = e.ctrlKey ? 0.05 : 0.02;
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(maxZoom, Math.max(minZoom, zoom + delta * zoomFactor * zoom));

    setZoom(newZoom);
    setPosition((prev) => clampPosition(prev, newZoom, rotation));
  };

  // Double-click to fit/center
  const handleDoubleClick = () => {
    if (!imageObj) return;
    setZoom(minZoom);
    setPosition({ x: 0, y: 0 });
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    if (!imageObj) return;
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);

    // Re-evaluate minZoom for new orientation
    const isSideways = nextRot === 90 || nextRot === 270;
    const w = isSideways ? imageObj.height : imageObj.width;
    const h = isSideways ? imageObj.width : imageObj.height;
    const newMinZoom = Math.max(CROP_SIZE / w, CROP_SIZE / h);
    setMinZoom(newMinZoom);

    const adjustedZoom = Math.max(newMinZoom, zoom);
    setZoom(adjustedZoom);
    setPosition((prev) => clampPosition(prev, adjustedZoom, nextRot));
  };

  // Handle file browsing
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => loadImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Handle clipboard paste inside cropper
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => loadImage(ev.target.result);
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Export cropped 128x128 squircle image and extract dominant color
  const handleApply = () => {
    if (!imageObj) return;

    const exportCanvas = document.createElement('canvas');
    const EXPORT_SIZE = 128;
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';

    // Create squircle clip mask on export canvas
    ctx.beginPath();
    ctx.roundRect(0, 0, EXPORT_SIZE, EXPORT_SIZE, Math.round(EXPORT_SIZE * 0.225));
    ctx.clip();

    // Map viewport coordinates to export dimensions
    const scaleFactor = EXPORT_SIZE / CROP_SIZE;
    ctx.save();
    ctx.translate(EXPORT_SIZE / 2 + position.x * scaleFactor, EXPORT_SIZE / 2 + position.y * scaleFactor);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom * scaleFactor, zoom * scaleFactor);
    ctx.drawImage(imageObj, -imageObj.width / 2, -imageObj.height / 2);
    ctx.restore();

    // Extract dominant vibrant color from cropped image
    const dominantColor = extractDominantColor(exportCanvas);
    const dataUrl = exportCanvas.toDataURL('image/png');

    onApply?.({ dataUrl, dominantColor });
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 dark:bg-black/30 backdrop-blur-[1px] animate-in fade-in duration-150">
      <FrostedGlass
        variant="modal"
        className="w-full max-w-[380px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/25 dark:bg-zinc-950/25 relative z-10">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>{t('categories.editImage', 'Edit Image')}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport / Canvas */}
        <div className="p-4 flex flex-col items-center bg-zinc-100 dark:bg-zinc-900/60">
          {imageSrc ? (
            <div
              className="relative w-[300px] h-[300px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner border border-zinc-300/60 dark:border-zinc-800"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              title="Drag to position. Double-click to fit/center."
            >
              <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-[300px] h-[300px] border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-zinc-50 dark:bg-zinc-900/40"
            >
              <Upload className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mb-2" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {t('categories.selectOrDrop', 'Select or drop an image')}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {t('categories.pasteSupported', 'PNG, JPG, WebP or Ctrl+V to paste')}
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Controls: Zoom & Rotate */}
          {imageSrc && (
            <div className="w-full mt-4 flex items-center justify-between gap-3 px-1">
              <ZoomOut className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step={0.01}
                value={zoom}
                onChange={(e) => {
                  const z = parseFloat(e.target.value);
                  setZoom(z);
                  setPosition((prev) => clampPosition(prev, z, rotation));
                }}
                className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
              />
              <ZoomIn className="w-4 h-4 text-zinc-400 shrink-0" />

              <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90°"
                className="p-1.5 rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-[0.95] transition-all border border-zinc-200 dark:border-zinc-700 shrink-0"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-zinc-950/40 border-t border-zinc-200/80 dark:border-zinc-800/80 relative z-10">
          <div className="flex items-center gap-2">
            {imageSrc && (
              <button
                type="button"
                onClick={() => resetTransform()}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
              >
                {t('common.reset', 'Reset')}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              {t('categories.changeImage', 'Change Image')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!imageSrc}
              onClick={handleApply}
              className="active:scale-[0.97]"
            >
              {t('common.apply', 'Apply')}
            </Button>
          </div>
        </div>
      </FrostedGlass>
    </div>
  );
}

export default ImageCropperModal;
