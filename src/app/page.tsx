"use client";

import { useCallback } from 'react';
import main from './main';

export default function Home() {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas !== null) {
      main(canvas);
    }
  }, []);

  return (
    <canvas id="fullscreenCanvas" className="v-screen h-screen" ref={canvasRef}></canvas>
  );
}
