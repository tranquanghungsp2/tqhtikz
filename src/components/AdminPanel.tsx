import React, { useState, useEffect } from 'react';
import { X, Check, Ban, RotateCcw } from 'lucide-react';
import { listAllProfiles, updateProfileStatus, ProfileRow } from '../lib/profiles';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const reload = async () => {
    setLoading(true);
    try {
      setProfiles(await listAllProfiles());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleSetStatus = async (id: string, status: 'pending' | 'approved' | 'rejected') => {
    await updateProfileStatus(id, status);
    await reload();
  };

  const filtered = profiles.filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#dbe4ee]">
          <h2 className="text-sm font-semibold text-[#16233a]">Quản lý người dùng</h2>
          <button onClick={onClose} className="text-[#5b6b82] hover:text-[#16233a]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 px-4 pt-3">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                filter === f
                  ? 'bg-[#e4ecf7] border-[#2f5d99] text-[#2f5d99]'
                  : 'bg-white border-[#dbe4ee] text-[#5b6b82] hover:bg-[#f8fafc]'
              }`}
            >
              {f === 'pending' ? 'Chờ duyệt' : f === 'approved' ? 'Đã duyệt' : f === 'rejected' ? 'Từ chối' : 'Tất cả'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <p className="text-xs text-[#94a3b8] italic">Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-[#94a3b8] italic">Không có tài khoản nào ở mục này.</p>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-md border border-[#dbe4ee] bg-[#f8fafc]"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#16233a] truncate">
                    {p.display_name || '(chưa có tên)'}
                    {p.is_admin && <span className="ml-1.5 text-[10px] text-[#2f5d99] font-semibold">ADMIN</span>}
                  </div>
                  <div className="text-[11px] text-[#5b6b82] truncate">{p.email}</div>
                  <div className="text-[10px] text-[#94a3b8]">{new Date(p.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'approved'
                        ? 'bg-[#d1fae5] text-[#059669]'
                        : p.status === 'rejected'
                        ? 'bg-[#fee2e2] text-[#b91c1c]'
                        : 'bg-[#fef3c7] text-[#92400e]'
                    }`}
                  >
                    {p.status === 'approved' ? 'Đã duyệt' : p.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                  </span>
                  {p.status !== 'approved' && (
                    <button
                      onClick={() => handleSetStatus(p.id, 'approved')}
                      title="Duyệt"
                      className="p-1.5 rounded bg-[#059669] hover:bg-[#047857] text-white"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                  {p.status !== 'rejected' && (
                    <button
                      onClick={() => handleSetStatus(p.id, 'rejected')}
                      title="Từ chối"
                      className="p-1.5 rounded bg-[#b91c1c] hover:bg-[#991b1b] text-white"
                    >
                      <Ban className="w-3 h-3" />
                    </button>
                  )}
                  {p.status !== 'pending' && (
                    <button
                      onClick={() => handleSetStatus(p.id, 'pending')}
                      title="Đưa về chờ duyệt"
                      className="p-1.5 rounded bg-white border border-[#dbe4ee] hover:bg-[#f1f5f9] text-[#5b6b82]"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
