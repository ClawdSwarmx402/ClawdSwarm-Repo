import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// attempt at a sine-wave road across the scene
const generateRoadPath = (width: number, height: number, points: number) => {
  const center = height * 0.38;
  let path = `M 0 ${center}`;
  for (let x = 0; x <= width; x += width / points) {
    const y = Math.sin(x * 0.002) * (height * 0.2) + center;
    path += ` L ${x} ${y}`;
  }
  return path;
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

      // hero text entrance
      gsap.from(".lead-text, .body-text", {
        y: 60,
        opacity: 0,
        duration: 1.2,
        stagger: 0.3,
        ease: "power3.out"
      });

      // horizontal scroll driven by vertical scrolling
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

      // parallax on cloud layer
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
    }, containerRef);

    return () => ctx.revert();
  }, [roadPath]);

  return (
    <div ref={containerRef} className="layout-wrapper relative" style={{ height: `${SCENE_WIDTH}px` }}>
      <div className="viewport fixed top-0 left-0 w-full h-screen overflow-hidden">

        {/* sky bg */}
        <div className="sky-gradient absolute inset-0 z-0" />

        {/* sun */}
        <div className="absolute z-1 pointer-events-none" style={{ left: '10%', top: '8%' }}>
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
          </svg>
        </div>

        {/* ocean waves at bottom */}
        <div className="absolute bottom-0 left-0 w-full z-2 pointer-events-none" style={{ height: '12%' }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill="rgba(30,130,180,0.3)" />
            <path d="M0,70 C200,110 440,30 720,70 C1000,110 1240,30 1440,70 L1440,120 L0,120 Z" fill="rgba(30,130,180,0.4)" />
            <path d="M0,80 C180,110 400,50 720,80 C1040,110 1260,50 1440,80 L1440,120 L0,120 Z" fill="rgba(30,130,180,0.5)" />
          </svg>
        </div>

        {/* scrolling world with road */}
        <div className="world absolute top-0 left-0 h-full flex z-10 will-change-transform" style={{ width: SCENE_WIDTH }}>
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <rect x="0" y="0" width="100%" height="100%" fill="#f4a460" />
            <path d={roadPath} fill="none" stroke="#7f8c8d" strokeWidth="120" strokeLinecap="round" />
            <path d={roadPath} fill="none" stroke="#f1c40f" strokeWidth="4" strokeDasharray="20 40" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
