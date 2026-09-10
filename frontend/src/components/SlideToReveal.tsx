import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'motion/react';
import { Check, ArrowRight, Flame } from 'lucide-react';
import { soundFx } from '../utils/soundEngine';

interface SlideToRevealProps {
  onConfirm: () => void;
  disabled?: boolean;
  isUnlocking?: boolean;
}

export const SlideToReveal: React.FC<SlideToRevealProps> = ({
  onConfirm,
  disabled = false,
  isUnlocking = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxDrag, setMaxDrag] = useState(240);
  const [confirmed, setConfirmed] = useState(false);
  const x = useMotionValue(0);
  const shouldReduceMotion = useReducedMotion();
  const lastDetentRef = useRef<number>(0);

  // Measure container width minus thumb width and horizontal padding (p-1.5 = 6px left + 6px right = 12px)
  useEffect(() => {
    const updateMaxDrag = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const thumbWidth = 52; // 52px thumb width
        const horizontalPadding = 12;
        setMaxDrag(Math.max(80, containerWidth - thumbWidth - horizontalPadding));
      }
    };
    updateMaxDrag();
    window.addEventListener('resize', updateMaxDrag);
    return () => window.removeEventListener('resize', updateMaxDrag);
  }, []);

  // Play subtle micro-ticks on slider detents (25%, 50%, 75%)
  useEffect(() => {
    return x.on('change', (latest) => {
      if (maxDrag <= 0) return;
      const progress = Math.min(1, Math.max(0, latest / maxDrag));
      const detentIndex = Math.floor(progress / 0.25);
      if (detentIndex !== lastDetentRef.current && detentIndex > 0) {
        lastDetentRef.current = detentIndex;
        soundFx.playMicroTick();
      } else if (detentIndex === 0) {
        lastDetentRef.current = 0;
      }
    });
  }, [x, maxDrag]);

  // Visual opacity transform for the background cue text as thumb slides
  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  const fillWidth = useTransform(x, [0, maxDrag], ['0%', '100%']);

  const triggerConfirm = useCallback(() => {
    if (disabled || confirmed || isUnlocking) return;
    setConfirmed(true);
    soundFx.playMicroTick();
    onConfirm();
  }, [disabled, confirmed, isUnlocking, onConfirm]);

  const handleDragEnd = () => {
    if (disabled || confirmed || isUnlocking) return;
    const currentX = x.get();
    if (currentX >= maxDrag * 0.7) {
      triggerConfirm();
    } else {
      // Spring back to origin
      x.set(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      triggerConfirm();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-3 select-none font-sans">
      {/* Main Tactile Slider Track */}
      <div
        ref={containerRef}
        role="slider"
        aria-label="Slide to unlock and destroy secret"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={confirmed ? 100 : 0}
        tabIndex={disabled || confirmed || isUnlocking ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`relative h-16 w-full rounded-2xl p-1.5 flex items-center overflow-hidden border transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          confirmed || isUnlocking
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
            : 'bg-slate-100 dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]'
        }`}
      >
        {/* Clean mechanical fill track */}
        <motion.div
          style={{ width: fillWidth }}
          className={`absolute left-0 top-0 bottom-0 rounded-xl pointer-events-none transition-colors ${
            confirmed || isUnlocking
              ? 'bg-rose-500/20 border-r border-rose-500/40'
              : 'bg-emerald-500/15 dark:bg-emerald-500/20 border-r border-emerald-500/30'
          }`}
        />

        {/* Centered Guide Text */}
        <motion.div
          style={{ opacity: shouldReduceMotion ? 1 : textOpacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-mono font-bold tracking-wider uppercase pl-10 text-slate-500 dark:text-zinc-400"
        >
          {isUnlocking ? (
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              Incinerating &amp; Decrypting...
            </span>
          ) : (
            <span className="text-slate-600 dark:text-zinc-300">
              Slide to Reveal &amp; Burn
            </span>
          )}
        </motion.div>

        {/* Draggable Slider Thumb */}
        <motion.div
          drag={disabled || confirmed || isUnlocking || shouldReduceMotion ? false : 'x'}
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0.06}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x }}
          whileHover={!disabled && !confirmed && !isUnlocking ? { scale: 1.02 } : {}}
          whileTap={!disabled && !confirmed && !isUnlocking ? { scale: 0.98 } : {}}
          className={`relative z-10 w-[52px] h-[52px] rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing border shadow-md transition-colors duration-200 ${
            confirmed || isUnlocking
              ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
              : 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-750 shadow-[0_2px_8px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]'
          }`}
        >
          {confirmed || isUnlocking ? (
            <Check className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <ArrowRight className="w-6 h-6 stroke-[2.5]" />
          )}
        </motion.div>
      </div>

      {/* Understated Fallback & Notice */}
      <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
        <span>Single-Use Burn Vault</span>
        <button
          type="button"
          disabled={disabled || confirmed || isUnlocking}
          onClick={triggerConfirm}
          className="hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          Click to reveal directly
        </button>
      </div>
    </div>
  );
};

export default SlideToReveal;

