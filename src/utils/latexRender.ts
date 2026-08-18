import katex from 'katex';

// Chuyển 1 chuỗi nhãn CÓ THỂ chứa nhiều đoạn LaTeX đặt trong $...$ (ví dụ: "AB $=7\,m$")
// thành HTML: đoạn trong $...$ được KaTeX render thành công thức thật,
// phần chữ thường còn lại giữ nguyên (đã escape HTML để an toàn).
export function renderLatexToHtml(raw: string): string {
  if (!raw) return '';

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // split giữ lại luôn phần khớp $...$ trong kết quả (nhờ có dấu ngoặc trong regex)
  const parts = raw.split(/(\$[^$]*\$)/g);

  return parts
    .map((part) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
        const tex = part.slice(1, -1);
        try {
          return katex.renderToString(tex, { throwOnError: false, output: 'html' });
        } catch {
          return escapeHtml(part);
        }
      }
      return escapeHtml(part);
    })
    .join('');
}
