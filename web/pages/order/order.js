// web/pages/order/order.js

const API_BASE = "http://localhost:3000/api"; // server.js 기준

// -----------------------------
// 공통 유틸
// -----------------------------
function getAccessToken() {
  return localStorage.getItem("access_token") || "";
}

function authHeaders() {
  const token = getAccessToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString("ko-KR");
}

function qs(sel) {
  return document.querySelector(sel);
}

function qsa(sel) {
  return [...document.querySelectorAll(sel)];
}

// -----------------------------
// 레이아웃(header/footer) 주입
// - 기존 layout.js는 /components/... 절대경로라서(라이브서버 5500) 깨지기 쉬움
// - order 페이지에서는 상대경로로 안전하게 가져와서 header/footer만
// -----------------------------
async function injectHeaderFooter() {
  const headerEl = qs("#site-header");
  const footerEl = qs("#site-footer");
  if (!headerEl || !footerEl) return;

  try {
    // order.html 위치: /web/pages/order/  -> components는 ../../components/
    const res = await fetch("../../components/layout.html", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`layout.html fetch failed: ${res.status}`);
    const html = await res.text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    const header = doc.querySelector("header");
    const footer = doc.querySelector("footer");

    headerEl.innerHTML = header ? header.innerHTML : "";
    footerEl.innerHTML = footer ? footer.innerHTML : "";

    // layout.html 내부가 /assets/... /index.html 같은 절대경로라면
    // 라이브서버(프로젝트 루트)에서도 보이게 상대경로로 보정
    normalizeLayoutPaths(headerEl);
    normalizeLayoutPaths(footerEl);
  } catch (e) {
    // 레이아웃이 실패해도 페이지 기능은 살아야 함
    console.warn("[order] header/footer inject failed:", e);
  }
}

function normalizeLayoutPaths(root) {
  // order 페이지 기준 root(= /web)로 올라가는 상대경로
  // /assets/...  -> ../../assets/...
  // /index.html  -> ../../index.html
  // /pages/...   -> ../../pages/...
  const to = (p) => `../../${p.replace(/^\//, "")}`;

  root.querySelectorAll("[src]").forEach((el) => {
    const v = el.getAttribute("src");
    if (v && v.startsWith("/")) el.setAttribute("src", to(v));
  });

  root.querySelectorAll("[href]").forEach((el) => {
    const v = el.getAttribute("href");
    if (v && v.startsWith("/")) el.setAttribute("href", to(v));
  });
}

// -----------------------------
// 모달
// -----------------------------
function openModal(msg) {
  const back = qs("#modalBack");
  const text = qs("#modalText");
  if (!back || !text) return;

  text.textContent = msg;
  back.hidden = false;
}

function closeModal() {
  const back = qs("#modalBack");
  if (!back) return;
  back.hidden = true;
}

// -----------------------------
// orderData 로드/렌더
// PROJECT.md 규격:
// sessionStorage key: "orderData"
// value: JSON.stringify([ { order_type, ... } ])
// -----------------------------
function loadOrderData() {
  try {
    const raw = sessionStorage.getItem("orderData");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed[0]) return parsed[0];
    return parsed || null;
  } catch {
    return null;
  }
}

async function fetchProduct(productId) {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`products/${productId} ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchCart() {
  const res = await fetch(`${API_BASE}/cart`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`cart ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

function renderEmptyOrder(message) {
  const list = qs("#orderList");
  if (!list) return;
  list.innerHTML = `
    <div class="orderItem" style="grid-template-columns: 1fr; border-top:none;">
      <div style="padding: 0.75rem 0;">
        ${message}
      </div>
    </div>
  `;
  setTotals(0, 0, 0);
}

function setTotals(productPrice, discount, ship) {
  qs("#finalProduct").textContent = money(productPrice);
  qs("#finalDiscount").textContent = money(discount);
  qs("#finalShip").textContent = money(ship);
  qs("#finalTotal").textContent = money(productPrice - discount + ship);
  qs("#sumPrice").textContent = `${money(productPrice - discount + ship)}원`;
}

function renderOrderItems(items) {
  const list = qs("#orderList");
  if (!list) return;

  list.innerHTML = items
    .map((it) => {
      const img = it.image || "";
      const brand = it.brand || "";
      const name = it.product_name || it.name || "";
      const qty = it.quantity || 1;
      const price = Number(it.price || 0) * Number(qty || 1);

      return `
        <div class="orderItem">
          <div class="itemLeft">
            <img class="thumb" src="${img}" alt="${name}" />
            <div class="itemMeta">
              <div class="brand">${brand}</div>
              <div class="pname">${name}</div>
              <div class="qty">수량 : ${qty}개</div>
            </div>
          </div>
          <div class="cell">-</div>
          <div class="cell">무료배송</div>
          <div class="cell right">${money(price)}원</div>
        </div>
      `;
    })
    .join("");
}

// -----------------------------
// Daum 우편번호
// -----------------------------
function setupPostcode() {
  const btn = qs("#btnPostcode");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!window.daum || !window.daum.Postcode) {
      openModal("우편번호 서비스 스크립트를 불러오지 못했어요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: function (data) {
        let addr = "";
        let extraAddr = "";

        if (data.userSelectedType === "R") addr = data.roadAddress;
        else addr = data.jibunAddress;

        if (data.userSelectedType === "R") {
          if (data.bname !== "" && /[동|로|가]$/g.test(data.bname)) {
            extraAddr += data.bname;
          }
          if (data.buildingName !== "" && data.apartment === "Y") {
            extraAddr += (extraAddr !== "" ? ", " : "") + data.buildingName;
          }
          if (extraAddr !== "") extraAddr = ` (${extraAddr})`;
        }

        qs("#postcode").value = data.zonecode || "";
        qs("#address").value = addr || "";
        qs("#extraAddress").value = extraAddr || "";
        qs("#detailAddress").focus();
      },
    }).open();
  });
}

// -----------------------------
// 결제 검증 + 주문 API
// -----------------------------
function getPhone(prefixSel) {
  const a = qs(`${prefixSel}1`).value.trim();
  const b = qs(`${prefixSel}2`).value.trim();
  const c = qs(`${prefixSel}3`).value.trim();
  return { a, b, c, full: `${a}-${b}-${c}` };
}

function requiredValue(id) {
  const el = qs(`#${id}`);
  return el ? el.value.trim() : "";
}

function validateShipping() {
  // 주문자
  if (!requiredValues("ordererName")) return false;
  const op = getPhone("#ordererPhone");
  if (!op.a || !op.b || !op.c) return false;
  if (!requiredValue("ordererEmail")) return false;

  // 수령인
  if (!requiredValue("receiverName")) return false;
  const rp = getPhone("#receiverPhone");
  if (!rp.a || !rp.b || !rp.c) return false;

  // 주소
  if (!requiredValue("postcode")) return false;
  if (!requiredValue("address")) return false;
  if (!requiredValue("detailAddress")) return false;

  // 동의 체크 (원하면 주석 처리 가능)
  if (!qs("#agreeCheck").checked) return false;

  return true;
}

function requiredValue(id) {
  const el = qs(`#${id}`);
  return el ? el.value.trim() : "";
}

// 오타 방지: validateShipping에서 쓸 helper
function requiredValueSafe(id) {
  return requiredValue(id);
}

// validateShipping 내부에서 실수 방지용 alias
function requiredValue(id) {
  const el = qs(`#${id}`);
  return el ? el.value.trim() : "";
}

function getPayMethod() {
  const checked = qs('input[name="pay"]:checked');
  const v = checked ? checked.value : "card";

  return v;
}

async function clearCart() {
  // server.js: DELETE /api/cart/  -> 전체 삭제
  const res = await fetch(`${API_BASE}/cart/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    console.warn("[order] clearCart failed:", res.status);
  }
}

async function createOrder(orderData) {
  const receiver = requiredValue("receiverName");
  const receiverPhone = getPhone("#receiverPhone").full;
  const payMethod = getPayMethod();

  const payload = { ...orderData };
  payload.receiver = receiver;
  payload.receiver_phone_number = receiverPhone;
  payload.payment_method = payMethod;

  // server.js에서 필요한 값들(누락 방지)
  if (!payload.total_price) payload.total_price = 0;

  const res = await fetch(`${API_BASE}/order/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json && json.message) ||
      "주문 생성에 실패했어요. 로그인/토큰/서버 상태를 확인해줘!";
    throw new Error(msg);
  }
  return json.data;
}

function setupPayButton(orderData) {
  const btnPay = qs("#btnPay");
  if (!btnPay) return;

  btnPay.addEventListener("click", async () => {
    // ✅ 버튼은 항상 초록색이지만, 검증은 클릭했을 때만 한다
    if (!validateAllInputs()) {
      openModal("배송정보를 빠짐없이 입력해주세요.");
      return;
    }

    try {
      // total_price 계산값 보정 (화면의 결제금액 기준)
      const total =
        Number(qs("#finalTotal").textContent.replace(/,/g, "")) || 0;
      const payload = { ...orderData, total_price: total };

      await createOrder(payload);

      // 결제 완료 → 장바구니 비우고 메인으로
      await clearCart();
      sessionStorage.removeItem("orderData");

      // main 페이지로 이동 (index.html)
      location.href = "../../index.html";
    } catch (e) {
      openModal(e.message || "결제 처리 중 오류가 발생했어요.");
    }
  });
}

function validateAllInputs() {
  // 주문자
  if (!requiredValue("ordererName")) return false;
  const op1 = requiredValue("ordererPhone1");
  const op2 = requiredValue("ordererPhone2");
  const op3 = requiredValue("ordererPhone3");
  if (!op1 || !op2 || !op3) return false;
  if (!requiredValue("ordererEmail")) return false;

  // 수령인
  if (!requiredValue("receiverName")) return false;
  const rp1 = requiredValue("receiverPhone1");
  const rp2 = requiredValue("receiverPhone2");
  const rp3 = requiredValue("receiverPhone3");
  if (!rp1 || !rp2 || !rp3) return false;

  // 주소
  if (!requiredValue("postcode")) return false;
  if (!requiredValue("address")) return false;
  if (!requiredValue("detailAddress")) return false;

  // 동의 체크
  if (!qs("#agreeCheck").checked) return false;

  return true;
}

// -----------------------------
// 초기화
// -----------------------------
async function init() {
  // 모달 기본 세팅
  const modalX = qs("#modalX");
  const modalOk = qs("#modalOk");
  const modalBack = qs("#modalBack");
  if (modalX) modalX.addEventListener("click", closeModal);
  if (modalOk) modalOk.addEventListener("click", closeModal);
  if (modalBack) {
    modalBack.addEventListener("click", (e) => {
      if (e.target === modalBack) closeModal();
    });
  }

  await injectHeaderFooter();
  setupPostcode();

  const orderData = loadOrderData();

  // orderData가 없으면 안내만 띄우고 끝
  if (!orderData) {
    renderEmptyOrder(
      "주문 정보가 없습니다. (orderData가 비어있어요) 다시 주문해주세요."
    );
    // 그래도 버튼 눌렀을 때 모달은 뜨게
    setupPayButton({
      order_type: "direct_order",
      total_price: 0,
      product_id: 0,
      quantity: 1,
    });
    return;
  }

  // 주문 아이템 렌더
  try {
    let items = [];

    if (orderData.order_type === "direct_order") {
      const p = await fetchProduct(orderData.product_id);
      items = [
        {
          ...p,
          quantity: orderData.quantity || 1,
          // 서버 데이터에 이미지 키가 다르면 보정
          image: p.image || p.thumbnail || p.img || "",
        },
      ];
    } else if (orderData.order_type === "cart_order") {
      const cart = await fetchCart();
      const ids = (orderData.cart_items || []).map((x) => x.product_id);
      const selected = cart.filter((c) => ids.includes(c.product_id));

      // cart 응답에서 상품정보 구조를 안전하게 펼치기
      items = selected.map((c) => {
        const p = c.product || c; // 서버 응답 구조에 따라 다를 수 있음
        return {
          ...p,
          product_name: p.product_name || p.name || c.product_name || "",
          brand: p.brand || c.brand || "",
          price: p.price || c.price || 0,
          image: p.image || p.thumbnail || p.img || c.image || "",
          quantity: c.quantity || 1,
        };
      });
    } else {
      // 예상 밖 타입
      items = [];
    }

    if (!items.length) {
      renderEmptyOrder(
        "주문 정보가 없습니다. (상품 목록이 비어있어요) 다시 주문해주세요."
      );
      setupPayButton(orderData);
      return;
    }

    renderOrderItems(items);

    // 금액 계산 (할인/배송비는 현재 디자인상 0/무료배송)
    const productSum = items.reduce(
      (acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 1),
      0
    );
    const discount = 0;
    const ship = 0;

    setTotals(productSum, discount, ship);
    setupPayButton({ ...orderData, total_price: productSum - discount + ship });
  } catch (e) {
    console.error(e);
    renderEmptyOrder("주문 데이터를 불러오지 못했어요. 서버/토큰을 확인해줘!");
    setupPayButton(orderData);
  }
}

init();
