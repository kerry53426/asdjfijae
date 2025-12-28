import React, { useState } from 'react';
import { PixelCoord, Spot } from '../types';
import { X, Save } from 'lucide-react';

interface AdminSpotModalProps {
  position: PixelCoord;
  onSave: (spotData: Omit<Spot, 'id' | 'pixel_x' | 'pixel_y'>) => void;
  onClose: () => void;
}

const AdminSpotModal: React.FC<AdminSpotModalProps> = ({ position, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [type, setType] = useState<Spot['type']>('facility');
  const [hasMission, setHasMission] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({
      name,
      desc,
      speech_text: speechText,
      type,
      has_mission: hasMission
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl relative z-10 animate-fade-in">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-stone-100 rounded-full hover:bg-stone-200"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-stone-800 mb-4">新增景點</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">名稱</label>
            <input 
              type="text" 
              className="w-full p-2 rounded-lg border border-stone-300 focus:border-stone-500 outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：河畔烤肉區"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">類型</label>
            <select 
              className="w-full p-2 rounded-lg border border-stone-300 focus:border-stone-500 outline-none bg-white"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              <option value="facility">設施 (餐廳、廁所)</option>
              <option value="scenery">景觀 (觀景台)</option>
              <option value="tent">帳篷/住宿</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">描述</label>
            <textarea 
              className="w-full p-2 rounded-lg border border-stone-300 focus:border-stone-500 outline-none h-20"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="請輸入簡短描述..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase mb-1">語音導覽文字 (自動播放)</label>
            <textarea 
              className="w-full p-2 rounded-lg border border-stone-300 focus:border-stone-500 outline-none h-20"
              value={speechText}
              onChange={e => setSpeechText(e.target.value)}
              placeholder="當使用者靠近時朗讀的文字..."
            />
          </div>

          <div className="flex items-center space-x-2 bg-stone-100 p-3 rounded-lg">
            <input 
              type="checkbox" 
              id="hasMission"
              className="w-5 h-5 accent-orange-500"
              checked={hasMission}
              onChange={e => setHasMission(e.target.checked)}
            />
            <label htmlFor="hasMission" className="text-sm font-bold text-stone-700">這是一個任務景點嗎？</label>
          </div>

          <button 
            type="submit"
            className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 flex items-center justify-center space-x-2"
          >
            <Save size={18} />
            <span>建立景點</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminSpotModal;