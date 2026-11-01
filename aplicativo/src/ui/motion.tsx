import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { cn } from './cn';

export const ease = [0.22, 1, 0.36, 1] as const;

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div variants={staggerParent} initial="hidden" animate="show" className={className}>{children}</motion.div>;
}

export function Rise({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div variants={riseItem} className={className}>{children}</motion.div>;
}

/** Show the real value on entry; animate only actual changes, never recount on navigation. */
export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString('pt-BR'), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, v => format(v));
  useEffect(() => {
    if (reduced) { mv.set(value); return; }
    const controls = animate(mv, value, { duration: 0.35, ease });
    return () => controls.stop();
  }, [reduced, value, mv]);
  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>;
}

/** Animated progress bar that fills on mount. */
export function Meter({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return <div className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}>
    <motion.div className={cn('h-full rounded-full bg-sky-grad', barClassName)} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.9, ease, delay: 0.15 }}/>
  </div>;
}
