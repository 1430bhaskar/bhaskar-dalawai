/* gift-guide.js
   - Dynamic modal product fetch
   - Renders variants from product JSON
   - Finds matching variant id from selected options
   - Adds item via AJAX POST to /cart/add.js
   - Special rule: if selected options include Color=Black and Size=Medium,
     also add the product with handle UPSELL_PRODUCT_HANDLE to the cart automatically.
   - No jQuery. Vanilla JS only.
*/

(function () {
  const SECTION = document.querySelector(".gift-guide-grid-section");
  if (!SECTION) return;

  const modal = document.getElementById("gg-modal");
  const modalBody = modal?.querySelector(".gg-modal__body");
  const closeBtn = modal?.querySelector(".gg-modal__close");
  const UPSELL_PRODUCT_HANDLE =
    SECTION.dataset.upsellHandle || "soft-winter-jacket";
  const moneyFormat = SECTION.dataset.moneyFormat || "${{amount}}";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // -------------------- Money Format --------------------
  function formatMoney(cents) {
    if (cents == null) return "";
    const value = (cents / 100).toFixed(2);
    return moneyFormat
      .replace(/{{\s*amount\s*}}/, value)
      .replace(/{{\s*amount_no_decimals\s*}}/, Math.round(cents / 100));
  }

  // -------------------- Global Add-to-Cart Listener --------------------
  document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", function (e) {
      if (
        e.target.matches(
          'form[action*="/cart/add"] [type="submit"], .add-to-cart'
        )
      ) {
        // let Shopify post first, then check cart
        setTimeout(checkAndAddUpsellFromCart, 500);
      }
    });
  });

  function checkAndAddUpsellFromCart() {
    fetch("/cart.js")
      .then((res) => res.json())
      .then((cart) => {
        let hasTriggerProduct = false;
        let hasUpsell = false;

        cart.items.forEach((item) => {
          const color = (item.options_with_values.find((o) => o.name === "Color")?.value || "").toLowerCase();
          const size = (item.options_with_values.find((o) => o.name === "Size")?.value || "").toLowerCase();
          if (color === "black" && size === "medium") {
            hasTriggerProduct = true;
          }
          if (item.handle === UPSELL_PRODUCT_HANDLE) {
            hasUpsell = true;
          }
        });

        if (hasTriggerProduct && !hasUpsell) {
          fetch(`/products/${UPSELL_PRODUCT_HANDLE}.js`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((up) => {
              if (up?.variants?.[0]) {
                return fetch("/cart/add.js", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: up.variants[0].id, quantity: 1 }),
                });
              }
            })
            .then(() => {
              console.log("Upsell product added automatically!");
            })
            .catch(() => console.warn("Upsell add failed"));
        }
      });
  }

  // -------------------- Menu Toggle --------------------
  const menuBtn = document.querySelector(".gg-menu-toggle");
  menuBtn?.addEventListener("click", function () {
    this.classList.toggle("open");
    this.innerHTML = this.classList.contains("open") ? "✕" : "☰";
  });

  // -------------------- Helpers --------------------
  function escapeHtml(str) {
    return !str
      ? ""
      : String(str).replace(/[&<>"']/g, (m) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
        );
  }
  function textSlice(str, n) {
    if (!str) return "";
    const s = str.replace(/<[^>]*>/g, "");
    return s.length > n ? s.slice(0, n) + "…" : s;
  }
  function uniqueValuesForOption(product, index) {
    const key = "option" + (index + 1);
    const vals = new Set();
    product.variants.forEach((v) => vals.add(v[key]));
    return Array.from(vals);
  }
  function getVariantByOptions(product, selected) {
    return (
      product.variants.find((v) =>
        selected.every((val, idx) =>
          val == null ? true : v["option" + (idx + 1)] === val
        )
      ) || product.variants[0]
    );
  }

  // -------------------- Modal Open/Close --------------------
  function openModal() {
    if (!modal) return;
    modal.classList.remove("gg-is-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtn?.focus(), 0);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.add("gg-is-hidden");
    modal.setAttribute("aria-hidden", "true");
    if (modalBody) modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }
  closeBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (modal?.classList.contains("gg-is-hidden")) return;
    if (e.key === "Escape") closeModal();
  });

  // -------------------- Load Product into Modal --------------------
  function loadProduct(handle) {
    fetch(`/products/${handle}.js`)
      .then((res) => (res.ok ? res.json() : Promise.reject("fetch error")))
      .then((product) => renderProduct(product))
      .catch(() => alert("Could not load product. Try again."));
  }

  function renderProduct(product) {
    const optionNames = product.options || [];
    const optionValues = optionNames.map((_, idx) =>
      uniqueValuesForOption(product, idx)
    );
    const selected = optionNames.map(
      (_, i) => product.variants[0]["option" + (i + 1)] || null
    );

    const img = product.featured_image || product.images?.[0] || "";
    const priceNow = formatMoney(product.variants[0].price);

    modalBody.innerHTML = `
      <div class="modal-product">
        <div class="left">
          ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(product.title)}">` : ""}
        </div>
        <div class="right">
          <h2 class="gg-p-title">${escapeHtml(product.title)}</h2>
          <div class="gg-p-price" id="gg-price">${priceNow}</div>
          <div class="gg-p-desc">${escapeHtml(textSlice(product.description, 800))}</div>
          <div class="gg-variants">
            ${optionNames
              .map((name, idx) => {
                const vals = optionValues[idx];
                if (vals.length <= 6) {
                  return `<div class="gg-variant-row" data-idx="${idx}">
                    <div class="gg-variant-label">${escapeHtml(name)}</div>
                    <div class="gg-opts" data-option-index="${idx}">
                      ${vals
                        .map(
                          (v) => `<button class="gg-opt" type="button" data-idx="${idx}" data-value="${escapeHtml(v)}" aria-pressed="${v === selected[idx]}">${escapeHtml(v)}</button>`
                        )
                        .join("")}
                    </div>
                  </div>`;
                } else {
                  return `<div class="gg-variant-row" data-idx="${idx}">
                    <label class="gg-variant-label" for="gg-select-${idx}">${escapeHtml(name)}</label>
                    <select id="gg-select-${idx}" class="gg-select" data-idx="${idx}">
                      ${vals
                        .map(
                          (v) => `<option value="${escapeHtml(v)}" ${v === selected[idx] ? "selected" : ""}>${escapeHtml(v)}</option>`
                        )
                        .join("")}
                    </select>
                  </div>`;
                }
              })
              .join("")}
          </div>
          <div>
            <button class="add-to-cart gg-add" id="gg-add">ADD TO CART <span class="gg-add__arrow">→</span></button>
          </div>
          <div id="gg-add-msg" class="gg-msg" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;
    wireVariantUI(product, selected);
    openModal();
  }

  // -------------------- Variant Selection & Add --------------------
  function wireVariantUI(product, selected) {
    const priceEl = modalBody.querySelector("#gg-price");
    const addBtn = modalBody.querySelector("#gg-add");
    const msg = modalBody.querySelector("#gg-add-msg");

    function updatePriceUI() {
      const v = getVariantByOptions(product, selected);
      priceEl.textContent = formatMoney(v.price);
      addBtn.disabled = !v.available;
      addBtn.dataset.variantId = v.id;
    }
    updatePriceUI();

    modalBody.querySelectorAll(".gg-opt").forEach((btn) => {
      btn.addEventListener("click", function () {
        const idx = parseInt(this.dataset.idx, 10);
        selected[idx] = this.dataset.value;
        modalBody.querySelectorAll(`.gg-opt[data-idx="${idx}"]`).forEach((b) => b.setAttribute("aria-pressed", "false"));
        this.setAttribute("aria-pressed", "true");
        updatePriceUI();
      });
    });

    modalBody.querySelectorAll(".gg-select").forEach((sel) => {
      sel.addEventListener("change", function () {
        const idx = parseInt(this.dataset.idx, 10);
        selected[idx] = this.value;
        updatePriceUI();
      });
    });

    addBtn.addEventListener("click", function () {
      const variantId = Number(addBtn.dataset.variantId);
      if (!variantId) return;
      addBtn.disabled = true;
      msg.textContent = "Adding…";

      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantId, quantity: 1 }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject("Add failed")))
        .then(() => {
          msg.textContent = "Added to cart!";

          // Upsell rule inside modal flow
          const colorIdx = product.options.indexOf("Color");
          const sizeIdx = product.options.indexOf("Size");
          const selectedColor = colorIdx >= 0 ? selected[colorIdx] : "";
          const selectedSize = sizeIdx >= 0 ? selected[sizeIdx] : "";

          if (
            selectedColor?.toLowerCase() === "black" &&
            selectedSize?.toLowerCase() === "medium"
          ) {
            fetch(`/products/${UPSELL_PRODUCT_HANDLE}.js`)
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((up) => {
                if (up?.variants?.[0]) {
                  return fetch("/cart/add.js", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: up.variants[0].id, quantity: 1 }),
                  });
                }
              })
              .catch(() => console.warn("Upsell failed"));
          }
          setTimeout(closeModal, 900);
        })
        .catch(() => (msg.textContent = "Failed to add. Please try again."))
        .finally(() => {
          addBtn.disabled = false;
        });
    });
  }

  // -------------------- Attach to Cards --------------------
  $$(".gg-card[data-handle]").forEach((card) => {
    const open = () => loadProduct(card.dataset.handle);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
})();
