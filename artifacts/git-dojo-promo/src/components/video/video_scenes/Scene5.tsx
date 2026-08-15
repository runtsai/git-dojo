import { useMemo } from 'react';
import { motion } from 'framer-motion';

// Final stinger: company logo slams in large and centered while binary
// code streams up the screen at high speed behind it.

const COLUMN_COUNT = 32;
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
        duration: 0.4 + ((i * 37) % 100) / 300, // Even faster
        delay: -(((i * 53) % 100) / 100),
        opacity: 0.1 + ((i * 29) % 100) / 300,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ perspective: '800px' }}>
      {columns.map((col, i) => (
        <motion.div
          key={i}
          className="absolute font-mono whitespace-pre text-center"
          style={{
            left: col.left,
            top: 0,
            fontSize: 16,
            lineHeight: '20px',
            color: 'var(--color-primary)',
            opacity: col.opacity,
            transform: 'translateX(-50%) translateZ(-200px)',
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#050914_100%)] z-[1]" />
    </div>
  );
};

export const Scene5 = () => {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#050914]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <BinaryRain />
      
      {/* Laser line sweeping down to reveal */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px] bg-white shadow-[0_0_20px_#fff,0_0_40px_var(--color-primary)] z-20"
        initial={{ y: '-10vh', opacity: 0 }}
        animate={{ y: '110vh', opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.2, ease: 'linear' }}
      />

      <motion.div
        className="relative flex flex-col items-center z-10"
        initial={{ scale: 0.8, opacity: 0, filter: 'blur(30px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, mass: 1 }}
      >
        <div className="relative">
          <img
            src={`${import.meta.env.BASE_URL}rts-logo.png`}
            alt="RTS"
            style={{
              width: 300,
              height: 300,
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2,
            }}
          />
        </div>
        
        <div className="flex flex-col items-center mt-12 gap-4">
          <motion.div
            className="tracking-[0.6em] uppercase font-display font-bold"
            style={{ fontSize: 24, color: 'rgba(255, 255, 255, 0.95)', textShadow: '0 0 20px rgba(255,255,255,0.3)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Run Trading Systems
          </motion.div>

          <motion.div
            className="font-mono text-primary tracking-widest bg-primary/10 border border-primary/30 px-6 py-2 rounded shadow-[0_0_20px_rgba(88,166,255,0.2)]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            git-dojo.com
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
