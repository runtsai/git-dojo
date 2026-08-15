import { motion } from 'framer-motion';

export const Scene0 = () => {
  const terminalText = "git dojo start";
  
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 1.1, opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="w-full max-w-4xl relative"
        initial={{ y: 50, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 1.2, type: 'spring', stiffness: 100, damping: 20 }}
      >
        {/* High-tech assembly frames */}
        <motion.div 
          className="absolute -inset-4 border border-primary/30 rounded-2xl"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
        />
        <motion.div 
          className="absolute -inset-2 border border-primary/20 rounded-xl"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
        />

        {/* Glass panel */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_80px_rgba(88,166,255,0.15)] rounded-xl overflow-hidden relative">
          
          <div className="h-10 border-b border-white/10 flex items-center px-6 gap-3 bg-white/[0.02]">
            <div className="w-2 h-2 rounded-full bg-error/80 shadow-[0_0_10px_var(--color-error)]" />
            <div className="w-2 h-2 rounded-full bg-warning/80 shadow-[0_0_10px_var(--color-warning)]" />
            <div className="w-2 h-2 rounded-full bg-success/80 shadow-[0_0_10px_var(--color-success)]" />
            <div className="ml-auto font-mono text-[10px] text-white/40 tracking-widest">SYS.INIT // v2.0</div>
          </div>
          
          <div className="p-10 font-mono text-xl md:text-2xl text-text-primary flex flex-col gap-6 min-h-[280px] relative z-10">
            <div className="flex items-center gap-4">
              <span className="text-success/90">sys@rts.ai:~$</span>
              <div className="flex text-primary/90 font-bold">
                {terminalText.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.04, duration: 0.2 }}
                  >
                    {char}
                  </motion.span>
                ))}
                <motion.div
                  className="w-3 h-6 bg-primary ml-1 shadow-[0_0_10px_var(--color-primary)] inline-block"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
                />
              </div>
            </div>
            
            <div className="mt-8 flex flex-col gap-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2.0, duration: 0.6, type: 'spring' }}
                className="text-white font-bold text-4xl md:text-6xl tracking-tight font-display"
                style={{ textShadow: '0 0 40px rgba(255,255,255,0.2)' }}
              >
                Git Dojo: The Mastery Path
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.3, duration: 0.8 }}
                className="text-primary/70 text-lg uppercase tracking-[0.2em] font-mono mt-2"
              >
                High-performance visual training
              </motion.div>
            </div>
          </div>

          {/* Glare effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.05] to-white/0 pointer-events-none" />
        </div>
      </motion.div>
    </motion.div>
  );
};
