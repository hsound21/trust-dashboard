// 다크 모드 토글 (초기 테마는 index.html 인라인 스크립트가 적용)
export function initTheme(button) {
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* 저장 실패는 무시 */ }
  });
}
