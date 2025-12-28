import React from 'react';
import { Spot } from '../types';
import { MapPin, Tent, Utensils, Mountain, Check, Star } from 'lucide-react';

interface MapMarkerProps {
  spot: Spot;
  isCompleted: boolean;
  scale: number;
  onClick: (spot: Spot) => void;
}

const MapMarker: React.FC<MapMarkerProps> = ({ spot, isCompleted, scale, onClick }) => {
  const getIcon = () => {
    if (isCompleted) return <Star size={16} fill="currentColor" />;
    
    switch (spot.type) {
      case 'tent': return <Tent size={16} fill="currentColor" />;
      case 'facility': return <Utensils size={16} fill="currentColor" />;
      case 'scenery': return <Mountain size={16} fill="currentColor" />;
      default: return <MapPin size={16} fill="currentColor" />;
    }
  };

  const getColor = () => {
    if (isCompleted) return 'bg-yellow-500 text-yellow-900 border-yellow-200';
    
    switch (spot.type) {
      case 'tent': return 'bg-orange-500 text-white';
      case 'facility': return 'bg-blue-600 text-white';
      case 'scenery': return 'bg-green-600 text-white';
      default: return 'bg-stone-700 text-white';
    }
  };

  // Counter-scale to keep marker size constant regardless of map zoom
  const inverseScale = Math.max(0.5, 1 / scale);

  const style: React.CSSProperties = {
    left: `${spot.pixel_x}px`,
    top: `${spot.pixel_y}px`,
    transform: `translate(-50%, -100%) scale(${inverseScale})`, 
    position: 'absolute',
    cursor: 'pointer',
    transformOrigin: 'bottom center'
  };

  return (
    <div 
      style={style} 
      onClick={(e) => {
        e.stopPropagation();
        onClick(spot);
      }}
      className="group z-10"
    >
      <div className={`p-2 rounded-full shadow-lg border-2 ${getColor()} flex items-center justify-center transition-transform duration-300 ${spot.has_mission && !isCompleted ? 'animate-bounce-slow' : ''}`}>
        {getIcon()}
      </div>
      
      {spot.has_mission && !isCompleted && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white animate-pulse" />
      )}
      
      <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold shadow-sm whitespace-nowrap text-stone-800 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {spot.name}
      </div>
    </div>
  );
};

export default MapMarker;