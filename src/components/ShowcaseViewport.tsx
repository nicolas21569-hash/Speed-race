import { useEffect, useRef } from 'react';
import { ShowcaseMode, ShowcaseScene } from '../engine/showcaseScene';
import { PaintFinish } from '../types/game';

interface ShowcaseViewportProps {
  mode: ShowcaseMode;
  vehicleId: string;
  color?: string;
  finish?: PaintFinish;
}

/**
 * Isolated WebGL container for Main Menu and Garage/Shop 3D vehicle inspection.
 * Preserves WebGL context across React UI updates.
 */
export function ShowcaseViewport({
  mode,
  vehicleId,
  color,
  finish = 'metallic',
}: ShowcaseViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShowcaseScene | null>(null);
  const currentVehicleRef = useRef<string>(vehicleId);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const showcase = new ShowcaseScene(el, mode, vehicleId, color, finish);
    sceneRef.current = showcase;
    currentVehicleRef.current = vehicleId;

    return () => {
      showcase.dispose();
      sceneRef.current = null;
    };
    // Only recreate WebGL context when switching showcase mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (currentVehicleRef.current !== vehicleId) {
      currentVehicleRef.current = vehicleId;
      sc.setVehicle(vehicleId, color, finish);
    } else if (color) {
      sc.updatePaint(color, finish);
    }
  }, [vehicleId, color, finish]);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
}
