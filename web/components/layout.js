// 로그인 관련 공통
function getAccessToken() {
  return localStorage.getItem('accessToken');
}

function isLoggedIn() {
  return !!getAccessToken();
}

// 로그인 필요 처리
function requireLogin(callback) {
  return function (e) {
    e.preventDefault();
    if (!isLoggedIn()) {
      window.location.href = '/pages/login.html';
      return;
    }
    callback();
  };
}

// CSS 로드
loadCSS('/components/layout.css');

function loadCSS(url) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

// layout.html 로드 (header + footer)
loadLayout();

async function loadLayout() {
  try {
    const res = await fetch('/components/layout.html');
    if (!res.ok) throw new Error('layout.html 로드 실패');

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // body 맨 위에 header/footer 삽입
    document.body.prepend(...doc.body.children);

    // layout 삽입 후 이벤트 연결
    bindHeaderEvents();
  } catch (err) {
    console.error(err);
  }
}

// header 이벤트 바인딩
function bindHeaderEvents() {
  // 장바구니 버튼
  const cartBtn = document.querySelector(
    'header .icon-item[aria-label="장바구니"]'
  );

  if (cartBtn) {
    cartBtn.addEventListener(
      'click',
      requireLogin(() => {
        window.location.href = '/pages/cart-page-none.html';
      })
    );
  }

  // 마이페이지 버튼
  const mypageBtn = document.querySelector(
    'header .icon-item[aria-label="마이페이지"]'
  );

  if (mypageBtn) {
    mypageBtn.addEventListener('click', () => {
      if (!isLoggedIn()) {
        window.location.href = '/pages/login.html';
      } else {
        window.location.href = '/pages/404.html';
      }
    });
  }
}