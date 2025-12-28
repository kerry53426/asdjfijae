import { CalibrationPoint, Coord, PixelCoord } from '../types';

/**
 * Solves an Affine Transformation Matrix from 3 calibration points.
 * Maps (Lat, Lng) -> (PixelX, PixelY)
 * 
 * Formula:
 * x = A * lat + B * lng + C
 * y = D * lat + E * lng + F
 */
export const getAffineTransform = (points: CalibrationPoint[]) => {
  if (points.length < 3) return null;

  // We use the first 3 points to create a deterministic plane
  const p1 = points[0];
  const p2 = points[1];
  const p3 = points[2];

  // Helper to calculate determinant
  const det = (
    p1.lat * (p2.lng - p3.lng) +
    p2.lat * (p3.lng - p1.lng) +
    p3.lat * (p1.lng - p2.lng)
  );

  if (Math.abs(det) < 1e-9) return null; // Collinear points

  const A = (
    (p1.pixel_x * (p2.lng - p3.lng)) +
    (p2.pixel_x * (p3.lng - p1.lng)) +
    (p3.pixel_x * (p1.lng - p2.lng))
  ) / det;

  const B = (
    (p1.pixel_x * (p3.lat - p2.lat)) +
    (p2.pixel_x * (p1.lat - p3.lat)) +
    (p3.pixel_x * (p2.lat - p1.lat))
  ) / det;

  const C = (
    (p1.pixel_x * (p2.lat * p3.lng - p3.lat * p2.lng)) +
    (p2.pixel_x * (p3.lat * p1.lng - p1.lat * p3.lng)) +
    (p3.pixel_x * (p1.lat * p2.lng - p2.lat * p1.lng))
  ) / det;

  const D = (
    (p1.pixel_y * (p2.lng - p3.lng)) +
    (p2.pixel_y * (p3.lng - p1.lng)) +
    (p3.pixel_y * (p1.lng - p2.lng))
  ) / det;

  const E = (
    (p1.pixel_y * (p3.lat - p2.lat)) +
    (p2.pixel_y * (p1.lat - p3.lat)) +
    (p3.pixel_y * (p2.lat - p1.lat))
  ) / det;

  const F = (
    (p1.pixel_y * (p2.lat * p3.lng - p3.lat * p2.lng)) +
    (p2.pixel_y * (p3.lat * p1.lng - p1.lat * p3.lng)) +
    (p3.pixel_y * (p1.lat * p2.lng - p2.lat * p1.lng))
  ) / det;

  return { A, B, C, D, E, F };
};

export const latLngToPixel = (
  lat: number, 
  lng: number, 
  transform: ReturnType<typeof getAffineTransform>
): PixelCoord | null => {
  if (!transform) return null;
  const { A, B, C, D, E, F } = transform;
  
  const x = A * lat + B * lng + C;
  const y = D * lat + E * lng + F;

  return { x, y };
};

// Simple distance calculation in meters (Haversine approximation not strictly needed for just "nearness" check on pixels, but good for real world logic)
export const getDistanceMeters = (c1: Coord, c2: Coord) => {
  const R = 6371e3; // metres
  const φ1 = c1.lat * Math.PI/180;
  const φ2 = c2.lat * Math.PI/180;
  const Δφ = (c2.lat-c1.lat) * Math.PI/180;
  const Δλ = (c2.lng-c1.lng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};