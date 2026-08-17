import React, { useState } from 'react';
import {
  Keyboard,
  X,
  LogIn,
  LogOut,
  Save,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { GeoPoint, GeoShape } from '../types';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  listMyDrawings,
  saveNewDrawing,
  updateDrawing,
  deleteDrawing,
  SavedDrawing,
} from '../lib/drawings';

interface HeaderProps {
  points: GeoPoint[];
  shapes: GeoShape[];
  pointCounter: number;
  onLoadDrawing: (points: GeoPoint[], shapes: GeoShape[], pointCounter: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  points,
  shapes,
  pointCounter,
  onLoadDrawing,
}) => {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [busy, setBusy] = useState(false);

  const openSaveMenu = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setShowSaveMenu((v) => !v);
    if (!showSaveMenu) {
      try {
        const list = await listMyDrawings();
        setSavedDrawings(list);
      } catch (error) {
        console.error('Error listing drawings:', error);
      }
    }
  };

  const handleSaveNew = async () => {
    if (!saveNameInput.trim()) return;
    setBusy(true);
    try {
      await saveNewDrawing(saveNameInput.trim(), points, shapes, pointCounter);
      setSaveNameInput('');
      setSavedDrawings(await listMyDrawings());
    } catch (error) {
      console.error('Error saving new drawing:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCurrent = async () => {
    if (!currentDrawingId) return;
    setBusy(true);
    try {
      await updateDrawing(currentDrawingId, points, shapes, pointCounter);
      setSavedDrawings(await listMyDrawings());
    } catch (error) {
      console.error('Error updating drawing:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = (d: SavedDrawing) => {
    onLoadDrawing(d.points, d.shapes, d.point_counter);
    setCurrentDrawingId(d.id);
    setShowSaveMenu(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDrawing(id);
      setSavedDrawings(await listMyDrawings());
      if (currentDrawingId === id) setCurrentDrawingId(null);
    } catch (error) {
      console.error('Error deleting drawing:', error);
    }
  };

  return (
    <header className="h-10 bg-white border-b border-[#dbe4ee] px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: App Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[#16233a] tracking-tight">
            TQH Tikz Studio
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-[#e4ecf7] text-[#2f5d99] rounded">
            Sản phẩm được phát triển bởi Trần Quang Hùng. Phiên bản 1.0
          </span>
        </div>
      </div>

      {/* Center/Right Actions: Save/Load & Shortcuts */}
      <div className="flex items-center gap-2">
        {/* Lưu / Tải hình vẽ */}
        {isSupabaseConfigured && (
          <div className="relative">
            <button
              onClick={openSaveMenu}
              disabled={loading || busy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#f8fafc] hover:bg-[#eef2f6] text-[#16233a] border border-[#dbe4ee] rounded-md transition-colors shadow-2xs disabled:opacity-50"
            >
              {user ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#2f5d99]" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-[#2f5d99]" />
              )}
              <span>{user ? 'Lưu / Tải hình' : 'Đăng nhập để lưu'}</span>
            </button>

            {showSaveMenu && user && (
              <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-[#dbe4ee] rounded-lg shadow-lg py-2 z-50 px-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#5b6b82]">
                  <span className="truncate max-w-[180px]">{user.email}</span>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1 text-[#b91c1c] hover:underline shrink-0 ml-2"
                  >
                    <LogOut className="w-3 h-3" /> Đăng xuất
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Tên bản vẽ mới..."
                    value={saveNameInput}
                    onChange={(e) => setSaveNameInput(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-[#dbe4ee] rounded focus:outline-none focus:border-[#2f5d99]"
                  />
                  <button
                    onClick={handleSaveNew}
                    disabled={busy || !saveNameInput.trim()}
                    className="px-2 py-1 text-[11px] font-semibold text-white bg-[#2f5d99] hover:bg-[#254a7a] rounded disabled:opacity-50 flex items-center justify-center"
                  >
                    <Save className="w-3 h-3" />
                  </button>
                </div>

                {currentDrawingId && (
                  <button
                    onClick={handleUpdateCurrent}
                    disabled={busy}
                    className="w-full text-[11px] font-medium text-[#2f5d99] bg-[#e4ecf7] hover:bg-[#d6e2f5] px-2 py-1.5 rounded disabled:opacity-50"
                  >
                    💾 Ghi đè bản đang mở
                  </button>
                )}

                <div className="border-t border-[#f1f5f9] pt-1.5 max-h-56 overflow-y-auto space-y-0.5">
                  {savedDrawings.length === 0 && (
                    <p className="text-[11px] text-[#94a3b8] italic px-1">
                      Chưa có bản vẽ nào được lưu.
                    </p>
                  )}
                  {savedDrawings.map((d) => (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded hover:bg-[#f8fafc] group ${
                        currentDrawingId === d.id ? 'bg-[#f0f4fa]' : ''
                      }`}
                    >
                      <button
                        onClick={() => handleLoad(d)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="text-xs font-medium text-[#16233a] truncate">
                          {d.name}
                        </div>
                        <div className="text-[10px] text-[#94a3b8]">
                          {new Date(d.updated_at).toLocaleString('vi-VN')}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="opacity-0 group-hover:opacity-100 text-[#b91c1c] hover:bg-[#fee2e2] p-1 rounded transition-opacity shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shortcuts button */}
        <button
          onClick={() => setShowShortcutsModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#5b6b82] hover:text-[#16233a] hover:bg-[#f8fafc] border border-transparent hover:border-[#dbe4ee] rounded-md transition-colors"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Phím tắt</span>
        </button>
      </div>

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#dbe4ee] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 border-b border-[#dbe4ee] flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#2f5d99]" />
                <h3 className="text-sm font-semibold text-[#16233a]">Phím tắt bàn phím</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded hover:bg-[#e2e8f0] text-[#5b6b82]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-[#16233a]">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-[#f8fafc] rounded border border-[#dbe4ee] flex items-center justify-between">
                  <span>Hoàn tác</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#cbd5e1] rounded font-mono-code text-[11px] shadow-2xs">
                    Ctrl + Z
                  </kbd>
                </div>
                <div className="p-2 bg-[#f8fafc] rounded border border-[#dbe4ee] flex items-center justify-between">
                  <span>Làm lại</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#cbd5e1] rounded font-mono-code text-[11px] shadow-2xs">
                    Ctrl + Y
                  </kbd>
                </div>
                <div className="p-2 bg-[#f8fafc] rounded border border-[#dbe4ee] flex items-center justify-between">
                  <span>Xoá đối tượng chọn</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#cbd5e1] rounded font-mono-code text-[11px] shadow-2xs">
                    Delete
                  </kbd>
                </div>
                <div className="p-2 bg-[#f8fafc] rounded border border-[#dbe4ee] flex items-center justify-between">
                  <span>Dịch chuyển canvas</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#cbd5e1] rounded font-mono-code text-[11px] shadow-2xs">
                    Shift + Kéo
                  </kbd>
                </div>
                <div className="p-2 bg-[#f8fafc] rounded border border-[#dbe4ee] flex items-center justify-between">
                  <span>Phóng to / Thu nhỏ</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#cbd5e1] rounded font-mono-code text-[11px] shadow-2xs">
                    Cuộn chuột
                  </kbd>
                </div>
                <div className="p-2 bg-[#f8fafc] rounded border border-[#dbe4ee] flex items-center justify-between">
                  <span>Hoàn thành nét vẽ</span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-[#cbd5e1] rounded font-mono-code text-[11px] shadow-2xs">
                    Enter
                  </kbd>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#dbe4ee] text-right">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-3 py-1.5 bg-[#2f5d99] text-white text-xs font-semibold rounded-md shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
