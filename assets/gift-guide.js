/* gift-guide.js
   Complete, cleaned implementation:
   - modal product fetch + dynamic variants
   - add-to-cart via AJAX + live cart UI update
   - upsell: automatically add "Soft Winter Jacket" when Color=Black & Size=Medium
   - topbar menu toggle (uses aria-expanded so CSS can render X)
   - robust, no duplicated listeners
*/

(function () {
  "use strict";

  // Section / settings (grid stores moneyFormat + upsell handle)
  const GRID_SECTION = document.querySelector(".gift-guide-grid-section");
  const UPSELL_PRODUCT_HANDLE =
    (GRID_SECTION && GRID_SECTION.dataset.upsellHandle) || "soft-winter-jacket";
  const MONEY_FORMAT =
    (GRID_SECTION && GRID_SECTION.dataset.moneyFormat) || "{{amount}}";

  // Modal & topbar DOM
  const modal = document.getElementById("gg-modal");
  const modalBody = modal ? modal.querySelector(".gg-modal__body") : null;
  const modalClose = modal ? modal.querySelector(".gg-modal__close") : null;

  const menuBtn = document.querySelector(".gg-topbar__menu-btn");
  const topPanel = document.getElementById("gg-topbar-panel");

  /* ----------------------
     Utilities
     ---------------------- */
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function textSlice(str, n) {
    if (!str) return "";
    const s = String(str).replace(/<[^>]*>/g, "");
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function formatMoney(cents) {
    if (cents == null) return "";
    const num = Number(cents);
    // Shopify product JSON usually returns price in cents as integer or string.
    // We'll divide by 100 to get main currency unit and keep two decimals.
    const amount = (num / 100).toFixed(2);
    if (MONEY_FORMAT && MONEY_FORMAT.indexOf("{{") !== -1) {
      return MONEY_FORMAT.replace(/{{\s*amount(?:_no_decimals)?\s*}}/, amount);
    }
    return amount;
  }

  function uniqueValuesForOption(product, index) {
    const key = "option" + (index + 1);
    const set = new Set();
    (product.variants || []).forEach((v) => set.add(v[key]));
    return Array.from(set);
  }

  function findVariant(product, selected) {
    const variants = product.variants || [];
    const found = variants.find((v) => {
      for (let i = 0; i < selected.length; i++) {
        const sel = selected[i];
        if (sel == null) continue;
        if (v["option" + (i + 1)] !== sel) return false;
      }
      return true;
    });
    return found || variants[0] || null;
  }

  /* ----------------------
     Topbar menu toggle (aria-expanded) — JS only toggles attr + panel visibility
     CSS (provided below) will swap the icon using [aria-expanded="true"]
     ---------------------- */
  if (menuBtn && topPanel) {
    menuBtn.addEventListener("click", (e) => {
      const isOpen = menuBtn.getAttribute("aria-expanded") === "true";
      const willOpen = !isOpen;
      menuBtn.setAttribute("aria-expanded", String(willOpen));
      // show / hide panel
      if (willOpen) {
        topPanel.removeAttribute("hidden");
        // Make panel sticky on open so it's accessible even when scrolling.
        topPanel.style.position = "sticky";
        topPanel.style.top = "0";
        topPanel.style.zIndex = "45";
      } else {
        topPanel.setAttribute("hidden", "");
        topPanel.style.position = "";
        topPanel.style.top = "";
        topPanel.style.zIndex = "";
      }
    });
  }

  /* ----------------------
     Modal open/close helpers
     ---------------------- */
  function openModal() {
    if (!modal) return;
    modal.classList.remove("gg-is-hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const focusable = modal.querySelector(".gg-modal__close");
      if (focusable) focusable.focus();
    }, 10);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("gg-is-hidden");
    modal.setAttribute("aria-hidden", "true");
    if (modalBody) modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  // Close bindings
  modalClose && modalClose.addEventListener("click", closeModal);
  modal && modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });
  document.addEventListener("keydown", (ev) => {
    if (!modal) return;
    if (!modal.classList.contains("gg-is-hidden") && ev.key === "Escape") closeModal();
  });

  /* ----------------------
     Load product JSON and render modal
     ---------------------- */
  async function loadProduct(handle) {
    if (!handle) return;
    try {
      const res = await fetch(`/products/${handle}.js`);
      if (!res.ok) throw new Error("Product fetch failed");
      const product = await res.json();
      renderProduct(product);
    } catch (err) {
      console.error("loadProduct:", err);
      alert("Could not load product. Try again.");
    }
  }

  function renderProduct(product) {
    if (!modalBody) return;

    const optionNames = product.options || [];
    const optionValues = optionNames.map((_, idx) => uniqueValuesForOption(product, idx));
    // default selected values = first variant's options (if available)
    const selected = optionNames.map((_, i) => product.variants?.[0]?.["option" + (i + 1)] || null);

    const img = product.featured_image || (product.images && product.images[0]) || "";
    const priceNow = product.variants?.[0] ? formatMoney(product.variants[0].price) : "";

    // Render variants: Size => dropdown; long lists (>6) => dropdown; else buttons
    const variantsHtml = optionNames.map((name, idx) => {
      const vals = optionValues[idx] || [];
      // choose select for Size or large lists
      const useSelect = name.toLowerCase() === "size" || vals.length > 6;
      if (useSelect) {
        return `
          <div class="gg-variant-row" data-idx="${idx}">
            <label class="gg-variant-label" for="gg-select-${idx}">${escapeHtml(name)}</label>
            <select id="gg-select-${idx}" class="gg-select" data-idx="${idx}">
              ${vals.map(v => `<option value="${escapeHtml(v)}" ${v === selected[idx] ? "selected" : ""}>${escapeHtml(v)}</option>`).join("")}
            </select>
          </div>
        `;
      } else {
        return `
          <div class="gg-variant-row" data-idx="${idx}">
            <div class="gg-variant-label">${escapeHtml(name)}</div>
            <div class="gg-opts" data-option-index="${idx}">
              ${vals.map(v => `<button class="gg-opt" type="button" data-idx="${idx}" data-value="${escapeHtml(v)}" aria-pressed="${v === selected[idx] ? "true" : "false"}">${escapeHtml(v)}</button>`).join("")}
            </div>
          </div>
        `;
      }
    }).join("");

    modalBody.innerHTML = `
      <div class="modal-product">
        <div class="left">
          ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(product.title)}">` : ""}
        </div>
        <div class="right">
          <h2 class="gg-p-title">${escapeHtml(product.title)}</h2>
          <div class="gg-p-price" id="gg-price">${priceNow}</div>
          <div class="gg-p-desc">${escapeHtml(textSlice(product.description || "", 800))}</div>

          <div class="gg-variants">
            ${variantsHtml}
          </div>

          <div>
            <button class="add-to-cart gg-add" id="gg-add">ADD TO CART →</button>
          </div>
          <div id="gg-add-msg" class="gg-msg" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    // Wire variant UI + add-to-cart for this product instance
    wireVariantUI(product, selected);
    openModal();
  }

  function findActiveOptionDom(index) {
    if (!modalBody) return null;
    const btn = modalBody.querySelector(`.gg-opts[data-option-index="${index}"] .gg-opt[aria-pressed="true"]`);
    if (btn) return btn.dataset.value;
    const sel = modalBody.querySelector(`.gg-select[data-idx="${index}"]`);
    return sel ? sel.value : null;
  }

  function wireVariantUI(product, selected) {
    if (!modalBody) return;
    const priceEl = modalBody.querySelector("#gg-price");
    const addBtn = modalBody.querySelector("#gg-add");
    const msgEl = modalBody.querySelector("#gg-add-msg");

    // update price / variant id
    function updatePriceUI() {
      const v = findVariant(product, selected);
      if (!v) return;
      priceEl.textContent = formatMoney(v.price);
      addBtn.dataset.variantId = v.id;
      addBtn.disabled = !v.available;
    }
    updatePriceUI();

    // option buttons
    modalBody.querySelectorAll(".gg-opt").forEach((b) => {
      b.addEventListener("click", function () {
        const idx = Number(this.dataset.idx);
        selected[idx] = this.dataset.value;
        modalBody.querySelectorAll(`.gg-opt[data-idx="${idx}"]`).forEach(x => x.setAttribute("aria-pressed", "false"));
        this.setAttribute("aria-pressed", "true");
        updatePriceUI();
      });
    });

    // selects
    modalBody.querySelectorAll(".gg-select").forEach((sel) => {
      sel.addEventListener("change", function () {
        const idx = Number(this.dataset.idx);
        selected[idx] = this.value;
        updatePriceUI();
      });
    });

    // add to cart click
    addBtn.addEventListener("click", async function () {
      const variantId = Number(this.dataset.variantId);
      if (!variantId) return;
      this.disabled = true;
      msgEl.textContent = "Adding…";

      try {
        // Add main variant
        const addRes = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: variantId, quantity: 1 })
        });
        if (!addRes.ok) throw new Error("Add failed");

        // Update cart UI immediately (no reload)
        await updateCartUI();

        msgEl.textContent = "Added to cart!";

        // Upsell check (Color & Size)
        const colorIdx = (product.options || []).indexOf("Color");
        const sizeIdx = (product.options || []).indexOf("Size");
        const selectedColor = colorIdx >= 0 ? (selected[colorIdx] || findActiveOptionDom(colorIdx) || "") : "";
        const selectedSize = sizeIdx >= 0 ? (selected[sizeIdx] || findActiveOptionDom(sizeIdx) || "") : "";

        if (selectedColor.toString().toLowerCase() === "black" && selectedSize.toString().toLowerCase() === "medium") {
          await addUpsellIfMissing(UPSELL_PRODUCT_HANDLE);
        }

        setTimeout(closeModal, 900);
      } catch (err) {
        console.error("Add to cart error:", err);
        msgEl.textContent = "Failed to add. Please try again.";
      } finally {
        this.disabled = false;
      }
    });
  }

  /* ----------------------
     Upsell helpers + cart check
     ---------------------- */
  async function addUpsellIfMissing(handle) {
    try {
      // Check cart if upsell already exists
      const cartRes = await fetch("/cart.js");
      const cart = await cartRes.json();
      const hasUpsell = cart.items.some((it) => it.handle === handle);
      if (hasUpsell) return;

      // Fetch upsell product JSON and add first variant
      const upRes = await fetch(`/products/${handle}.js`);
      if (!upRes.ok) throw new Error("Upsell product fetch failed");
      const up = await upRes.json();
      const upVariantId = up?.variants?.[0]?.id;
      if (!upVariantId) return;

      const addRes = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: upVariantId, quantity: 1 })
      });

      if (addRes.ok) {
        await updateCartUI();
        console.log("Upsell added:", handle);
      } else {
        console.warn("Upsell add returned non-ok");
      }
    } catch (e) {
      console.warn("addUpsellIfMissing error", e);
    }
  }

  // If the customer uses any other add-to-cart form/button (outside modal), re-check cart for upsell
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.matches('form[action*="/cart/add"] [type="submit"], .add-to-cart, .product-form__submit')) {
      // wait a short time to allow the shop's JS to post; then verify cart
      setTimeout(checkAndAddUpsellFromCart, 700);
    }
  });

  async function checkAndAddUpsellFromCart() {
    try {
      const cartRes = await fetch("/cart.js");
      const cart = await cartRes.json();
      let triggerFound = false;
      cart.items.forEach((it) => {
        const color = (it.options_with_values || []).find(o => o.name === "Color")?.value?.toLowerCase() || "";
        const size = (it.options_with_values || []).find(o => o.name === "Size")?.value?.toLowerCase() || "";
        if (color === "black" && size === "medium") triggerFound = true;
      });
      const hasUpsell = cart.items.some((it) => it.handle === UPSELL_PRODUCT_HANDLE);
      if (triggerFound && !hasUpsell) await addUpsellIfMissing(UPSELL_PRODUCT_HANDLE);
    } catch (e) {
      console.warn("checkAndAddUpsellFromCart error", e);
    }
  }

  /* ----------------------
     Cart UI update helper — update counts and simple mini-cart containers
     ---------------------- */
  async function updateCartUI() {
    try {
      const res = await fetch("/cart.js");
      if (!res.ok) return;
      const cart = await res.json();

      // common selectors for count
      const countSelectors = [".cart-count", ".cart__count", "#CartCount", ".minicart-count"];
      countSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.textContent = cart.item_count || 0;
        });
      });

      // Update basic mini-cart container(s) if present
      const miniSelectors = [".mini-cart-items", ".mini-cart", ".cart-drawer__items", ".cart-items"];
      miniSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(container => {
          container.innerHTML = cart.items.map(it => {
            return `<div class="mini-item">
                      <div class="mini-item__title">${escapeHtml(it.title)}</div>
                      <div class="mini-item__qty">Qty: ${it.quantity}</div>
                      <div class="mini-item__price">${formatMoney(it.line_price)}</div>
                    </div>`;
          }).join("");
        });
      });
    } catch (e) {
      console.error("updateCartUI error", e);
    }
  }

  /* ----------------------
     Attach quick-view triggers (grid cards)
     ---------------------- */
  document.querySelectorAll(".gg-card[data-handle]").forEach((card) => {
    const handle = card.dataset.handle;
    card.addEventListener("click", () => loadProduct(handle));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        loadProduct(handle);
      }
    });
  });

  // On load, optionally refresh cart count into UI
  updateCartUI().catch(() => {});
})();
