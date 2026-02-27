let rememberChecked = true;
let passwordVisible = false;

/* ---- 비밀번호 표시/숨기기 ---- */
function togglePassword() {
    passwordVisible = !passwordVisible;
    const pwInput = document.getElementById('pwInput');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordVisible) {
        pwInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    } else {
        pwInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
            <path d="m6.72 6.72-4.95-4.95"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    }
}

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
const AUTH_CODES = { 'sdf': 'admin' };

function handleLogin() {
    const pw = document.getElementById('pwInput').value;

    clearError('idWrap', 'idError');
    clearError('pwWrap', 'pwError');

    let role;
    if (pw === '') {
        role = 'user'; // 비밀번호 없이 입장 → 일반 사용자
    } else {
        role = AUTH_CODES[pw];
        if (!role) {
            const pwError = document.getElementById('pwError');
            pwError.textContent = '인증코드가 올바르지 않습니다.';
            showError('pwWrap', 'pwError');
            document.getElementById('pwInput').value = '';
            document.getElementById('pwInput').focus();
            return;
        }
    }

    sessionStorage.setItem('userRole', role);
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
