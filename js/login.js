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
const ADMIN_NAME = '관리자';
const ADMIN_PW = 'sdf';

function handleLogin() {
    const name = document.getElementById('idInput').value.trim();

    clearError('idWrap', 'idError');
    clearError('pwWrap', 'pwError');

    if (name === ADMIN_NAME) {
        const pw = document.getElementById('pwInput').value;
        if (pw !== ADMIN_PW) {
            showError('pwWrap', 'pwError');
            return;
        }
        sessionStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('userName', '관리자');
    } else {
        sessionStorage.setItem('userRole', 'user');
        if (name) sessionStorage.setItem('userName', name);
        else sessionStorage.removeItem('userName');
    }

    location.href = 'index.html';
}

/* ---- 이름 입력 시 관리자 비밀번호 필드 토글 ---- */
document.getElementById('idInput').addEventListener('input', function() {
    const pwGroup = document.getElementById('pwGroup');
    if (this.value.trim() === ADMIN_NAME) {
        pwGroup.style.display = '';
    } else {
        pwGroup.style.display = 'none';
        document.getElementById('pwInput').value = '';
        clearError('pwWrap', 'pwError');
    }
});

/* ---- 입력 시 에러 초기화 ---- */
document.getElementById('pwInput').addEventListener('input', function() {
    if (this.value) clearError('pwWrap', 'pwError');
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
