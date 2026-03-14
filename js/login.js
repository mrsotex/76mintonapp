let rememberChecked = true;

/* ---- 로그인 상태 유지 체크박스 ---- */
function toggleRemember() {
    rememberChecked = !rememberChecked;
    const checkbox = document.getElementById('checkbox');
    const rememberLeft = checkbox.closest('[role="checkbox"]');
    checkbox.classList.toggle('unchecked', !rememberChecked);
    rememberLeft.setAttribute('aria-checked', rememberChecked);
}

/* ---- 에러 표시/숨기기 ---- */
function showError(wrapId, errorId) {
    document.getElementById(wrapId).classList.add('error');
    document.getElementById(errorId).classList.add('show');
}

function clearError(wrapId, errorId) {
    document.getElementById(wrapId).classList.remove('error');
    document.getElementById(errorId).classList.remove('show');
}

/* ---- 로그인 처리 ---- */
const ADMIN_CODE = 'sdf';

function handleLogin() {
    const id = document.getElementById('idInput').value.trim();

    clearError('idWrap', 'idError');

    const role = (id === ADMIN_CODE) ? 'admin' : 'user';
    const displayName = (id === ADMIN_CODE) ? '관리자' : id;

    sessionStorage.setItem('userRole', role);
    if (displayName) sessionStorage.setItem('userName', displayName);
    else sessionStorage.removeItem('userName');
    location.href = 'index.html';
}

/* ---- 카카오 로그인 ---- */
function handleKakaoLogin() {
    // TODO: 카카오 SDK 연결
    console.log('카카오 로그인 시도');
}

/* ---- 입력 시 에러 초기화 ---- */
document.getElementById('idInput').addEventListener('input', function() {
    if (this.value.trim()) clearError('idWrap', 'idError');
});

/* ---- Enter 키로 로그인 ---- */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') handleLogin();
});

/* ---- 키보드로 체크박스 토글 ---- */
document.querySelector('[role="checkbox"]').addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleRemember();
    }
});
