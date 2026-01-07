const API_BASE_URL = "http://localhost:3000/api";

// -----------------------------
// 유틸
// -----------------------------
function formatWon(num) {
  const n = Number(num || 0);
  return n.toLocaleString("ko-KR") + "원";
}

function onlyDigits(el) {
  el.addEventListener("input", () => {
    el.value = el.value.replace(/[^\d]/g, "");
  });
}

function getAccessToken() {
  // 프로젝트 전반에서 access_token을 쓰는 흐름이 많아서 우선순위로 잡음
  return (
    localStorage.getItem("access_token") || localStorage.getItem("token") || ""
  );
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.message ||
      data?.error ||
      (typeof data === "string" ? data : "") ||
      "요청 실패";
    throw new Error(msg);
  }
  return data;
}

function getQuery() {
  return new URLSearchParams(window.location.search);
}

// -----------------------------
// DOM
// -----------------------------
const $orderItems = document.getElementById("orderItems");
const $totalPriceText = document.getElementById("totalPriceText");

const $sumProduct = document.getElementById("sumProduct");
const $sumDiscount = document.getElementById("sumDiscount");
const $sumShip = document.getElementById("sumShip");
const $sumPay = document.getElementById("sumPay");

const $payBtn = document.getElementById("payBtn");
const $agree = document.getElementById("agree");

const $btnPostcode = document.getElementById("btnPostcode");
const $postcode = document.getElementById("postcode");
const $addr1 = document.getElementById("addr1");
const $addr2 = document.getElementById("addr2");
const $addrExtra = document.getElementById("addrExtra");

// modal
const $modal = document.getElementById("modal");
const $modalClose = document.getElementById("modalClose");
const $modalOk = document.getElementById("modalOk");
// order.html에 id="modalTitle" 추가한 버전이면 이걸 쓰고,
// 혹시 HTML을 절대 못 건드리는 상황이면 아래 fallback이 잡아줌
const $modalTitle =
  document.getElementById("modalTitle") || $modal.querySelector(".modal-title");

// inputs
const $buyerName = document.getElementById("buyerName");
const $buyerPhone1 = document.getElementById("buyerPhone1");
const $buyerPhone2 = document.getElementById("buyerPhone2");
const $buyerPhone3 = document.getElementById("buyerPhone3");
const $buyerEmail = document.getElementById("buyerEmail");

const $recvName = document.getElementById("recvName");
const $recvPhone1 = document.getElementById("recvPhone1");
const $recvPhone2 = document.getElementById("recvPhone2");
const $recvPhone3 = document.getElementById("recvPhone3");
const $shipMsg = document.getElementById("shipMsg");

// -----------------------------
// 모달 (같은 디자인 재활용 + OK 동작만 바꿀 수 있게)
// -----------------------------
let modalOkHandler = null;

function openModal(message, onOk) {
  if ($modalTitle) $modalTitle.textContent = message || "";
  modalOkHandler = typeof onOk === "function" ? onOk : null;

  $modal.classList.remove("hidden");
  $modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  $modal.classList.add("hidden");
  $modal.setAttribute("aria-hidden", "true");
  modalOkHandler = null;
}

$modalClose.addEventListener("click", closeModal);

$modalOk.addEventListener("click", () => {
  if (modalOkHandler) {
    modalOkHandler();
    return;
  }
  closeModal();
});

$modal.addEventListener("click", (e) => {
  if (e.target?.dataset?.close === "true") closeModal();
});

// -----------------------------
// Daum postcode (open 방식)
// -----------------------------
function openDaumPostcode() {
  if (!window.daum?.Postcode) {
    alert("우편번호 서비스를 불러오지 못했습니다.");
    return;
  }

  new daum.Postcode({
    oncomplete: function (data) {
      let addr = "";
      let extraAddr = "";

      if (data.userSelectedType === "R") addr = data.roadAddress;
      else addr = data.jibunAddress;

      if (data.userSelectedType === "R") {
        if (data.bname !== "" && /[동|로|가]$/g.test(data.bname))
          extraAddr += data.bname;
        if (data.buildingName !== "" && data.apartment === "Y") {
          extraAddr +=
            extraAddr !== "" ? ", " + data.buildingName : data.buildingName;
        }
        if (extraAddr !== "") extraAddr = " (" + extraAddr + ")";
      }

      $postcode.value = data.zonecode || "";
      $addr1.value = addr || "";
      $addrExtra.value = extraAddr || "";

      $addr2.focus();
    },
  }).open();
}

$btnPostcode.addEventListener("click", openDaumPostcode);

// -----------------------------
// 주문 데이터 로딩 (✅ product-details: query / ✅ cart: localStorage / ✅ 예전: sessionStorage)
// -----------------------------
let currentOrder = null; // { type: 'direct_order' | 'cart_order', items: [...] }
let currentTotal = 0;

function normalizeImagePath(img) {
  if (!img) return "../../assets/images/product1.png";
  // 서버에 ./ 로 저장된 이미지면 pages 기준 상대경로 보정
  if (typeof img === "string" && img.startsWith("./")) {
    return img.replace("./", "../../");
  }
  return img;
}

async function loadOrderData() {
  // 1) product-details에서 바로구매: ../order/order.html?id=...&quantity=...
  const qs = getQuery();
  const productId = qs.get("id");
  const quantity = Number(qs.get("quantity") || 1);

  if (productId) {
    const product = await fetchJSON(`${API_BASE_URL}/products/${productId}`);
    return {
      type: "direct_order",
      items: [
        {
          product_id: product.id,
          name: product.name,
          brand: product.seller?.store_name || "백엔드글로벌",
          price: product.price,
          image: normalizeImagePath(product.image),
          quantity: Math.max(1, quantity || 1),
        },
      ],
    };
  }

  // 2) (이전 방식) sessionStorage.orderData
  try {
    const s = sessionStorage.getItem("orderData");
    if (s) {
      const parsed = JSON.parse(s);

      // 이미 {type, items}면 그대로
      if (parsed?.type && Array.isArray(parsed?.items)) return parsed;
      // 혹시 items만 덩그러니 저장된 형태라면 감싸기
      if (Array.isArray(parsed)) return { type: "cart_order", items: parsed };
    }
  } catch {}

  // 3) cart.js 방식: localStorage.orderData = {items:[...], timestamp:...}
  try {
    const l = localStorage.getItem("orderData");
    if (l) {
      const parsed = JSON.parse(l);
      if (Array.isArray(parsed?.items)) {
        return { type: "cart_order", items: parsed.items };
      }
    }
  } catch {}

  return { type: null, items: [] };
}

// -----------------------------
// 렌더
// -----------------------------
function renderOrderItems(items = []) {
  $orderItems.innerHTML = "";

  if (!items.length) {
    $orderItems.innerHTML = `
      <div class="item" style="grid-template-columns: 1fr;">
        <div class="item-cell" style="text-align:left; padding:10px 0;">
          주문 정보가 없습니다. 다시 주문해주세요.
        </div>
      </div>
    `;
    return 0;
  }

  let total = 0;

  for (const it of items) {
    const name = it.name || it.product_name || "상품";
    const brand = it.brand || it.category || it.seller || "백엔드글로벌";
    const qty = Number(it.quantity || 1);
    const price = Number(it.price || it.product_price || 0);

    const thumb = normalizeImagePath(it.image || it.thumbnail || it.image_url);

    const rowPrice = price * qty;
    total += rowPrice;

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="item-product">
        <div class="item-thumb"><img src="${thumb}" alt="" /></div>
        <div class="item-meta">
          <div class="item-brand">${brand}</div>
          <div class="item-name">${name}</div>
          <div class="item-qty">수량 : ${qty}개</div>
        </div>
      </div>
      <div class="item-cell">-</div>
      <div class="item-cell">무료배송</div>
      <div class="item-cell item-price">${formatWon(rowPrice)}</div>
    `;
    $orderItems.appendChild(el);
  }

  return total;
}

function updateSummary(total) {
  $totalPriceText.textContent = formatWon(total);

  $sumProduct.textContent = formatWon(total);
  $sumDiscount.textContent = formatWon(0);
  $sumShip.textContent = formatWon(0);
  $sumPay.textContent = formatWon(total);
}

// -----------------------------
// 결제(주문 생성 API 호출) - 서버(server.js) 스펙에 맞춤
// -----------------------------
function isFormValid() {
  const buyerName = $buyerName.value.trim();
  const buyerPhone = (
    $buyerPhone1.value +
    $buyerPhone2.value +
    $buyerPhone3.value
  ).trim();
  const buyerEmail = $buyerEmail.value.trim();

  const recvName = $recvName.value.trim();
  const recvPhone = (
    $recvPhone1.value +
    $recvPhone2.value +
    $recvPhone3.value
  ).trim();

  const postcode = $postcode.value.trim();
  const addr1 = $addr1.value.trim();
  const addr2 = $addr2.value.trim();

  if (!buyerName)
    return { ok: false, msg: "배송정보를 빠짐없이 입력해주세요." };
  if (buyerPhone.length < 10)
    return { ok: false, msg: "배송정보를 빠짐없이 입력해주세요." };
  if (!buyerEmail)
    return { ok: false, msg: "배송정보를 빠짐없이 입력해주세요." };

  if (!recvName) return { ok: false, msg: "배송정보를 빠짐없이 입력해주세요." };
  if (recvPhone.length < 10)
    return { ok: false, msg: "배송정보를 빠짐없이 입력해주세요." };

  if (!postcode || !addr1 || !addr2)
    return { ok: false, msg: "배송정보를 빠짐없이 입력해주세요." };

  if (!$agree.checked) {
    return { ok: false, msg: "주문 내용 확인 및 동의 체크를 해주세요." };
  }

  return { ok: true, msg: "" };
}

function mapPaymentValue(v) {
  // order.html radio 값 -> server.js 허용 값
  switch (v) {
    case "card":
      return "card";
    case "bank":
      return "deposit";
    case "mobile":
      return "phone";
    case "naver":
      return "naverpay";
    case "kakao":
      return "kakaopay";
    default:
      return "card";
  }
}

function getSelectedPayment() {
  const checked = document.querySelector('input[name="pay"]:checked');
  return mapPaymentValue(checked?.value || "card");
}

function buildReceiverPhone() {
  return `${$recvPhone1.value}-${$recvPhone2.value}-${$recvPhone3.value}`;
}

function buildFullAddress() {
  const a1 = $addr1.value.trim();
  const extra = $addrExtra.value.trim();
  const a2 = $addr2.value.trim();
  return [a1, extra, a2].filter(Boolean).join(" ");
}

async function createOrder(order) {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const orderType = order?.type; // direct_order | cart_order
  const items = order?.items || [];
  if (!items.length) throw new Error("주문 상품 정보가 없습니다.");

  const bodyCommon = {
    total_price: currentTotal, // 서버 검증이 이 값과 맞아야 통과
    receiver: $recvName.value.trim(),
    receiver_phone_number: buildReceiverPhone(),
    address: buildFullAddress(),
    address_message: $shipMsg.value.trim(),
    payment_method: getSelectedPayment(),
  };

  // ✅ direct_order
  if (orderType === "direct_order") {
    const first = items[0] || {};
    const product_id = first.product_id ?? first.productId ?? first.id;
    const quantity = Number(first.quantity || 1);
    if (!product_id) throw new Error("직접구매 상품 정보가 없습니다.");

    return fetchJSON(`${API_BASE_URL}/order/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        order_type: "direct_order",
        product_id,
        quantity,
        ...bodyCommon,
      }),
    });
  }

  // ✅ cart_order
  if (orderType === "cart_order") {
    // server.js는 cart_items: [{ product_id }] 형태로 조회/검증 후
    // 해당 product_id들을 cart에서 제거함
    const cart_items = items.map((it) => ({
      product_id: it.product_id ?? it.productId ?? it.id,
    }));

    if (!cart_items.length || !cart_items[0].product_id) {
      throw new Error("장바구니 주문 상품 정보가 올바르지 않습니다.");
    }

    return fetchJSON(`${API_BASE_URL}/order/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        order_type: "cart_order",
        cart_items,
        ...bodyCommon,
      }),
    });
  }

  throw new Error("주문 타입을 확인할 수 없습니다.");
}

function cleanupAfterSuccess(orderType) {
  // 주문 정보는 정리 (메인 상품 데이터는 절대 안 건드림)
  sessionStorage.removeItem("orderData");
  localStorage.removeItem("orderData");

  // 장바구니 주문이면, 서버에서 cart_order 처리 시 cart에서 제거됨
  // + 혹시 UI 캐시로 sessionStorage cartData 등을 쓰는 프로젝트도 있어서 안전 정리
  if (orderType === "cart_order") {
    sessionStorage.removeItem("cartData");
  }
}

// -----------------------------
// 결제 버튼
// -----------------------------
$payBtn.addEventListener("click", async () => {
  const v = isFormValid();
  if (!v.ok) {
    openModal(v.msg); // 기존 모달 디자인 그대로
    return;
  }

  if (!currentOrder || !currentOrder.items?.length) {
    openModal("주문 정보가 없습니다. 다시 주문해주세요.");
    return;
  }

  try {
    await createOrder(currentOrder);

    // ✅ 결제 완료 모달 (같은 위치/같은 디자인)
    openModal("결제가 완료되었습니다.", () => {
      cleanupAfterSuccess(currentOrder.type);
      window.location.href = "../../index.html";
    });
  } catch (err) {
    alert(err?.message || "결제 처리 중 오류가 발생했습니다.");
  }
});

// -----------------------------
// 초기화
// -----------------------------
(async function init() {
  // 숫자만 입력
  [
    $buyerPhone1,
    $buyerPhone2,
    $buyerPhone3,
    $recvPhone1,
    $recvPhone2,
    $recvPhone3,
  ].forEach(onlyDigits);

  closeModal();

  currentOrder = await loadOrderData();
  const items = currentOrder?.items || [];

  currentTotal = renderOrderItems(items);
  updateSummary(currentTotal);

  // 주문 타입이 null이면(=주문정보 없음) 사용자에게도 바로 보이게
  if (!currentOrder?.type || !items.length) {
    // 렌더에 이미 문구가 나오긴 하지만, 결제 클릭 전에도 알림 느낌 주고 싶으면 모달 띄워도 됨
    // openModal("주문 정보가 없습니다. 다시 주문해주세요.");
  }
})();
