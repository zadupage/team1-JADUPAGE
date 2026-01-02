// URL에서 상품 id 가져오기
const params = new URLSearchParams(window.location.search);
const productId = params.get('id');


// 파라미터?
fetch(`http://localhost:3000/products/${productId}`)
  .then(res => {
    console.log('응답 status:', res.status);
    return res.json();
  })
  .then(product => {
    console.log('상품 데이터:', product);

    //가격
    price = product.price;

    //TODO: 이미지 입력 방법 한 번 더 생각해보고 확인하고 입력하기
    document.querySelector('.product-image img').src = 
    `/assets/images/product${product.id}.png`;


    document.getElementById('productName').textContent = product.name;
    document.getElementById('productBrand').textContent = product.info;
    document.querySelector('.price').textContent =
    product.price.toLocaleString() + '원';

  })
  //에러
  .catch(err => {
    console.error(err);
    alert('상품 정보를 불러오지 못했습니다.');
});

// 가격, 수량
const minusBtn = document.querySelector('.quantify button:first-child');
const plusBtn = document.querySelector('.quantify button:last-child');
const quantityInput = document.querySelector('.quantify input');

const totalQuantityText = document.querySelector('.total-quantify');
const totalPriceText = document.querySelector('.total-price');

let quantity = 1;
let price = 0;


  // + / - 버튼 클릭
plusBtn.addEventListener('click', () => {
  if (quantity >= 99) return;
  quantity++;
  updateTotal();
});

minusBtn.addEventListener('click', () => {
  if (quantity <= 1) return;
  quantity--;
  updateTotal();
});


// tab 버튼
const tabbtn = document.getElementById('tab-btn');
const tabReview = document.getElementById('tab-review');
const tabQna = document.getElementById('tab-qna');
const tabReturn = document.getElementById('tab-return');

const tabs = [tabbtn, tabReview, tabQna, tabReturn];

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});


// 로그인 모달
const buyBtn = document.querySelector('.buy');
const cartBtn = document.querySelector('.장바구니');

const modal = document.getElementById('loginModal');
const modalNo = document.getElementById('modalNo');
const modalYes = document.getElementById('modalYes');
const overlay = document.querySelector('.modal-overlay');
const closeBtn = document.querySelector('.modal-close');

//TODO: 로그인관련 바꿔야 할 것 (연습용)
const isLogin = !!localStorage.getItem('accessToken');


function openModal() {
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}


// 로그인 체크 공통 함수
function requireLogin(callback) {
  return function (e) {
    e.preventDefault();

    if (!isLogin) {
      openModal();
      return;
    }

    callback();
  };
}


// 바로 구매
buyBtn.addEventListener(
  'click', requireLogin(() => {
    console.log('구매 페이지로 이동');
    window.location.href = '/pages/order.html'
  })
);


// 장바구니
cartBtn.addEventListener(
  'click', requireLogin(() => {
    console.log('장바구니 페이지로 이동')
    window.location.href = '/pages/cart-page-none.html'
  })
);


// 모달 닫기
modalNo.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);


//로그인 페이지로 이동
modalYes.addEventListener('click', () => {
  window.location.href = 'pages/login.html'; //아직 연결 안됨
});