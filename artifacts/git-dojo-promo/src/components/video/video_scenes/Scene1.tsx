import { motion } from 'framer-motion';

export const Scene1 = () => {
  const steps = ["WHAT", "WHERE", "WHY", "WHEN", "HOW"];
  
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ scale: 0.85, opacity: 0, filter: 'blur(20px)' }}
      animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
      exit={{ x: '-100%', opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-[1200px] px-12 flex flex-col md:flex-row items-center gap-16">
        {/* Left Side: Content */}
        <div className="flex-1 relative">
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="w-16 h-1 bg-accent mb-8 shadow-[0_0_15px_var(--color-accent)] origin-left"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-accent uppercase tracking-[0.3em] font-mono text-sm mb-6 flex items-center gap-3"
          >
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Track A // Visual Tiers
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="font-display text-5xl md:text-7xl font-bold mb-8 leading-tight text-white"
            style={{ textShadow: '0 0 30px rgba(255,255,255,0.1)' }}
          >
            Context Before <br/><span className="text-primary">Command.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-white/60 text-xl max-w-lg leading-relaxed font-light border-l-2 border-white/10 pl-6"
          >
            Never run a command without understanding the business reason. Simulated UI with zero gating.
          </motion.p>
        </div>

        {/* Right Side: Assembly Stack */}
        <div className="flex-1 flex flex-col gap-4 w-full relative">
          {/* Background HUD elements */}
          <div className="absolute -inset-8 border border-white/5 rounded-2xl pointer-events-none" />
          <div className="absolute right-0 top-0 w-32 h-[1px] bg-primary/30 shadow-[0_0_10px_var(--color-primary)] pointer-events-none" />
          <div className="absolute right-0 bottom-0 w-[1px] h-32 bg-primary/30 shadow-[0_0_10px_var(--color-primary)] pointer-events-none" />

          {steps.map((step, i) => (
            <motion.div
              key={step}
              className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl p-5 flex items-center justify-between relative overflow-hidden"
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.15, type: 'spring', stiffness: 150, damping: 20 }}
            >
              {/* Animated background glow for the active step */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"
                initial={{ opacity: 0, x: '-100%' }}
                animate={{ opacity: 1, x: '0%' }}
                transition={{ delay: 1.2 + i * 0.15, duration: 1.5, ease: 'easeOut' }}
              />
              
              <div className="flex items-center gap-4 relative z-10">
                <span className="font-mono text-white/30 text-xs">{`0${i + 1}`}</span>
                <span className="font-mono text-white font-bold tracking-widest">{step}</span>
              </div>

              <div className="w-full max-w-[180px] h-1 bg-white/10 rounded-full overflow-hidden ml-4 relative z-10">
                <motion.div 
                  className="h-full bg-primary rounded-full shadow-[0_0_10px_var(--color-primary)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - i * 15}%` }}
                  transition={{ delay: 1.5 + i * 0.15, duration: 1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
