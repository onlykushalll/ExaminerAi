'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface DinoGameProps {
  isFinishing: boolean;
  onAnimationComplete: () => void;
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  speed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface Meteorite {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  speed: number;
  active: boolean;
}

export function DinoGame({ isFinishing, onAnimationComplete }: DinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // References to keep game loop variables mutable without re-rendering
  const gameState = useRef({
    dinoY: 0,
    dinoVelocityY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    meteorite: null as Meteorite | null,
    impactTriggered: false,
    shakeTime: 0,
    dinoDead: false,
    gameTime: 0,
    nextObstacleTime: 0,
    score: 0,
  });

  const isFinishingRef = useRef(isFinishing);
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  useEffect(() => {
    isFinishingRef.current = isFinishing;
  }, [isFinishing]);

  useEffect(() => {
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  // Jump Action
  const triggerJump = useCallback(() => {
    if (gameState.current.dinoDead) return;
    if (isGameOver) {
      restartGame();
      return;
    }
    if (!gameStarted) {
      setGameStarted(true);
      return;
    }
    if (!gameState.current.isJumping) {
      gameState.current.dinoVelocityY = -11;
      gameState.current.isJumping = true;
    }
  }, [gameStarted, isGameOver]);

  const restartGame = () => {
    setIsGameOver(false);
    setGameStarted(true);
    setScore(0);
    
    gameState.current = {
      dinoY: 0,
      dinoVelocityY: 0,
      isJumping: false,
      obstacles: [],
      particles: [],
      meteorite: null,
      impactTriggered: false,
      shakeTime: 0,
      dinoDead: false,
      gameTime: 0,
      nextObstacleTime: 100,
      score: 0,
    };
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        triggerJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerJump]);

  // Render & Logic Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const GRAVITY = 0.55;
    const FLOOR_Y = 120;
    const DINO_X = 50;
    const DINO_WIDTH = 24;
    const DINO_HEIGHT = 28;

    const updateAndDraw = () => {
      if (!canvas || !ctx) return;
      
      // Auto-resize canvas to match container width
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (canvas.width !== rect.width) {
          canvas.width = rect.width;
          canvas.height = 150;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Handle Screen Shake
      ctx.save();
      if (gameState.current.shakeTime > 0) {
        const dx = (Math.random() - 0.5) * 6;
        const dy = (Math.random() - 0.5) * 6;
        ctx.translate(dx, dy);
        gameState.current.shakeTime--;
      }

      // ── Draw Ground ──
      ctx.strokeStyle = '#cbd5e1'; // slate-200
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(canvas.width, FLOOR_Y);
      ctx.stroke();

      if (!gameStarted) {
        // Draw Press Space to Start screen
        ctx.fillStyle = '#475569'; // slate-600
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press SPACE or TAP to play Dino run', canvas.width / 2, 70);
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.font = '10px monospace';
        ctx.fillText('(Use Space or Click to Jump over obstacles)', canvas.width / 2, 95);

        // Draw static Dino
        drawDino(ctx, DINO_X, FLOOR_Y - DINO_HEIGHT, DINO_WIDTH, DINO_HEIGHT, 0);
        ctx.restore();
        animationFrameId = requestAnimationFrame(updateAndDraw);
        return;
      }

      // Increment Score
      if (!isGameOver && !gameState.current.dinoDead) {
        gameState.current.gameTime++;
        if (gameState.current.gameTime % 5 === 0) {
          gameState.current.score += 1;
          setScore(gameState.current.score);
          if (gameState.current.score > highScore) {
            setHighScore(gameState.current.score);
          }
        }
      }

      // ── DINO PHYSICS ──
      if (!gameState.current.dinoDead) {
        gameState.current.dinoY += gameState.current.dinoVelocityY;
        gameState.current.dinoVelocityY += GRAVITY;

        // Ground collision
        if (gameState.current.dinoY >= 0) {
          gameState.current.dinoY = 0;
          gameState.current.dinoVelocityY = 0;
          gameState.current.isJumping = false;
        }
      }

      const currentDinoY = FLOOR_Y - DINO_HEIGHT + gameState.current.dinoY;

      // ── OBSTACLES (CACTI) MANAGEMENT ──
      if (!isGameOver && !isFinishingRef.current && !gameState.current.dinoDead) {
        if (gameState.current.gameTime >= gameState.current.nextObstacleTime) {
          const height = 15 + Math.random() * 20;
          const width = 12 + Math.random() * 8;
          gameState.current.obstacles.push({
            x: canvas.width + 10,
            width,
            height,
            speed: 4.5 + Math.min(gameState.current.score / 150, 2),
          });
          // Schedule next obstacle
          gameState.current.nextObstacleTime = gameState.current.gameTime + 80 + Math.random() * 90;
        }
      }

      // Move & Draw Obstacles
      gameState.current.obstacles.forEach((obs, idx) => {
        if (!isGameOver && !gameState.current.dinoDead) {
          obs.x -= obs.speed;
        }

        // Draw Cactus
        ctx.fillStyle = '#0f766e'; // teal-700
        ctx.fillRect(obs.x, FLOOR_Y - obs.height, obs.width, obs.height);
        
        // Cactus branches
        ctx.fillRect(obs.x - 4, FLOOR_Y - obs.height + 6, 4, 4);
        ctx.fillRect(obs.x - 4, FLOOR_Y - obs.height + 6, obs.width + 8, 2);
        ctx.fillRect(obs.x + obs.width, FLOOR_Y - obs.height + 10, 4, 4);

        // Bounding Box Collision check
        if (!gameState.current.dinoDead && !isGameOver) {
          const dinoLeft = DINO_X;
          const dinoRight = DINO_X + DINO_WIDTH;
          const dinoTop = currentDinoY;
          const dinoBottom = currentDinoY + DINO_HEIGHT;

          const obsLeft = obs.x;
          const obsRight = obs.x + obs.width;
          const obsTop = FLOOR_Y - obs.height;
          const obsBottom = FLOOR_Y;

          if (
            dinoRight - 4 > obsLeft &&
            dinoLeft + 4 < obsRight &&
            dinoBottom > obsTop &&
            dinoTop + 4 < obsBottom
          ) {
            // Collision!
            setIsGameOver(true);
          }
        }
      });

      // Filter out offscreen obstacles
      gameState.current.obstacles = gameState.current.obstacles.filter(obs => obs.x + obs.width > 0);

      // ── METEORITE (FINISHING STATE ANIMATION) ──
      if (isFinishingRef.current && !isGameOver) {
        if (!gameState.current.meteorite) {
          // Initialize meteorite falling from top right
          gameState.current.meteorite = {
            x: canvas.width - 40,
            y: -30,
            targetX: DINO_X + DINO_WIDTH / 2,
            targetY: FLOOR_Y - 10,
            size: 16,
            speed: 5.5,
            active: true
          };
        }

        const met = gameState.current.meteorite;
        if (met && met.active) {
          // Move meteorite towards Dino
          const dx = met.targetX - met.x;
          const dy = met.targetY - met.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 6) {
            met.x += (dx / dist) * met.speed;
            met.y += (dy / dist) * met.speed;

            // Draw Meteorite Tail/Fire
            ctx.fillStyle = 'rgba(234, 88, 12, 0.4)'; // orange-600 tail
            ctx.beginPath();
            ctx.arc(met.x - (dx / dist) * 12, met.y - (dy / dist) * 12, met.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(239, 68, 68, 0.6)'; // red-500 tail
            ctx.beginPath();
            ctx.arc(met.x - (dx / dist) * 6, met.y - (dy / dist) * 6, met.size * 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Draw Meteorite Body
            ctx.fillStyle = '#ea580c'; // orange-600
            ctx.beginPath();
            ctx.arc(met.x, met.y, met.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Collision with Dino!
            met.active = false;
            gameState.current.dinoDead = true;
            gameState.current.shakeTime = 25; // screen shake

            // Spawn explosion particles
            for (let i = 0; i < 35; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 2 + Math.random() * 6;
              gameState.current.particles.push({
                x: met.targetX,
                y: met.targetY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2, // blast slightly upward
                size: 2 + Math.random() * 4,
                color: Math.random() > 0.4 ? '#ef4444' : '#f97316', // red or orange
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03,
              });
            }

            // Fire completion callback after delay
            setTimeout(() => {
              onAnimationCompleteRef.current();
            }, 2200);
          }
        }
      }

      // ── PARTICLES (EXPLOSION EFFECTS) ──
      gameState.current.particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity effect on particles
        p.alpha -= p.decay;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });
      gameState.current.particles = gameState.current.particles.filter(p => p.alpha > 0);

      // ── DRAW DINO ──
      if (gameState.current.dinoDead) {
        // Draw squished/dead Dino knocked over
        ctx.save();
        ctx.translate(DINO_X + DINO_WIDTH / 2, FLOOR_Y - DINO_HEIGHT / 2);
        ctx.rotate(Math.PI / 2); // Rotate 90 deg
        drawDino(ctx, -DINO_WIDTH / 2, -DINO_HEIGHT / 2, DINO_WIDTH, DINO_HEIGHT, 0, true);
        ctx.restore();

        // Draw Speech Bubble
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; // dark slate
        ctx.strokeStyle = '#e2e8f0'; // slate-200
        ctx.lineWidth = 1;
        const bubbleX = DINO_X + 20;
        const bubbleY = FLOOR_Y - 50;
        const bubbleW = 120;
        const bubbleH = 32;

        ctx.beginPath();
        ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 12);
        ctx.fill();
        ctx.stroke();

        // Speech bubble tail
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.beginPath();
        ctx.moveTo(bubbleX + 15, bubbleY + bubbleH);
        ctx.lineTo(bubbleX + 8, bubbleY + bubbleH + 8);
        ctx.lineTo(bubbleX + 22, bubbleY + bubbleH);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('test ready, lol!', bubbleX + bubbleW / 2, bubbleY + 20);
      } else {
        // Draw normal/jumping Dino
        const legFrame = Math.floor(gameState.current.gameTime / 6) % 2;
        drawDino(ctx, DINO_X, currentDinoY, DINO_WIDTH, DINO_HEIGHT, isGameOver ? 2 : legFrame);
      }

      // ── DRAW GAMEOVER OVERLAY ──
      if (isGameOver && !gameState.current.dinoDead) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ef4444'; // red-500
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, 60);

        ctx.fillStyle = '#475569'; // slate-600
        ctx.font = '12px monospace';
        ctx.fillText('Press SPACE or TAP to Restart', canvas.width / 2, 85);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    animationFrameId = requestAnimationFrame(updateAndDraw);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameStarted, isGameOver, highScore]);

  // Dino Drawer Helper
  const drawDino = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    legFrame: number,
    isDead: boolean = false
  ) => {
    ctx.fillStyle = '#334155'; // slate-700 dino body
    
    // Draw body block
    ctx.fillRect(x + 4, y + 10, w - 8, 12);
    
    // Draw head block
    ctx.fillRect(x + 10, y, 12, 10);
    ctx.fillRect(x + 16, y + 2, 8, 4); // snout

    // Eye
    ctx.fillStyle = isDead ? '#ef4444' : '#ffffff';
    ctx.fillRect(x + 13, y + 3, 2, 2);

    // Spine bumps
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 2, y + 12, 2, 4);
    ctx.fillRect(x + 2, y + 18, 2, 4);

    // Tail
    ctx.fillRect(x, y + 14, 4, 6);

    // Tiny arm
    if (!isDead) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 16, y + 14, 4, 2);
    }

    // Legs
    ctx.fillStyle = '#1e293b';
    if (isDead) return;
    
    if (legFrame === 0) {
      // Left leg down
      ctx.fillRect(x + 6, y + 22, 2, 6);
      ctx.fillRect(x + 14, y + 22, 2, 4);
    } else if (legFrame === 1) {
      // Right leg down
      ctx.fillRect(x + 6, y + 22, 2, 4);
      ctx.fillRect(x + 14, y + 22, 2, 6);
    } else {
      // Game over legs
      ctx.fillRect(x + 6, y + 22, 2, 6);
      ctx.fillRect(x + 14, y + 22, 2, 6);
    }
  };

  return (
    <div className="mx-auto mt-6 w-full max-w-[640px] px-4" ref={containerRef}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition">
        {/* Top bar with score */}
        <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-mono tracking-wider text-slate-500">
          <span>{isFinishing ? '⚡ EXTRACTING TEST...' : '🦖 CHROME DINO STAGE'}</span>
          <div className="space-x-4">
            <span>HI: {String(highScore).padStart(4, '0')}</span>
            <span className="font-semibold text-slate-700">SCORE: {String(score).padStart(4, '0')}</span>
          </div>
        </div>

        {/* The Game Canvas */}
        <canvas
          ref={canvasRef}
          onClick={triggerJump}
          className="block w-full cursor-pointer rounded-lg bg-slate-50"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
}
