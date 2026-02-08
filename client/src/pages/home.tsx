import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const generateRoadPath = (width: number, height: number, points: number) => {
  const center = height * 0.38;
  let path = `M 0 ${center}`;
  for (let x = 0; x <= width; x += width / points) {
    const y = Math.sin(x * 0.002) * (height * 0.2) + center;
    path += ` L ${x} ${y}`;
  }
  return path;
};

const getRoadY = (x: number, height: number) => {
  return Math.sin(x * 0.002) * (height * 0.2) + (height * 0.38);
};

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [roadPath, setRoadPath] = useState("");
  const SCENE_WIDTH = 10000;

  useEffect(() => {
    setRoadPath(generateRoadPath(SCENE_WIDTH, window.innerHeight, 200));
  }, []);

  useEffect(() => {
    if (!roadPath) return;

    const ctx = gsap.context(() => {
      const totalScroll = SCENE_WIDTH - window.innerWidth;

      gsap.from(".lead-text, .body-text", {
        y: 60,
        opacity: 0,
        duration: 1.2,
        stagger: 0.3,
        ease: "power3.out"
      });

      gsap.to(".world", {
        x: -totalScroll,
        ease: "none",
        scrollTrigger: {
          trigger: ".layout-wrapper",
          start: "top top",
          end: "bottom bottom",
          scrub: 5,
        }
      });

      // clawd follows the road path
      const clawdOffset = window.innerWidth * 0.15;
      const amplitude = window.innerHeight * 0.25;
      const center = window.innerHeight / 2;

      ScrollTrigger.create({
        trigger: ".layout-wrapper",
        start: "top top",
        end: "bottom bottom",
        scrub: 3,
        onUpdate: (self) => {
          const scrollPos = self.progress * totalScroll;
          const currentWorldX = scrollPos + clawdOffset;
          const y = Math.sin(currentWorldX * 0.002) * amplitude + center;

          const slope = 0.002 * amplitude * Math.cos(currentWorldX * 0.002);
          const rotation = Math.atan(slope) * (180 / Math.PI);

          gsap.to("#clawd-container", {
            y: y - 80,
            rotation: rotation,
            duration: 1.4,
            ease: "power3.out",
            overwrite: "auto"
          });
        }
      });

      gsap.to(".bg-clouds", {
        x: -totalScroll * 0.08,
        ease: "none",
        scrollTrigger: {
          trigger: ".layout-wrapper",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        }
      });

      // sun tracking
      gsap.to(".sun-tracker", {
        left: "85%",
        top: "60%",
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".layout-wrapper",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        }
      });

    }, containerRef);

    return () => ctx.revert();
  }, [roadPath]);

  return (
    <div ref={containerRef} className="layout-wrapper relative" style={{ height: `${SCENE_WIDTH}px` }}>
      <div className="viewport fixed top-0 left-0 w-full h-screen overflow-hidden">

        <div className="sky-gradient absolute inset-0 z-0" />

        {/* sun */}
        <div className="sun-tracker absolute z-1 pointer-events-none" style={{ left: '10%', top: '8%' }}>
          <svg viewBox="0 0 120 120" width="100" height="100">
            <circle cx="60" cy="60" r="35" fill="#f1c40f" className="sun-glow" />
            <circle cx="60" cy="60" r="28" fill="#f39c12" />
            {[...Array(12)].map((_, i) => (
              <line key={i} x1="60" y1="8" x2="60" y2="18" stroke="#f1c40f" strokeWidth="3" strokeLinecap="round"
                transform={`rotate(${i * 30} 60 60)`} />
            ))}
          </svg>
        </div>

        {/* header */}
        <div className="fixed top-0 left-0 w-full z-50 p-6 flex justify-between items-center pointer-events-none">
          <div className="pointer-events-auto">
            <h1 className="text-3xl font-black text-white drop-shadow-lg italic tracking-tighter transform -skew-x-12">
              CLAWD<span className="text-yellow-300">SWARM</span>
            </h1>
          </div>
        </div>

        {/* clouds */}
        <div className="bg-clouds absolute inset-0 w-[200%] h-full z-1 pointer-events-none">
          <svg viewBox="0 0 2000 400" className="w-full h-full" preserveAspectRatio="none">
            <g fill="white" opacity="0.7">
              <ellipse cx="150" cy="80" rx="80" ry="35" />
              <ellipse cx="200" cy="65" rx="60" ry="30" />
              <ellipse cx="110" cy="75" rx="50" ry="25" />
            </g>
            <g fill="white" opacity="0.5">
              <ellipse cx="550" cy="50" rx="90" ry="35" />
              <ellipse cx="610" cy="40" rx="70" ry="30" />
              <ellipse cx="500" cy="45" rx="55" ry="25" />
            </g>
            <g fill="white" opacity="0.6">
              <ellipse cx="950" cy="90" rx="85" ry="32" />
              <ellipse cx="1010" cy="78" rx="65" ry="28" />
              <ellipse cx="900" cy="85" rx="50" ry="22" />
            </g>
            <g fill="white" opacity="0.4">
              <ellipse cx="1350" cy="60" rx="75" ry="30" />
              <ellipse cx="1400" cy="48" rx="55" ry="25" />
              <ellipse cx="1310" cy="55" rx="45" ry="20" />
            </g>
          </svg>
        </div>

        {/* ocean waves */}
        <div className="absolute bottom-0 left-0 w-full z-2 pointer-events-none" style={{ height: '12%' }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full">
            <path className="wave-back" d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill="rgba(30,130,180,0.3)" />
            <path className="wave-mid" d="M0,70 C200,110 440,30 720,70 C1000,110 1240,30 1440,70 L1440,120 L0,120 Z" fill="rgba(30,130,180,0.4)" />
            <path className="wave-front" d="M0,80 C180,110 400,50 720,80 C1040,110 1260,50 1440,80 L1440,120 L0,120 Z" fill="rgba(30,130,180,0.5)" />
          </svg>
        </div>

        {/* clawd character */}
        <div
          id="clawd-container"
          className="fixed left-[15vw] z-40 pointer-events-none drop-shadow-2xl will-change-transform"
          style={{ top: 0 }}
        >
          <svg viewBox="0 0 300 200" width="240" height="160" className="overflow-visible">
            <defs>
              <radialGradient id="shellGradient" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ff7e5f" />
                <stop offset="100%" stopColor="#c0392b" />
              </radialGradient>
              <linearGradient id="legGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e74c3c" />
                <stop offset="100%" stopColor="#922b21" />
              </linearGradient>
              <radialGradient id="eyeGradient" cx="30%" cy="30%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="90%" stopColor="#bdc3c7" />
                <stop offset="100%" stopColor="#7f8c8d" />
              </radialGradient>
            </defs>

            {/* legs */}
            <g stroke="url(#legGradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M80,120 Q60,150 40,170" className="leg-anim-1" />
              <path d="M70,130 Q50,160 30,180" className="leg-anim-2" />
              <path d="M60,140 Q40,170 20,190" className="leg-anim-1" />
              <path d="M220,120 Q240,150 260,170" className="leg-anim-2" />
              <path d="M230,130 Q250,160 270,180" className="leg-anim-1" />
              <path d="M240,140 Q260,170 280,190" className="leg-anim-2" />
            </g>

            {/* shell */}
            <path d="M70,100 C70,50 110,30 150,30 C190,30 230,50 230,100 C230,140 190,160 150,160 C110,160 70,140 70,100 Z" fill="url(#shellGradient)" stroke="#922b21" strokeWidth="2" />

            {/* eyes */}
            <g>
              <path d="M120,50 Q110,20 100,10" stroke="#c0392b" strokeWidth="6" fill="none" />
              <circle cx="100" cy="10" r="12" fill="url(#eyeGradient)" stroke="#922b21" strokeWidth="1" />
              <circle cx="100" cy="10" r="4" fill="#000" />
              <circle cx="102" cy="8" r="2" fill="#fff" />
              <path d="M180,50 Q190,20 200,10" stroke="#c0392b" strokeWidth="6" fill="none" />
              <circle cx="200" cy="10" r="12" fill="url(#eyeGradient)" stroke="#922b21" strokeWidth="1" />
              <circle cx="200" cy="10" r="4" fill="#000" />
              <circle cx="202" cy="8" r="2" fill="#fff" />
            </g>

            {/* claws */}
            <g>
              <g transform="translate(60, 90) rotate(-20)">
                <path d="M0,0 Q-30,-20 -40,10 Q-30,40 0,20 Z" fill="url(#shellGradient)" stroke="#922b21" strokeWidth="2" />
                <path d="M-40,10 Q-60,5 -50,-15" fill="none" stroke="#922b21" strokeWidth="4" />
              </g>
              <g transform="translate(240, 90) rotate(20)">
                <path d="M0,0 Q30,-30 60,10 Q30,50 0,20 Z" fill="url(#shellGradient)" stroke="#922b21" strokeWidth="2" />
                <path d="M60,10 Q80,0 70,-30" fill="none" stroke="#922b21" strokeWidth="6" />
                <path d="M60,10 Q80,20 70,40" fill="none" stroke="#922b21" strokeWidth="4" />
              </g>
            </g>
          </svg>
        </div>

        {/* scrolling world */}
        <div className="world absolute top-0 left-0 h-full flex z-10 will-change-transform" style={{ width: SCENE_WIDTH }}>
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <rect x="0" y="0" width="100%" height="100%" fill="#f4a460" />
            <path d={roadPath} fill="none" stroke="#7f8c8d" strokeWidth="120" strokeLinecap="round" className="drop-shadow-lg" />
            <path d={roadPath} fill="none" stroke="#f1c40f" strokeWidth="4" strokeDasharray="20 40" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
