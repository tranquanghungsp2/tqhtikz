import React, { useState } from 'react';
import {
  Keyboard,
  X,
  LogIn,
  LogOut,
  Save,
  FolderOpen,
  Trash2,
  Clock,
  ShieldCheck,
  Eye,
  BookOpen,
} from 'lucide-react';
import { GeoPoint, GeoShape, BackgroundImageState, PathAnnotation, RightAngleMark } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { AdminPanel } from './AdminPanel';
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
  bgImage: BackgroundImageState;
  pathAnnotations: PathAnnotation[];
  rightAngleMarks: RightAngleMark[];
  currentDrawingId: string | null;
  currentDrawingName: string | null;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSetCurrentDrawing: (id: string | null, name: string | null) => void;
  onLoadDrawing: (
    points: GeoPoint[],
    shapes: GeoShape[],
    pointCounter: number,
    bgImage: BackgroundImageState | null,
    pathAnnotations: PathAnnotation[] | undefined,
    rightAngleMarks: RightAngleMark[] | undefined,
    drawingId: string | null,
    drawingName: string | null
  ) => void;
  formulaMode: boolean;
  onToggleFormulaMode: () => void;
  onOpenVisibilityManager: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  points,
  shapes,
  pointCounter,
  bgImage,
  pathAnnotations,
  rightAngleMarks,
  currentDrawingId,
  currentDrawingName,
  autoSaveStatus,
  onSetCurrentDrawing,
  onLoadDrawing,
  formulaMode,
  onToggleFormulaMode,
  onOpenVisibilityManager,
}) => {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { status: approvalStatus, isAdmin, loadingProfile } = useProfile(user);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const [showUnsavedNewConfirm, setShowUnsavedNewConfirm] = useState(false);
  const saveMenuRef = React.useRef<HTMLDivElement>(null);

  // "Đang lưu..." hiện liên tục cho tới khi lưu xong; "Đã lưu" chỉ hiện thoáng qua 2s rồi tự ẩn.
  React.useEffect(() => {
    if (autoSaveStatus === 'saved') {
      setShowSavedBadge(true);
      const t = setTimeout(() => setShowSavedBadge(false), 2000);
      return () => clearTimeout(t);
    }
    setShowSavedBadge(false);
  }, [autoSaveStatus]);

  // Bấm ra ngoài khu vực dropdown Lưu/Tải thì tự đóng, không cần bấm lại đúng nút mới đóng được.
  React.useEffect(() => {
    if (!showSaveMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSaveMenu]);

  const openSaveMenu = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    if (approvalStatus !== 'approved') {
      setShowSaveMenu((v) => !v);
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
    const nameToSave = saveNameInput.trim();
    setBusy(true);
    try {
      await saveNewDrawing(nameToSave, points, shapes, pointCounter, bgImage, pathAnnotations, rightAngleMarks);
      setSaveNameInput('');
      const list = await listMyDrawings();
      setSavedDrawings(list);
      // Sau khi lưu mới, coi đây là bản đang mở (để lần sau "Ghi đè" đúng vào bản này) —
      // tìm lại đúng bản vừa tạo bằng tên (list đã sắp theo updated_at giảm dần nên khớp tên
      // đầu tiên chính là bản mới nhất vừa lưu).
      const justSaved = list.find((d) => d.name === nameToSave);
      if (justSaved) {
        onSetCurrentDrawing(justSaved.id, justSaved.name);
      }
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
      await updateDrawing(currentDrawingId, points, shapes, pointCounter, bgImage, pathAnnotations, rightAngleMarks);
      setSavedDrawings(await listMyDrawings());
    } catch (error) {
      console.error('Error updating drawing:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = (d: SavedDrawing) => {
    onLoadDrawing(d.points, d.shapes, d.point_counter, d.background_image, d.path_annotations || [], d.right_angle_marks || [], d.id, d.name);
    setShowSaveMenu(false);
  };

  // Tạo bản vẽ TRẮNG mới — xoá canvas hiện tại và quên liên kết với file đang mở, để "Ghi đè
  // bản đang mở" không lỡ tay đè lên file cũ, và để người dùng luôn biết rõ mình đang ở bản mới.
  const performNewDrawing = () => {
    onLoadDrawing([], [], 0, null, [], [], null, null);
    setSaveNameInput('');
    setShowSaveMenu(false);
    setShowUnsavedNewConfirm(false);
  };

  // Bản đang vẽ CHƯA TỪNG được lưu (không có currentDrawingId) mà đang có nội dung — tạo mới
  // ngay sẽ mất trắng, không khôi phục được (khác bản đã lưu, được tự động lưu liên tục nên
  // luôn an toàn) — cần hỏi xác nhận trước, kèm lựa chọn lưu lại trước khi xoá.
  const handleNewDrawing = () => {
    const hasUnsavedContent = !currentDrawingId && (points.length > 0 || shapes.length > 0);
    if (hasUnsavedContent) {
      setShowUnsavedNewConfirm(true);
      return;
    }
    performNewDrawing();
  };

  // Lưu bản đang vẽ (dùng tên đã gõ trong ô nhập nếu có, không thì tự đặt tên theo thời điểm
  // hiện tại) rồi mới chuyển sang canvas trắng — dành cho lúc bấm nhầm "Tạo bản vẽ mới" mà
  // tiếc công vừa vẽ.
  const handleSaveThenNew = async () => {
    const nameToSave =
      saveNameInput.trim() ||
      `Bản vẽ ${new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    setBusy(true);
    try {
      await saveNewDrawing(nameToSave, points, shapes, pointCounter, bgImage, pathAnnotations, rightAngleMarks);
      performNewDrawing();
    } catch (error) {
      console.error('Error saving before new drawing:', error);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDrawing(id);
      setSavedDrawings(await listMyDrawings());
      if (currentDrawingId === id) onSetCurrentDrawing(null, null);
    } catch (error) {
      console.error('Error deleting drawing:', error);
    }
  };

  return (
    <header className="relative h-10 bg-white border-b border-[#dbe4ee] px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Trạng thái tự động lưu — canh giữa tuyệt đối trên thanh Header, không phụ thuộc layout 2 bên */}
      {currentDrawingName && (autoSaveStatus === 'saving' || showSavedBadge || autoSaveStatus === 'error') && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-opacity ${
              autoSaveStatus === 'saving'
                ? 'text-[#5b6b82] bg-[#f1f5f9]'
                : autoSaveStatus === 'error'
                ? 'text-[#b91c1c] bg-[#fee2e2]'
                : 'text-[#059669] bg-[#ecfdf5]'
            }`}
          >
            {autoSaveStatus === 'saving' ? 'Đang lưu...' : autoSaveStatus === 'error' ? 'Lỗi lưu' : 'Đã lưu'}
          </span>
        </div>
      )}
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
        {false && (
          <button
            onClick={onToggleFormulaMode}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
              formulaMode
                ? 'bg-[#2f5d99] border-[#2f5d99] text-white'
                : 'bg-white border-[#dbe4ee] text-[#5b6b82] hover:bg-[#f8fafc]'
            }`}
          >
            {formulaMode ? '📐 Chế độ công thức' : '🖱️ Chế độ chuột'}
          </button>
        )}
      </div>

      {/* Center/Right Actions: Save/Load & Shortcuts */}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={() => setShowAdminPanel(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#e4ecf7] hover:bg-[#d6e2f5] text-[#2f5d99] border border-[#2f5d99]/30 rounded-md transition-colors shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quản lý người dùng</span>
          </button>
        )}

        {/* Lưu / Tải hình vẽ */}
        {isSupabaseConfigured && (
          <div className="relative" ref={saveMenuRef}>
            <button
              onClick={openSaveMenu}
              disabled={loading || busy}
              title={currentDrawingName ? `Đang sửa: ${currentDrawingName}` : undefined}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#f8fafc] hover:bg-[#eef2f6] text-[#16233a] border border-[#dbe4ee] rounded-md transition-colors shadow-2xs disabled:opacity-50 max-w-[180px]"
            >
              {user ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#2f5d99] shrink-0" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-[#2f5d99] shrink-0" />
              )}
              <span className="truncate">
                {user ? (currentDrawingName ? currentDrawingName : 'Lưu / Tải hình') : 'Đăng nhập để lưu'}
              </span>
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

                {loadingProfile ? (
                  <p className="text-[11px] text-[#94a3b8] italic px-1 py-2">Đang kiểm tra quyền truy cập...</p>
                ) : approvalStatus !== 'approved' ? (
                  <div className="flex items-start gap-2 p-2.5 bg-[#fef3c7] border border-[#f59e0b]/40 rounded-md text-[11px] text-[#92400e] leading-relaxed">
                    <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {approvalStatus === 'rejected'
                        ? 'Tài khoản của bạn chưa được cấp quyền sử dụng tính năng Lưu/Tải hình.'
                        : 'Tài khoản đang chờ được duyệt để dùng tính năng Lưu/Tải hình. Vui lòng liên hệ quản trị viên.'}
                    </span>
                  </div>
                ) : (
                  <>
                    {currentDrawingName && (
                      <div className="text-[11px] text-[#5b6b82] px-1 flex items-center justify-between">
                        <span className="truncate">
                          Đang sửa: <span className="font-semibold text-[#16233a]">{currentDrawingName}</span>
                        </span>
                      </div>
                    )}
                    <button
                      onClick={handleNewDrawing}
                      className="w-full text-[11px] font-medium text-[#2f5d99] bg-white border border-dashed border-[#2f5d99]/50 hover:bg-[#f0f4fa] px-2 py-1.5 rounded transition-colors"
                    >
                      + Tạo bản vẽ mới (xoá canvas hiện tại)
                    </button>

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
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Visibility Manager button — ẩn khỏi giao diện, giữ nguyên onOpenVisibilityManager/VisibilityManager để bật lại dễ dàng sau này nếu cần */}
        {false && (
          <button
            onClick={onOpenVisibilityManager}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#5b6b82] hover:text-[#16233a] hover:bg-[#f8fafc] border border-transparent hover:border-[#dbe4ee] rounded-md transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ẩn / Hiện</span>
          </button>
        )}

        {/* Hướng dẫn sử dụng button (trước là "Phím tắt") */}
        <button
          onClick={() => setShowShortcutsModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#5b6b82] hover:text-[#16233a] hover:bg-[#f8fafc] border border-transparent hover:border-[#dbe4ee] rounded-md transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Hướng dẫn sử dụng</span>
        </button>
      </div>

      {/* Hướng dẫn sử dụng Modal (trước là "Shortcuts Modal") */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#dbe4ee] rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-4 py-3 border-b border-[#dbe4ee] flex items-center justify-between bg-[#f8fafc] shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2f5d99]" />
                <h3 className="text-sm font-semibold text-[#16233a]">Hướng dẫn sử dụng</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded hover:bg-[#e2e8f0] text-[#5b6b82]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs text-[#16233a] overflow-y-auto">
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">1. Vẽ hình cơ bản</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li>Chọn công cụ ở thanh trái, nhấp lên canvas theo hướng dẫn hiện ở góc dưới trái màn hình.</li>
                  <li>Nhấp vào 1 điểm/cạnh có sẵn để dùng lại, thay vì tạo điểm mới trùng vị trí.</li>
                  <li>Bấm vào cạnh của hình chữ nhật, hình vuông, đường gấp khúc, đoạn thẳng, đường song song/vuông góc khi đang đặt điểm (ở bất kỳ công cụ nào — Điểm, Đoạn thẳng, Đường tròn...) sẽ tự tạo điểm luôn nằm ràng buộc (màu cam) trên đúng cạnh đó, kéo cạnh thì điểm tự trượt theo. Riêng cạnh Bezier chưa hỗ trợ.</li>
                  <li>Dùng công cụ "Điểm" bấm gần chỗ 2 đường/hình cắt nhau (dù chưa có điểm nào ở đó) sẽ tự tạo điểm giao điểm thật (màu đỏ), kéo 1 trong 2 đường gốc thì điểm tự cập nhật theo.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">2. Giữ Shift để khoá góc 0°/90°/180°/270°</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li>Đang vẽ đoạn thẳng/đường gấp khúc, giữ Shift khi rê chuột chọn điểm tiếp theo — nếu góc đang gần ngang/dọc (trong khoảng ±5°) sẽ tự bẻ về đúng chuẩn, đường preview chuyển màu xanh lục để báo đang khoá.</li>
                  <li>Khi đóng kín đường gấp khúc (bấm lại điểm đầu) mà giữ Shift, cạnh cuối cùng cũng được khoá góc tương tự.</li>
                  <li>Dùng công cụ "Chọn" giữ Shift kéo 1 điểm đã có sẵn: nếu điểm đó nối với 1 cạnh đang gần chuẩn, cạnh đó sẽ tự khoá góc trong lúc kéo (chỉ đổi độ dài, không đổi hướng). Nếu điểm nối với 2 cạnh (đỉnh giữa đa giác) mà cả 2 cạnh cùng lúc gần chuẩn, điểm sẽ tự nằm đúng tại giao điểm của cả 2 đường chuẩn đó (ví dụ giữ đúng góc vuông tại 1 đỉnh hình thang vuông khi kéo đỉnh đó).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">3. Đường song song / vuông góc</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li>Bước 1 chọn đường chuẩn: có thể chọn cả 1 cạnh cụ thể của hình chữ nhật/đường gấp khúc, không chỉ đoạn thẳng đơn.</li>
                  <li>Bước 3 chốt điểm cuối: nếu bấm gần 1 điểm/đường có sẵn khác, điểm cuối sẽ tự ràng buộc thoả đồng thời cả 2 điều kiện (song song/vuông góc VÀ nằm trên đường đó) — không kéo tự do được nữa, tự cập nhật khi kéo 1 trong 2 đường liên quan.</li>
                  <li>Với công cụ Vuông góc: nếu chọn điểm "đi qua" là 1 điểm KHÔNG nằm trên đường chuẩn (VD: kẻ đường cao từ 1 đỉnh xuống cạnh đối diện), app tự động vẽ luôn đoạn vuông góc chạm đúng xuống đường chuẩn, không cần thao tác thêm bước 3. Ký hiệu góc vuông sẽ tự vẽ đúng tại điểm chạm.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">4. Nhãn &amp; ký hiệu</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li><span className="font-medium text-[#16233a]">Nhãn đoạn thẳng / Nhãn góc-lệch tâm:</span> chọn điểm xong sẽ hiện hộp nhập nội dung LaTeX (VD: <code>$7\,m$</code>, <code>$30^\circ$</code>), gõ xong Enter để tạo, Esc để huỷ. Nhãn được render bằng KaTeX (LaTeX thật) ngay trên canvas, đúng như trong PDF.</li>
                  <li><span className="font-medium text-[#16233a]">Ký hiệu góc vuông:</span> chọn 3 điểm theo thứ tự (đầu — đỉnh — cuối), chỉnh bán kính (mm) trong panel bên phải khi đã chọn ký hiệu. Mỗi ký hiệu xuất ra 1 dòng <code>\draw pic[...]{'{'}right angle=X--Y--Z{'}'};</code> độc lập.</li>
                  <li><span className="font-medium text-[#16233a]">Nhãn điểm (A, B, C...):</span> kéo trực tiếp chữ nhãn quanh điểm để đổi góc đặt nhãn; khoảng cách nhãn dùng CHUNG cho mọi điểm, chỉnh 1 lần ở slider trong Toolbar, áp dụng đồng loạt.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">5. Điểm neo &amp; xuất dạng pic</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li>Công cụ "Điểm neo": nhấp vào 1 điểm có sẵn, đặt tên (VD: <code>dinh</code>, <code>chan</code>) — điểm đó sẽ có viền hình thoi tím đánh dấu.</li>
                  <li>Trong tab Mã TikZ, tick "Xuất dạng pic", đặt tên pic (VD: <code>tree</code>) — mã sẽ đổi thành khối <code>{'\tikzset{ pics/<tên>/.style={code={...}} }'}</code> kèm các dòng <code>{'\coordinate (-tên_neo) at (...);'}</code>, dùng lại được ở bất kỳ đâu bằng <code>{'\pic at (x,y) {<tên>};'}</code>.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">6. Chế độ vẽ &amp; ẩn/hiện</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li><span className="font-medium text-[#16233a]">Hình học:</span> hiện tên điểm A, B, C..., mã TikZ dùng <code>\coordinate</code> có tên.</li>
                  <li><span className="font-medium text-[#16233a]">Vẽ theo ảnh thực:</span> ẩn hết tên điểm trên canvas LẪN trong mã TikZ (không khai báo <code>\coordinate</code> nào), mọi hình dùng thẳng toạ độ số — phù hợp khi đồ hình theo ảnh nền, chỉ cần đúng vị trí, không cần tên.</li>
                  <li>Công cụ "Ẩn/Hiện" (chọn từng điểm/hình riêng lẻ để loại khỏi mã xuất, vẫn hiện mờ trên canvas) là tính năng KHÁC, độc lập hoàn toàn với 2 chế độ vẽ trên, không xung đột nhau.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">7. Lưu, tải &amp; tự động lưu</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li>Đăng nhập rồi bấm "Lưu / Tải hình" để lưu bản vẽ lên tài khoản, hoặc mở lại bản đã lưu trước đó.</li>
                  <li>Khi đang mở 1 bản vẽ đã lưu (nút hiện đúng tên file), mọi thay đổi sẽ <span className="font-medium text-[#16233a]">tự động lưu</span> sau ~2.5 giây ngừng thao tác — xem trạng thái "Đang lưu.../Đã lưu/Lỗi lưu" hiện thoáng qua ở chính giữa thanh trên cùng.</li>
                  <li>Bấm "+ Tạo bản vẽ mới" trong menu Lưu/Tải để bắt đầu 1 canvas trắng, không ảnh hưởng file đang mở.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">8. Sao chép mã TikZ</h4>
                <ul className="space-y-1 list-disc list-inside text-[#5b6b82] leading-relaxed">
                  <li>Nút "Sao chép" ở góc khối mã: copy TOÀN BỘ mã, giữ nguyên thụt lề gốc.</li>
                  <li>Icon copy nhỏ bên phải mỗi dòng: copy đúng 1 dòng, tự động bỏ thụt lề thừa (paste ra ngoài không bị lệch cột).</li>
                  <li>Giữ Shift rồi bấm dòng thứ 2: copy nguyên cả khối từ dòng bấm lần đầu đến dòng đó, cũng tự bỏ phần thụt lề chung dư thừa nhưng vẫn giữ đúng thụt lề tương đối bên trong khối (VD: nội dung con của <code>\foreach</code>).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#2f5d99] uppercase tracking-wide">9. Phím tắt bàn phím</h4>
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

          </div>

          <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#dbe4ee] text-right shrink-0">
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
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}

      {/* Xác nhận tạo bản vẽ mới khi bản đang vẽ chưa từng được lưu */}
      {showUnsavedNewConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#dbe4ee] rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#fef3c7] text-[#92400e] flex items-center justify-center mx-auto">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-semibold text-[#16233a]">
                  Bản vẽ chưa được lưu
                </h3>
                <p className="text-xs text-[#5b6b82] leading-relaxed">
                  Bản vẽ hiện tại chưa từng được lưu. Bạn muốn lưu lại trước khi tạo bản mới, hay xoá luôn không lưu?
                </p>
              </div>
            </div>

            <div className="px-4 pb-4 flex flex-col gap-1.5">
              <button
                onClick={handleSaveThenNew}
                disabled={busy}
                className="w-full py-1.5 px-3 bg-[#2f5d99] hover:bg-[#254a7a] text-white text-xs font-semibold rounded-md shadow-xs transition-colors disabled:opacity-50"
              >
                💾 Lưu lại rồi tạo mới
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowUnsavedNewConfirm(false)}
                  className="flex-1 py-1.5 px-3 bg-white hover:bg-[#f1f5f9] text-[#16233a] border border-[#dbe4ee] text-xs font-semibold rounded-md transition-colors"
                >
                  Huỷ bỏ
                </button>
                <button
                  onClick={performNewDrawing}
                  className="flex-1 py-1.5 px-3 bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
                >
                  Không lưu, xoá luôn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
