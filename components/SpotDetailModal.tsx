import React from 'react';
import { Spot } from '../types';
import { X, Volume2, CheckCircle, Camera } from 'lucide-react';

interface SpotDetailModalProps {
  spot: Spot | null;
  userDistance: number | null; // Distance in meters
  isCompleted: boolean;
  onClose: () => void;
  onCheckIn: () => void;
}

const SpotDetailModal: React.FC<SpotDetailModalProps> = ({ spot, userDistance, isCompleted, onClose, onCheckIn }) => {
  if (!spot) return null;

  const handleSpeak = () => {
    if ('speechSynthesis' in window && spot.speech_text) {
      const utterance = new SpeechSynthesisUtterance(spot.speech_text);
      // Auto-detect or default, browsers usually handle mixed content well
      // utterance.lang = 'zh-TW'; 
      window.speechSynthesis.speak(utterance);
    }
  };

  const isNear = userDistance !== null && userDistance < 30; // 30 meters threshold for manual check-in

  const typeMap: Record<string, string> = {
      facility: '設施',
      scenery: '景觀',
      tent: '帳篷'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div className="bg-white w-full max-w-md p-6 rounded-t-2xl sm:rounded-2xl shadow-2xl relative z-10 pointer-events-auto animate-slide-up sm:animate-fade-in m-0 sm:m-4 max-h-[85vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-stone-100 rounded-full hover:bg-stone-200"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-stone-800 pr-8">{spot.name}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
            <span className={`px-2 py-0.5 rounded text-xs uppercase font-semibold ${
                spot.type === 'tent' ? 'bg-orange-100 text-orange-800' :
                spot.type === 'facility' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
            }`}>
                {typeMap[spot.type] || spot.type}
            </span>
            {spot.has_mission && (
                 <span className={`px-2 py-0.5 rounded text-xs uppercase font-semibold border ${
                   isCompleted 
                   ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                   : 'bg-white text-red-600 border-red-200'
                 }`}>
                    {isCompleted ? '任務已完成' : '尚有任務'}
                 </span>
            )}
            {userDistance !== null && (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-stone-100 text-stone-600">
                距離 {Math.round(userDistance)} 公尺
              </span>
            )}
        </div>

        <p className="mt-4 text-stone-600 leading-relaxed">
          {spot.desc}
        </p>

        <div className="mt-6 space-y-3">
          {spot.has_mission && !isCompleted && (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center">
              <p className="text-sm text-stone-500 mb-3">{isNear ? "您已到達目的地！" : "距離太遠無法簽到"}</p>
              <button 
                onClick={onCheckIn}
                disabled={!isNear}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${
                  isNear 
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg hover:scale-105' 
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Camera size={20} />
                <span>打卡 / 拍照任務</span>
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-center space-x-2 text-yellow-800 font-bold">
              <CheckCircle size={20} />
              <span>您已造訪過此處！</span>
            </div>
          )}

          {spot.speech_text && (
              <button 
                  onClick={handleSpeak}
                  className="flex items-center justify-center w-full space-x-2 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-700 active:scale-95 transition-all"
              >
                  <Volume2 size={20} />
                  <span>聆聽導覽</span>
              </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpotDetailModal;