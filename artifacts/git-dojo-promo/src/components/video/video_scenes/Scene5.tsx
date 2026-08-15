import { useMemo } from 'react';
import { motion } from 'framer-motion';

// Final stinger: company logo slams in large and centered while binary
// code streams up the screen at high speed behind it.

const COLUMN_COUNT = 26;
const CHARS_PER_COLUMN = 46;

function makeBinaryColumn(seed: number): string[] {
  const out: string[] = [];
  let x = seed;
  for (let i = 0; i < CHARS_PER_COLUMN; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out.push(x % 2 === 0 ? '0' : '1');
  }
  return out;
}

const BinaryRain = () => {
  const columns = useMemo(
    () =>
      Array.from({ length: COLUMN_COUNT }, (_, i) => ({
        chars: makeBinaryColumn(i * 7919 + 13),
        left: `${(i + 0.5) * (100 / COLUMN_COUNT)}%`,
        duration: 0.55 + ((i * 37) % 100) / 250, // 0.55s - 0.95s per pass: very fast
        delay: -(((i * 53) % 100) / 100),
        opacity: 0.18 + ((i * 29) % 100) / 400,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {columns.map((col, i) => (
        <motion.div
          key={i}
          className="absolute font-mono whitespace-pre text-center"
          style={{
            left: col.left,
            top: 0,
            fontSize: 20,
            lineHeight: '26px',
            color: 'var(--color-primary, #f0b429)',
            opacity: col.opacity,
            transform: 'translateX(-50%)',
          }}
          initial={{ y: '0%' }}
          animate={{ y: '-50%' }}
          transition={{
            duration: col.duration,
            ease: 'linear',
            repeat: Infinity,
            delay: col.delay,
          }}
        >
          {/* Doubled content so the loop is seamless */}
          {[...col.chars, ...col.chars].join('\n')}
        </motion.div>
      ))}
    </div>
  );
};

export const Scene5 = () => {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-center bg-bg-light"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <BinaryRain />
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22, mass: 0.9 }}
      >
        <div
          className="font-mono font-bold tracking-widest"
          style={{
            fontSize: 110,
            color: 'var(--color-primary, #f0b429)',
            textShadow: '0 0 60px rgba(240, 180, 41, 0.45)',
          }}
        >
          RTS.AI
        </div>
        <div
          className="tracking-[0.5em] uppercase mt-2"
          style={{ fontSize: 22, color: 'rgba(230, 237, 243, 0.9)' }}
        >
          Run Trading Systems
        </div>
      </motion.div>
    </motion.div>
  );
};
