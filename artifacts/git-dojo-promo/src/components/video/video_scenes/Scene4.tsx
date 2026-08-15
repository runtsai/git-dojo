import { motion } from 'framer-motion';

export const Scene4 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8"
      initial={{ scale: 0.95, opacity: 0, filter: 'blur(20px)' }}
      animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
      exit={{ scale: 1.1, opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,166,255,0.1),transparent)] pointer-events-none" />

      <motion.div
        className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center text-center relative z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="w-32 h-32 rounded-3xl bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_0_60px_rgba(88,166,255,0.3)] flex items-center justify-center mb-10 relative"
          initial={{ rotate: -15, scale: 0, rotateY: -30 }}
          animate={{ rotate: 0, scale: 1, rotateY: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 20 }}
          style={{ perspective: 1000 }}
        >
          {/* Animated graph lines inside icon */}
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px var(--color-primary))' }}>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="18" cy="18" r="3"></circle>
            <line x1="6" y1="9" x2="6" y2="15"></line>
            <path d="M18 15V9a3 3 0 0 0-3-3H9"></path>
          </svg>
          <motion.div 
            className="absolute inset-0 rounded-3xl border border-primary/50"
            animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.h1
          className="font-display text-7xl md:text-9xl font-bold tracking-tight mb-6 text-white"
          style={{ textShadow: '0 0 40px rgba(255,255,255,0.2)' }}
          initial={{ y: 30, opacity: 0, filter: 'blur(10px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
        >
          Git Dojo
        </motion.h1>

        <motion.div
          className="text-2xl md:text-3xl text-primary font-mono tracking-[0.2em] uppercase mb-16"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          The Mastery Path
        </motion.div>

        <div className="flex gap-6">
          <motion.div
            className="px-8 py-4 rounded-xl bg-white/[0.03] backdrop-blur-md border border-white/10 flex items-center gap-4 font-mono text-sm tracking-widest text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.0, type: 'spring' }}
          >
            <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)] animate-pulse" /> Track A: Visual
          </motion.div>
          <motion.div
            className="px-8 py-4 rounded-xl bg-white/[0.03] backdrop-blur-md border border-white/10 flex items-center gap-4 font-mono text-sm tracking-widest text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.2, type: 'spring' }}
          >
            <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_10px_var(--color-warning)] animate-pulse" /> Track B: Terminal
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
