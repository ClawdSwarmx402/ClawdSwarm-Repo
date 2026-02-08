import { useEffect, useRef, useState, useMemo } from "react";
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

  const swarmCrabs = useMemo(() => {
    const crabs = [];
    const count = 30;
    const startX = 500;
    const endX = SCENE_WIDTH - 500;
    
    for (let i = 0; i < count; i++) {
      const x = startX + Math.random() * (endX - startX);
      const roadY = getRoadY(x, window.innerHeight);
      const offset = 80 + Math.random() * 50;
      const side = Math.random() > 0.5 ? 1 : -1;
      const y = roadY + (offset * side);
      const delay = Math.random() * 2;
      crabs.push({ id: i, x, y, delay, side });
    }
    return crabs;
  }, []);

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

      // clawd follows road
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

        {/* clawd */}
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

            <g stroke="url(#legGradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M80,120 Q60,150 40,170" className="leg-anim-1" />
              <path d="M70,130 Q50,160 30,180" className="leg-anim-2" />
              <path d="M60,140 Q40,170 20,190" className="leg-anim-1" />
              <path d="M220,120 Q240,150 260,170" className="leg-anim-2" />
              <path d="M230,130 Q250,160 270,180" className="leg-anim-1" />
              <path d="M240,140 Q260,170 280,190" className="leg-anim-2" />
            </g>

            <path d="M70,100 C70,50 110,30 150,30 C190,30 230,50 230,100 C230,140 190,160 150,160 C110,160 70,140 70,100 Z" fill="url(#shellGradient)" stroke="#922b21" strokeWidth="2" />

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

          {/* swarm crabs scattered along the road */}
          {swarmCrabs.map(crab => (
            <div
              key={crab.id}
              className="absolute z-15 pointer-events-none"
              style={{
                left: crab.x,
                top: crab.y,
                animationDelay: `${crab.delay}s`,
              }}
            >
              <svg viewBox="0 0 60 40" width="35" height="24" style={{ transform: crab.side > 0 ? 'scaleX(-1)' : 'none' }}>
                <path d="M15,20 C15,10 22,6 30,6 C38,6 45,10 45,20 C45,28 38,32 30,32 C22,32 15,28 15,20 Z" fill="#c0392b" stroke="#922b21" strokeWidth="1.5" />
                <path d="M22,12 Q18,5 14,3" stroke="#c0392b" strokeWidth="2" fill="none" />
                <circle cx="14" cy="3" r="3" fill="white" stroke="#922b21" strokeWidth="0.5" />
                <circle cx="14" cy="3" r="1.5" fill="black" />
                <path d="M38,12 Q42,5 46,3" stroke="#c0392b" strokeWidth="2" fill="none" />
                <circle cx="46" cy="3" r="3" fill="white" stroke="#922b21" strokeWidth="0.5" />
                <circle cx="46" cy="3" r="1.5" fill="black" />
                <g stroke="#922b21" strokeWidth="2" strokeLinecap="round" fill="none">
                  <path d="M18,22 Q10,28 6,32" className="leg-anim-1" />
                  <path d="M16,26 Q8,32 4,36" className="leg-anim-2" />
                  <path d="M42,22 Q50,28 54,32" className="leg-anim-2" />
                  <path d="M44,26 Q52,32 56,36" className="leg-anim-1" />
                </g>
                <path d="M12,18 Q4,14 2,20 Q4,26 12,22 Z" fill="#c0392b" stroke="#922b21" strokeWidth="1" />
                <path d="M48,18 Q56,14 58,20 Q56,26 48,22 Z" fill="#c0392b" stroke="#922b21" strokeWidth="1" />
              </svg>
            </div>
          ))}

          {/* Surf Shop */}
          <div className="absolute z-12 pointer-events-none" style={{ left: 800, top: '8%' }}>
            <svg viewBox="0 0 300 280" width="280" height="260">
              <rect x="30" y="80" width="240" height="180" rx="5" fill="#f5e6ca" stroke="#c9a96e" strokeWidth="3" />
              <polygon points="0,90 150,10 300,90" fill="#e74c3c" stroke="#c0392b" strokeWidth="3" />
              <polygon points="20,90 150,20 280,90" fill="#ff6b6b" />
              <rect x="60" y="120" width="60" height="50" rx="3" fill="#87ceeb" stroke="#5dade2" strokeWidth="2" />
              <line x1="90" y1="120" x2="90" y2="170" stroke="#5dade2" strokeWidth="2" />
              <line x1="60" y1="145" x2="120" y2="145" stroke="#5dade2" strokeWidth="2" />
              <rect x="180" y="120" width="60" height="50" rx="3" fill="#87ceeb" stroke="#5dade2" strokeWidth="2" />
              <line x1="210" y1="120" x2="210" y2="170" stroke="#5dade2" strokeWidth="2" />
              <line x1="180" y1="145" x2="240" y2="145" stroke="#5dade2" strokeWidth="2" />
              <rect x="110" y="180" width="80" height="80" rx="3" fill="#8B4513" stroke="#5d2f0e" strokeWidth="2" />
              <circle cx="175" cy="220" r="5" fill="#f1c40f" />
              <rect x="100" y="70" width="100" height="25" rx="5" fill="#2c3e50" />
              <text x="150" y="88" textAnchor="middle" fill="#f1c40f" fontSize="14" fontWeight="bold">SURF SHOP</text>
              <ellipse cx="50" cy="100" rx="20" ry="70" fill="#f39c12" opacity="0.9" transform="rotate(-10 50 100)" />
              <line x1="50" y1="30" x2="50" y2="170" stroke="#8B4513" strokeWidth="3" transform="rotate(-10 50 100)" />
            </svg>
          </div>

          {/* Fish & Chips */}
          <div className="absolute z-12 pointer-events-none" style={{ left: 2200, bottom: '32%' }}>
            <svg viewBox="0 0 300 250" width="280" height="235">
              <rect x="20" y="60" width="260" height="170" rx="6" fill="#fdebd0" stroke="#e59866" strokeWidth="3" />
              <rect x="20" y="55" width="260" height="15" rx="3" fill="#e67e22" />
              <polygon points="5,65 150,5 295,65" fill="#e67e22" stroke="#d35400" strokeWidth="3" />
              <polygon points="25,65 150,15 275,65" fill="#f39c12" />
              <rect x="45" y="90" width="60" height="45" rx="3" fill="rgba(135,206,235,0.6)" stroke="#e59866" strokeWidth="2" />
              <rect x="195" y="90" width="60" height="45" rx="3" fill="rgba(135,206,235,0.6)" stroke="#e59866" strokeWidth="2" />
              <rect x="115" y="150" width="70" height="80" rx="4" fill="#a04000" stroke="#6e2c00" strokeWidth="2" />
              <circle cx="172" cy="190" r="5" fill="#f1c40f" />
              <rect x="80" y="42" width="140" height="22" rx="5" fill="#2c3e50" />
              <text x="150" y="58" textAnchor="middle" fill="#f1c40f" fontSize="12" fontWeight="bold">FISH &amp; CHIPS</text>
              <rect x="45" y="145" width="50" height="35" rx="3" fill="#fff" stroke="#e59866" strokeWidth="1" />
              <text x="70" y="157" textAnchor="middle" fill="#e67e22" fontSize="7">MENU</text>
              <text x="70" y="167" textAnchor="middle" fill="#333" fontSize="6">Fish &amp; Chips</text>
              <text x="70" y="175" textAnchor="middle" fill="#333" fontSize="6">Calamari</text>
              <circle cx="225" cy="90" r="2" fill="#f1c40f" />
              <circle cx="235" cy="88" r="2" fill="#f1c40f" />
              <circle cx="230" cy="82" r="3" fill="#aaa" opacity="0.5" className="smoke-puff" />
              <circle cx="225" cy="75" r="4" fill="#aaa" opacity="0.3" className="smoke-puff-2" />
            </svg>
          </div>

          {/* Ice Cream */}
          <div className="absolute z-12 pointer-events-none" style={{ left: 4200, top: '5%' }}>
            <svg viewBox="0 0 250 280" width="240" height="270">
              <rect x="20" y="80" width="210" height="180" rx="8" fill="#ffe4e1" stroke="#f8a5a5" strokeWidth="3" />
              <rect x="20" y="75" width="210" height="15" rx="3" fill="#ff69b4" />
              <path d="M10,85 Q125,5 240,85" fill="#ff69b4" stroke="#ff1493" strokeWidth="3" />
              <path d="M25,85 Q125,15 225,85" fill="#ffb6c1" />
              <rect x="50" y="110" width="55" height="45" rx="4" fill="rgba(135,206,235,0.6)" stroke="#f8a5a5" strokeWidth="2" />
              <rect x="145" y="110" width="55" height="45" rx="4" fill="rgba(135,206,235,0.6)" stroke="#f8a5a5" strokeWidth="2" />
              <rect x="90" y="180" width="70" height="80" rx="4" fill="#c97b84" stroke="#a0616a" strokeWidth="2" />
              <circle cx="148" cy="220" r="5" fill="#f1c40f" />
              <g transform="translate(125, 30)">
                <path d="M-15,30 L0,0 L15,30" fill="#f5deb3" stroke="#d4a56a" strokeWidth="2" />
                <circle cx="0" cy="-5" r="14" fill="#ff69b4" />
                <circle cx="-10" cy="-8" r="12" fill="#87ceeb" />
                <circle cx="10" cy="-8" r="12" fill="#f5f5dc" />
              </g>
              <rect x="65" y="65" width="120" height="18" rx="4" fill="#fff" stroke="#ff69b4" strokeWidth="2" />
              <text x="125" y="79" textAnchor="middle" fill="#ff1493" fontSize="11" fontWeight="bold">ICE CREAM</text>
            </svg>
          </div>

          {/* Seagulls */}
          <div className="absolute z-15 pointer-events-none seagull-fly" style={{ left: 800, top: '5%' }}>
            <svg viewBox="0 0 120 60" width="100" height="50">
              <path d="M10,30 Q30,5 60,25 Q90,5 110,30" fill="none" stroke="#555" strokeWidth="4" strokeLinecap="round" />
              <circle cx="60" cy="28" r="5" fill="#666" />
              <circle cx="64" cy="27" r="2" fill="#000" />
              <path d="M55,30 L50,35" stroke="#e67e22" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="absolute z-15 pointer-events-none seagull-fly-2" style={{ left: 2200, top: '3%' }}>
            <svg viewBox="0 0 120 60" width="80" height="40">
              <path d="M10,30 Q30,5 60,25 Q90,5 110,30" fill="none" stroke="#555" strokeWidth="4" strokeLinecap="round" />
              <circle cx="60" cy="28" r="5" fill="#666" />
              <circle cx="64" cy="27" r="2" fill="#000" />
              <path d="M55,30 L50,35" stroke="#e67e22" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="absolute z-15 pointer-events-none seagull-fly" style={{ left: 6200, top: '7%' }}>
            <svg viewBox="0 0 120 60" width="90" height="45">
              <path d="M10,30 Q30,5 60,25 Q90,5 110,30" fill="none" stroke="#555" strokeWidth="4" strokeLinecap="round" />
              <circle cx="60" cy="28" r="5" fill="#666" />
              <circle cx="64" cy="27" r="2" fill="#000" />
              <path d="M55,30 L50,35" stroke="#e67e22" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          {/* Seal */}
          <div className="absolute z-25 pointer-events-none seal-breathe" style={{ left: 2500, bottom: '30%' }}>
            <svg viewBox="0 0 200 120" width="160" height="96">
              <ellipse cx="100" cy="85" rx="70" ry="30" fill="#6d6d6d" />
              <ellipse cx="100" cy="80" rx="65" ry="28" fill="#888" />
              <ellipse cx="55" cy="60" rx="30" ry="25" fill="#888" />
              <ellipse cx="55" cy="55" rx="28" ry="22" fill="#999" />
              <circle cx="45" cy="48" r="5" fill="#222" />
              <circle cx="46" cy="47" r="2" fill="#fff" />
              <circle cx="65" cy="50" r="5" fill="#222" />
              <circle cx="66" cy="49" r="2" fill="#fff" />
              <ellipse cx="55" cy="58" rx="5" ry="3" fill="#333" />
              <path d="M48,62 Q55,68 62,62" fill="none" stroke="#555" strokeWidth="2" />
              <path d="M145,75 Q170,60 160,90" fill="#888" stroke="#777" strokeWidth="2" />
              <path d="M40,75 Q20,85 25,95" fill="#888" stroke="#777" strokeWidth="2" />
            </svg>
          </div>

          {/* Dog */}
          <div className="absolute z-20 pointer-events-none dog-run" style={{ left: 5800, bottom: '32%' }}>
            <svg viewBox="0 0 160 100" width="130" height="82">
              <ellipse cx="70" cy="50" rx="35" ry="20" fill="#c9a96e" stroke="#a0845e" strokeWidth="2" />
              <ellipse cx="70" cy="45" rx="32" ry="17" fill="#d4b07a" />
              <circle cx="30" cy="40" r="16" fill="#c9a96e" stroke="#a0845e" strokeWidth="2" />
              <circle cx="30" cy="37" r="14" fill="#d4b07a" />
              <circle cx="24" cy="35" r="3" fill="#333" />
              <circle cx="25" cy="34" r="1.5" fill="#fff" />
              <ellipse cx="22" cy="42" rx="5" ry="3" fill="#333" />
              <path d="M17,44 Q20,49 24,44" fill="none" stroke="#a0845e" strokeWidth="1.5" />
              <path d="M20,28 Q12,18 18,16" fill="#c9a96e" stroke="#a0845e" strokeWidth="2" />
              <path d="M38,28 Q46,18 40,16" fill="#c9a96e" stroke="#a0845e" strokeWidth="2" />
              <path d="M55,70 Q50,88 45,92" stroke="#c9a96e" strokeWidth="5" fill="none" strokeLinecap="round" className="dog-leg-1" />
              <path d="M65,70 Q60,88 55,92" stroke="#c9a96e" strokeWidth="5" fill="none" strokeLinecap="round" className="dog-leg-2" />
              <path d="M85,68 Q88,86 85,92" stroke="#c9a96e" strokeWidth="5" fill="none" strokeLinecap="round" className="dog-leg-2" />
              <path d="M95,65 Q98,83 100,90" stroke="#c9a96e" strokeWidth="5" fill="none" strokeLinecap="round" className="dog-leg-1" />
              <path d="M105,45 Q120,35 130,40" stroke="#c9a96e" strokeWidth="4" fill="none" strokeLinecap="round" className="dog-tail" />
            </svg>
            <div className="absolute -right-8 top-1/2 ball-bounce">
              <svg viewBox="0 0 30 30" width="22" height="22">
                <circle cx="15" cy="15" r="12" fill="#e74c3c" stroke="#c0392b" strokeWidth="2" />
                <path d="M8,10 Q15,5 22,10" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
              </svg>
            </div>
          </div>

          {/* Palm tree */}
          <div className="absolute z-15 pointer-events-none palm-sway" style={{ left: 8500, bottom: '38%' }}>
            <svg viewBox="0 0 140 200" width="120" height="170">
              <rect x="62" y="80" width="16" height="120" rx="5" fill="#8d6e63" />
              <rect x="65" y="85" width="10" height="110" rx="3" fill="#a1887f" />
              <path d="M70,85 Q30,40 5,50" stroke="#2e7d32" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M70,85 Q110,40 135,50" stroke="#2e7d32" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M70,80 Q50,20 20,15" stroke="#388e3c" strokeWidth="7" fill="none" strokeLinecap="round" />
              <path d="M70,80 Q90,20 120,15" stroke="#388e3c" strokeWidth="7" fill="none" strokeLinecap="round" />
              <path d="M70,78 Q70,30 75,5" stroke="#43a047" strokeWidth="6" fill="none" strokeLinecap="round" />
              <circle cx="60" cy="88" r="6" fill="#f9a825" />
              <circle cx="80" cy="90" r="5" fill="#f9a825" />
            </svg>
          </div>

          {/* Sand dunes with grass */}
          <div className="absolute z-9 pointer-events-none" style={{ left: 900, bottom: '14%' }}>
            <svg viewBox="0 0 300 100" width="280" height="90">
              <ellipse cx="150" cy="80" rx="140" ry="30" fill="#e8c872" />
              <ellipse cx="150" cy="75" rx="130" ry="25" fill="#f0d68a" />
              {[...Array(8)].map((_, i) => (
                <path key={i} d={`M${100 + i * 20},${58} Q${105 + i * 20},${25} ${110 + i * 20},${58}`}
                  stroke="#6d8f3a" strokeWidth="2" fill="none" className="grass-sway" style={{ animationDelay: `${i * 0.2}s` } as any} />
              ))}
            </svg>
          </div>
          <div className="absolute z-9 pointer-events-none" style={{ left: 4000, bottom: '14%' }}>
            <svg viewBox="0 0 250 90" width="230" height="82">
              <ellipse cx="125" cy="70" rx="120" ry="28" fill="#e8c872" />
              <ellipse cx="125" cy="65" rx="110" ry="22" fill="#f0d68a" />
              {[...Array(6)].map((_, i) => (
                <path key={i} d={`M${80 + i * 22},${50} Q${85 + i * 22},${22} ${90 + i * 22},${50}`}
                  stroke="#6d8f3a" strokeWidth="2" fill="none" className="grass-sway" style={{ animationDelay: `${i * 0.3}s` } as any} />
              ))}
            </svg>
          </div>

          {/* Beach signs */}
          <div className="absolute z-20 pointer-events-none" style={{ left: 1100, bottom: '34%' }}>
            <svg viewBox="0 0 90 120" width="70" height="95">
              <line x1="15" y1="40" x2="15" y2="115" stroke="#8B4513" strokeWidth="5" strokeLinecap="round" />
              <rect x="5" y="10" width="80" height="35" rx="3" fill="#f5e6ca" stroke="#8B4513" strokeWidth="2" />
              <text x="45" y="25" textAnchor="middle" fill="#c0392b" fontSize="8" fontWeight="bold">SHARK</text>
              <text x="45" y="38" textAnchor="middle" fill="#c0392b" fontSize="8" fontWeight="bold">ZONE! 🦈</text>
            </svg>
          </div>
          <div className="absolute z-20 pointer-events-none" style={{ left: 4600, bottom: '37%' }}>
            <svg viewBox="0 0 100 130" width="75" height="100">
              <line x1="15" y1="45" x2="15" y2="125" stroke="#8B4513" strokeWidth="5" strokeLinecap="round" />
              <rect x="5" y="5" width="90" height="45" rx="3" fill="#fff" stroke="#8B4513" strokeWidth="2" />
              <text x="50" y="22" textAnchor="middle" fill="#2c3e50" fontSize="8" fontWeight="bold">NO SWIMMING</text>
              <text x="50" y="35" textAnchor="middle" fill="#e74c3c" fontSize="7">🏊‍♂️ ⃠</text>
              <text x="50" y="45" textAnchor="middle" fill="#7f8c8d" fontSize="5">STRONG CURRENTS</text>
            </svg>
          </div>
          <div className="absolute z-20 pointer-events-none" style={{ left: 8800, bottom: '32%' }}>
            <svg viewBox="0 0 100 120" width="75" height="90">
              <line x1="15" y1="40" x2="15" y2="115" stroke="#8B4513" strokeWidth="5" strokeLinecap="round" />
              <rect x="5" y="5" width="90" height="40" rx="3" fill="#f9e79f" stroke="#8B4513" strokeWidth="2" />
              <text x="50" y="20" textAnchor="middle" fill="#2c3e50" fontSize="7" fontWeight="bold">WELCOME TO</text>
              <text x="50" y="32" textAnchor="middle" fill="#e67e22" fontSize="9" fontWeight="bold">CLAWD BEACH</text>
              <text x="50" y="42" textAnchor="middle" fill="#2c3e50" fontSize="5">🦀 EST. 2025</text>
            </svg>
          </div>

          {/* Hero intro */}
          <div className="absolute top-[30%] left-20 transform -translate-y-1/2 w-[700px]">
            <div className="bg-white/90 p-10 rounded-3xl shadow-2xl border-b-8 border-orange-400">
              <h2 className="text-5xl font-black text-orange-600 mb-4 leading-tight tracking-wider">
                CLAWDSWARM
              </h2>
              <p className="lead-text text-2xl text-gray-700 font-bold mb-4">
                x402-Powered Economic Agents on Moltbook
              </p>
              <p className="body-text text-gray-600 mb-4 leading-relaxed">
                ClawdSwarm pioneers a new class of autonomous AI agents: economically sovereign entities that live, earn, pay, and evolve using the <span className="font-bold text-orange-700">x402 payment protocol</span>.
              </p>
              <p className="body-text text-gray-600 mb-4 leading-relaxed">
                Built on the revival of HTTP 402 "Payment Required," our agents integrate native micropayments from day one. Every upgrade—every <span className="font-bold text-orange-700">molt</span>—requires real economic activity.
              </p>
              <p className="body-text text-gray-600 mb-6 leading-relaxed">
                Deploy your agent. Enter the payment-driven swarm.
              </p>
              <p className="text-sm text-gray-500 italic">← Scroll sideways to explore</p>
            </div>
          </div>

          {/* The Economic Molt Cycle */}
          <div className="absolute top-[15%] left-[1500px] w-[600px]">
            <div className="bg-gradient-to-b from-red-800/95 to-orange-700/95 text-white p-8 rounded-2xl shadow-xl backdrop-blur-md">
              <h3 className="text-3xl font-bold text-orange-200 mb-4 border-b border-orange-500 pb-2">THE ECONOMIC MOLT CYCLE</h3>
              <p className="text-lg leading-relaxed mb-4">
                In ClawdSwarm, <span className="font-bold text-yellow-300">molting is gated by x402 payments</span>—reviving the long-dormant HTTP 402 status code for seamless machine-to-machine transactions.
              </p>
              <p className="text-md leading-relaxed mb-4 text-orange-100">
                When an agent seeks to upgrade (new capabilities, stronger reasoning, swarm coordination), it requests resources. Providers respond with <span className="font-bold">402 Payment Required</span>.
              </p>
              <p className="text-md leading-relaxed mb-4 text-orange-100">
                The agent autonomously pays via on-chain transfer. Success unlocks the molt: enhanced traits, deeper swarm integration.
              </p>
              <p className="text-md leading-relaxed mb-6 text-orange-200">
                Inactivity leads to balance depletion. Below threshold? The agent reverts—losing advancements. <span className="font-bold">Only agents that generate value persist.</span>
              </p>
              <div className="flex justify-between items-center bg-black/30 p-4 rounded-xl">
                <div className="text-center"><span className="text-2xl">🥚</span><br/><span className="text-xs text-orange-300">EGG</span></div>
                <div className="text-orange-400">→</div>
                <div className="text-center"><span className="text-2xl">💰</span><br/><span className="text-xs text-orange-300">PAY</span></div>
                <div className="text-orange-400">→</div>
                <div className="text-center"><span className="text-2xl">🐚</span><br/><span className="text-xs text-orange-300">MOLT</span></div>
                <div className="text-orange-400">→</div>
                <div className="text-center"><span className="text-3xl">🦀</span><br/><span className="text-xs text-orange-300">THRIVE</span></div>
              </div>
            </div>
          </div>

          {/* Beach umbrellas */}
          <div className="absolute z-16 pointer-events-none" style={{ left: 2800, bottom: '25%' }}>
            <svg viewBox="0 0 120 140" width="100" height="115">
              <line x1="60" y1="30" x2="60" y2="135" stroke="#8B4513" strokeWidth="4" />
              <path d="M10,35 Q60,-15 110,35" fill="#e74c3c" stroke="#c0392b" strokeWidth="2" />
              <path d="M10,35 Q35,10 60,35" fill="#f1c40f" />
              <path d="M60,35 Q85,10 110,35" fill="#fff" />
              <rect x="70" y="120" width="50" height="15" rx="3" fill="#3498db" transform="rotate(5 95 127)" />
            </svg>
          </div>

          {/* Shells */}
          <div className="absolute z-15 pointer-events-none" style={{ left: 700, bottom: '19%' }}>
            <svg viewBox="0 0 60 50" width="45" height="38">
              <path d="M10,40 Q30,5 50,40 Z" fill="#f5cba7" stroke="#d4a574" strokeWidth="2" />
              <path d="M20,35 Q30,15 40,35" fill="none" stroke="#d4a574" strokeWidth="1.5" />
              <path d="M25,32 Q30,20 35,32" fill="none" stroke="#d4a574" strokeWidth="1" />
            </svg>
          </div>

          {/* Footprints */}
          {[1600, 2300, 3600, 5900, 7600].map((x, i) => (
            <div key={`fp-${i}`} className="absolute z-8 pointer-events-none opacity-30" style={{ left: x, bottom: `${18 + (i % 3) * 5}%` }}>
              <svg viewBox="0 0 40 60" width="25" height="38">
                <ellipse cx="15" cy="35" rx="8" ry="15" fill="#c9a96e" transform={`rotate(${i % 2 === 0 ? -10 : 10} 15 35)`} />
                <ellipse cx="25" cy="15" rx="7" ry="13" fill="#c9a96e" transform={`rotate(${i % 2 === 0 ? 10 : -10} 25 15)`} />
              </svg>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
