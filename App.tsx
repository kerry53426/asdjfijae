import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AppData, 
  AppMode, 
  CalibrationPoint, 
  PixelCoord, 
  Spot, 
  Coord 
} from './types';
import { 
  fetchAppData, 
  saveAppData 
} from './services/storage';
import { 
  getAffineTransform, 
  latLngToPixel,
  getDistanceMeters
} from './services/geo';
import { MAP_IMAGE_URL } from './constants';
import MapMarker from './components/MapMarker';
import SpotDetailModal from './components/SpotDetailModal';
import AdminSpotModal from './components/AdminSpotModal';
import { 
  Map as MapIcon, 
  Settings, 
  Crosshair, 
  Plus, 
  Loader2,
  Navigation,
  RotateCcw,
  AlertTriangle,
  Cloud,
  CloudOff,
  Signal,
  MapPin
} from 'lucide-react';

const AUTO_SPEECH_DISTANCE = 20; // meters

const App: React.FC = () => {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppData | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.USER);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  
  // Session State
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [readSpeeches, setReadSpeeches] = useState<Set<string>>(new Set());

  // Map Rendering & Interaction
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  
  // User Location
  const [userGeo, setUserGeo] = useState<Coord | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [userPixel, setUserPixel] = useState<PixelCoord | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [nearestSpotDist, setNearestSpotDist] = useState<number | null>(null);

  // Admin Inputs
  const [newSpotPos, setNewSpotPos] = useState<PixelCoord | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');

  // --- Initial Load ---
  useEffect(() => {
    // Check URL Param for Admin Mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin') {
      setMode(AppMode.ADMIN_CALIBRATE);
    }

    const init = async () => {
      const storedData = await fetchAppData();
      setData(storedData);
      setLoading(false);
    };
    init();
  }, []);

  // --- Geolocation Tracking ---
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError("您的裝置不支援地理定位");
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      setUserGeo({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      setGpsAccuracy(pos.coords.accuracy);
      setGeoError(null);
    };

    const handleError = (err: GeolocationPositionError) => {
      let msg = err.message;
      switch (err.code) {
        case err.PERMISSION_DENIED: msg = "定位權限被拒絕"; break;
        case err.POSITION_UNAVAILABLE: msg = "無法取得 GPS 訊號"; break;
        case err.TIMEOUT: msg = "定位連線逾時"; break;
      }
      setGeoError(msg);
    };

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // --- Coordinate Transformation & Proximity Logic ---
  const transform = useMemo(() => {
    if (!data || data.calibration_points.length < 3) return null;
    return getAffineTransform(data.calibration_points);
  }, [data]);

  useEffect(() => {
    if (userGeo && transform) {
      const pix = latLngToPixel(userGeo.lat, userGeo.lng, transform);
      setUserPixel(pix);
    }
  }, [userGeo, transform]);

  // --- Auto-Speech and Nearest Spot Logic ---
  useEffect(() => {
    if (!userGeo || !data) return;

    let minDist = Infinity;
    let closest: Spot | null = null;

    data.spots.forEach(spot => {
      // Note: We need Spot Lat/Lng to do accurate distance.
      // However, our data structure stores PIXELS.
      // For accurate distance, we ideally need to inverse transform Pixel -> LatLng, 
      // OR we just store LatLng in the spot data too.
      // Given the constraints and the affine transform availability, let's roughly estimate distance
      // based on pixel distance converted to meters using a scale factor derived from calibration points, 
      // OR (better) if we have the calibration points, we can do a rough check.
      // FIX: The current Spot type doesn't have Lat/Lng. 
      // STRATEGY: We will just check if `userPixel` is close to `spot.pixel_x/y`.
      // We need a "Pixels per Meter" ratio. We can estimate this from the calibration points.
      
      if (userPixel && transform) {
          const dx = userPixel.x - spot.pixel_x;
          const dy = userPixel.y - spot.pixel_y;
          const pixelDist = Math.sqrt(dx*dx + dy*dy);
          
          // Estimate scale: Distance between Calib P1 and P2 in meters vs pixels
          if (data.calibration_points.length >= 2) {
              const p1 = data.calibration_points[0];
              const p2 = data.calibration_points[1];
              const distMeters = getDistanceMeters({lat: p1.lat, lng: p1.lng}, {lat: p2.lat, lng: p2.lng});
              const distPixels = Math.sqrt(Math.pow(p1.pixel_x - p2.pixel_x, 2) + Math.pow(p1.pixel_y - p2.pixel_y, 2));
              const metersPerPixel = distMeters / distPixels;
              
              const distM = pixelDist * metersPerPixel;
              
              if (distM < minDist) {
                  minDist = distM;
                  closest = spot;
              }
          }
      }
    });

    setNearestSpotDist(minDist === Infinity ? null : minDist);

    // Auto-Speech Trigger
    if (closest && minDist < AUTO_SPEECH_DISTANCE) {
        const s = closest as Spot;
        if (!readSpeeches.has(s.id) && s.speech_text) {
             const utterance = new SpeechSynthesisUtterance(s.speech_text);
             // Use generic Chinese or English based on text, mostly device dependent auto-detect, 
             // but here we let the browser decide or default to user preference.
             // window.speechSynthesis.speak(utterance);
             // Ideally we should detect language, but for now assuming the text entered is the language to speak.
             window.speechSynthesis.speak(utterance);
             setReadSpeeches(prev => new Set(prev).add(s.id));
        }
    }

  }, [userGeo, userPixel, data, transform, readSpeeches]);


  // --- Data Persistence ---
  const handleDataSave = async (newData: AppData, message: string) => {
    setData(newData);
    setSaveStatus('saving');
    const cloudSuccess = await saveAppData(newData);
    setSaveStatus(cloudSuccess ? 'saved' : 'offline');
    setTimeout(() => setSaveStatus('idle'), 2000);
    // Optional: Alert is removed to be less intrusive, relying on status icon, 
    // but if you want the alert back for explicit confirmation:
    // if(!cloudSuccess) alert("儲存失敗：目前為離線模式，資料僅儲存在本機。");
  };

  // --- Zoom / Pan Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
    setViewState(prev => ({
        ...prev,
        scale: Math.min(Math.max(prev.scale * scaleChange, 0.5), 5)
    }));
  };

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
  };

  // --- Logic Handlers ---

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setMapSize({ width: img.clientWidth, height: img.clientHeight });
    // Center map initially
    if (mapContainerRef.current) {
        const cw = mapContainerRef.current.clientWidth;
        const ch = mapContainerRef.current.clientHeight;
        const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
        setViewState({ x: (cw - img.naturalWidth * scale)/2, y: (ch - img.naturalHeight * scale)/2, scale });
    }
  };

  const handleMapClick = async (e: React.MouseEvent) => {
    // Only handle clicks if not dragging
    if (isDragging.current) return;

    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    
    // Convert screen click to Natural Image Coordinates considering ViewState
    // Screen = (Natural * Scale) + Translate
    // Natural = (Screen - Translate) / Scale
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const clickX = (screenX - viewState.x) / viewState.scale;
    const clickY = (screenY - viewState.y) / viewState.scale;

    if (mode === AppMode.ADMIN_CALIBRATE) {
        if (!data) return;
        let lat = 0, lng = 0;
        
        if (userGeo && confirm("將此像素綁定到您目前的 GPS 位置？")) {
            lat = userGeo.lat;
            lng = userGeo.lng;
        } else {
             const manual = prompt("手動輸入經緯度 (格式: 24.123,121.123):");
             if(!manual) return;
             const parts = manual.split(',');
             lat = parseFloat(parts[0]);
             lng = parseFloat(parts[1]);
        }

        const newPoint: CalibrationPoint = {
            id: Date.now(),
            pixel_x: clickX,
            pixel_y: clickY,
            lat,
            lng
        };
        const updatedPoints = [...data.calibration_points, newPoint];
        const newData = { ...data, calibration_points: updatedPoints };
        await handleDataSave(newData, `校正點已新增`);
    }

    if (mode === AppMode.ADMIN_ADD_SPOT) {
        setNewSpotPos({ x: clickX, y: clickY });
    }
  };

  const handleSaveSpot = async (spotData: Omit<Spot, 'id' | 'pixel_x' | 'pixel_y'>) => {
      if (!newSpotPos || !data) return;
      const newSpot: Spot = {
          id: `spot_${Date.now()}`,
          pixel_x: newSpotPos.x,
          pixel_y: newSpotPos.y,
          ...spotData
      };
      const newData = { ...data, spots: [...data.spots, newSpot] };
      await handleDataSave(newData, "景點已建立");
      setNewSpotPos(null);
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-100 text-stone-600">
        <Loader2 className="animate-spin mr-2" /> 載入露營區資料中...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-stone-200 overflow-hidden touch-none">
      
      {/* --- Map Engine --- */}
      <div 
        ref={mapContainerRef}
        className="relative w-full h-full bg-stone-200 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleMapClick}
      >
        <div 
            style={{
                transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
                transformOrigin: '0 0',
                willChange: 'transform'
            }}
            className="absolute top-0 left-0"
        >
            <img 
                src={MAP_IMAGE_URL} 
                alt="Map" 
                className="pointer-events-none select-none"
                onLoad={handleImageLoad}
                draggable={false}
            />

            {/* Markers Layer */}
            {data?.spots.map(spot => (
                <MapMarker 
                    key={spot.id}
                    spot={spot}
                    isCompleted={completedMissions.has(spot.id)}
                    scale={viewState.scale} 
                    onClick={setSelectedSpot}
                />
            ))}

            {/* Calibration Points Layer */}
            {mode === AppMode.ADMIN_CALIBRATE && data?.calibration_points.map((p, i) => (
                <div 
                    key={p.id}
                    className="absolute w-6 h-6 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center text-[10px] font-bold z-20 shadow-md"
                    style={{
                        left: p.pixel_x,
                        top: p.pixel_y,
                        transform: `translate(-50%, -50%) scale(${1/viewState.scale})`
                    }}
                >
                    {i + 1}
                </div>
            ))}

            {/* User Avatar */}
            {userPixel && (
                <div 
                    className="absolute z-30 flex flex-col items-center pointer-events-none transition-all duration-1000 ease-linear"
                    style={{
                        left: userPixel.x,
                        top: userPixel.y,
                        transform: `translate(-50%, -50%) scale(${1/viewState.scale})`
                    }}
                >
                    <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md animate-ping absolute opacity-75" />
                    <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md relative" />
                </div>
            )}
        </div>
      </div>

      {/* --- HUD & Controls --- */}
      
      {/* Top Bar */}
      <div className="fixed top-4 left-4 right-4 z-40 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur shadow-lg rounded-xl p-3 border border-stone-200 pointer-events-auto">
            <h1 className="text-lg font-bold text-stone-800">愛雄豪華露營</h1>
            <div className="flex items-center space-x-3 text-xs text-stone-500 mt-1">
              <div className="flex items-center space-x-1">
                  {saveStatus === 'saving' && <Loader2 size={12} className="animate-spin text-blue-500"/>}
                  {saveStatus === 'saved' && <Cloud size={12} className="text-green-500"/>}
                  {saveStatus === 'offline' && <CloudOff size={12} className="text-orange-500"/>}
              </div>
              {gpsAccuracy && (
                  <div className="flex items-center space-x-1">
                      <Signal size={12} className={gpsAccuracy < 20 ? "text-green-500" : "text-orange-500"}/>
                      <span>±{Math.round(gpsAccuracy)}m</span>
                  </div>
              )}
            </div>
          </div>
      </div>

      {/* Bottom Status & Controls */}
      <div className="fixed bottom-6 left-4 right-4 z-40 pointer-events-none flex flex-col justify-end space-y-4">
        
        {/* Nearest Spot Indicator */}
        {nearestSpotDist && (
            <div className="self-center bg-stone-900/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl animate-fade-in flex items-center space-x-2">
                <MapPin size={12} />
                <span>最近景點距離: {Math.round(nearestSpotDist)}公尺</span>
            </div>
        )}

        {/* Admin Calibration Helper */}
        {mode === AppMode.ADMIN_CALIBRATE && (
            <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-900 p-4 rounded-xl shadow-xl pointer-events-auto text-sm">
                <div className="font-bold flex items-center space-x-2 mb-1">
                    <Crosshair size={16}/> <span>校正模式</span>
                </div>
                <p>1. 請走到地圖上可辨識的地標位置。</p>
                <p>2. 等待 GPS 訊號穩定。</p>
                <p>3. 點擊地圖上您目前所在的確切位置。</p>
                <div className="mt-2 text-xs opacity-75">已標記點數: {data?.calibration_points.length} (至少需 3 點)</div>
            </div>
        )}

        <div className="flex justify-between items-end pointer-events-auto">
            {/* User Loc Button */}
            <button 
                className={`p-3 rounded-full shadow-lg transition-colors flex items-center justify-center ${
                    userGeo ? 'bg-blue-600 text-white' : 
                    geoError ? 'bg-red-100 text-red-600' : 
                    'bg-white text-stone-400'
                }`}
                onClick={() => {
                    if (userGeo && viewState.scale && userPixel) {
                        // Center on user
                         setViewState(prev => ({
                             ...prev,
                             x: (mapContainerRef.current!.clientWidth/2) - (userPixel.x * prev.scale),
                             y: (mapContainerRef.current!.clientHeight/2) - (userPixel.y * prev.scale)
                         }));
                    } else {
                        alert(geoError || "等待 GPS 訊號...");
                    }
                }}
            >
                {geoError ? <AlertTriangle size={24} /> : <Navigation size={24} />}
            </button>

            {/* Mode Switchers */}
            <div className="flex flex-col space-y-2">
                {mode !== AppMode.USER && (
                    <>
                        <button 
                            onClick={() => {
                                if(confirm("確定清除所有校正點？")) {
                                    handleDataSave({...data!, calibration_points: []}, "重置");
                                }
                            }} 
                            className="p-3 bg-red-100 text-red-600 rounded-full shadow-lg"
                        >
                            <RotateCcw size={24} />
                        </button>
                        <button 
                            onClick={() => setMode(AppMode.ADMIN_CALIBRATE)}
                            className={`p-3 rounded-full shadow-lg border-2 ${mode === AppMode.ADMIN_CALIBRATE ? 'bg-yellow-400 text-stone-900 border-yellow-500' : 'bg-white text-stone-600 border-white'}`}
                        >
                            <Crosshair size={24} />
                        </button>
                        <button 
                            onClick={() => setMode(AppMode.ADMIN_ADD_SPOT)}
                            className={`p-3 rounded-full shadow-lg border-2 ${mode === AppMode.ADMIN_ADD_SPOT ? 'bg-green-500 text-white border-green-600' : 'bg-white text-stone-600 border-white'}`}
                        >
                            <Plus size={24} />
                        </button>
                    </>
                )}
                
                {/* Only show Admin Toggle if URL param is present, or for demo purposes allow clicking */}
                {(new URLSearchParams(window.location.search).get('mode') === 'admin') && (
                    <button 
                        onClick={() => setMode(mode === AppMode.USER ? AppMode.ADMIN_CALIBRATE : AppMode.USER)}
                        className={`p-3 rounded-full shadow-lg border-2 ${mode !== AppMode.USER ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-white'}`}
                    >
                        {mode === AppMode.USER ? <Settings size={24} /> : <MapIcon size={24} />}
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Modals */}
      <SpotDetailModal 
        spot={selectedSpot} 
        userDistance={selectedSpot && nearestSpotDist && userPixel ? Math.sqrt(Math.pow(selectedSpot.pixel_x - userPixel.x, 2) + Math.pow(selectedSpot.pixel_y - userPixel.y, 2)) /* Approximate for now */ : null}
        isCompleted={selectedSpot ? completedMissions.has(selectedSpot.id) : false}
        onClose={() => setSelectedSpot(null)} 
        onCheckIn={() => {
            if (selectedSpot) {
                setCompletedMissions(prev => new Set(prev).add(selectedSpot.id));
                alert("任務完成！ 🌟");
                setSelectedSpot(null);
            }
        }}
      />

      {newSpotPos && (
          <AdminSpotModal 
            position={newSpotPos} 
            onSave={handleSaveSpot} 
            onClose={() => setNewSpotPos(null)} 
          />
      )}
      
    </div>
  );
};

export default App;