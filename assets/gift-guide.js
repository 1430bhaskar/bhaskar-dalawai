/* gift-guide.js
   - Modal product details + dynamic variants
   - Add to cart via AJAX
   - Special rule: if variant = Black + Medium → auto-add Soft Winter Jacket
   - Global listener also checks cart for upsell
   - Menu toggle (☰ ⇄ ✕)
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

  // -------------------- Format Money --------------------
  function formatMoney(cents) {
    if (cents == null) return "";
    const value = (cents / 100).toFixed(2);
    return moneyFormat.replace(/{{\s*amount\s*}}/, value);
  }

  // -------------------- Global Cart Listener --------------------
  document.body.addEventListener("click", (e) => {
    if (
      e.target.matches(
        'form[action*="/cart/add"] [type="submit"], .add-to-cart'
      )
    ) {
      setTimeout(checkAndAddUpsellFromCart, 500);
    }
  });

  function checkAndAddUpsellFromCart() {
    fetch("/cart.js")
      .then((res) => res.json())
      .then((cart) => {
        let hasTrigger = false;
        let hasUpsell = false;

        cart.items.forEach((item) => {
          const color =
            item.options_with_values.find((o) => o.name === "Color")?.value?.toLowerCase() || "";
          const size =
            item.options_with_values.find((o) => o.name === "Size")?.value?.toLowerCase() || "";

          if (color === "black" && size === "medium") hasTrigger = true;
          if (item.handle === UPSELL_PRODUCT_HANDLE) hasUpsell = true;
        });

        if (hasTrigger && !hasUpsell) {
          fetch(`/products/${UPSELL_PRODUCT_HANDLE}.js`)
            .then((r) => r.json())
            .then((up) => {
              if (up?.variants?.[0]) {
                return fetch("/cart/add.js", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: up.variants[0].id, quantity: 1 }),
                });
              }
            })
            .then(() =>
              console.log("Upsell Soft Winter Jacket added automatically!")
            )
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
    const match = product.variants.find((v) =>
      selected.every((val, idx) =>
        val == null ? true : v["option" + (idx + 1)] === val
      )
    );
    return match || product.variants[0];
  }

  // -------------------- Modal Controls --------------------
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
    if (!modal.classList.contains("gg-is-hidden") && e.key === "Escape") {
      closeModal();
    }
  });

  // -------------------- Load Product + Render --------------------
  function loadProduct(handle) {
    fetch(`/products/${handle}.js`)
      .then((r) => r.json())
      .then((product) => renderProduct(product))
      .catch((err) => {
        console.error(err);
        alert("Could not load product. Try again.");
      });
  }

  function renderProduct(product) {
    const optionNames = product.options || [];
    const optionValues = optionNames.map((_, i) =>
      uniqueValuesForOption(product, i)
    );
    const selected = optionNames.map(
      (_, i) => product.variants[0]["option" + (i + 1)] || null
    );

    const img =
      product.featured_image || (product.images && product.images[0]) || "";
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
                return vals.length <= 6
                  ? `<div class="gg-variant-row" data-idx="${idx}">
                      <div class="gg-variant-label">${escapeHtml(name)}</div>
                      <div class="gg-opts" data-option-index="${idx}">
                        ${vals
                          .map(
                            (v) =>
                              `<button class="gg-opt" type="button" data-idx="${idx}" data-value="${escapeHtml(
                                v
                              )}" aria-pressed="${v === selected[idx]}">${escapeHtml(v)}</button>`
                          )
                          .join("")}
                      </div>
                    </div>`
                  : `<div class="gg-variant-row" data-idx="${idx}">
                      <label class="gg-variant-label" for="gg-select-${idx}">${escapeHtml(name)}</label>
                      <select id="gg-select-${idx}" class="gg-select" data-idx="${idx}">
                        ${vals
                          .map(
                            (v) =>
                              `<option value="${escapeHtml(v)}" ${
                                v === selected[idx] ? "selected" : ""
                              }>${escapeHtml(v)}</option>`
                          )
                          .join("")}
                      </select>
                    </div>`;
              })
              .join("")}
          </div>

          <div>
            <button class="add-to-cart gg-add" id="gg-add">ADD TO CART →</button>
          </div>
          <div id="gg-add-msg" class="gg-msg" role="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    wireVariantUI(product, selected);
    openModal();
  }

  // -------------------- Variant Selection & Add --------------------
  function findActiveOptionDom(index) {
    const btn = modalBody.querySelector(
      `.gg-opts[data-option-index="${index}"] .gg-opt[aria-pressed="true"]`
    );
    if (btn) return btn.dataset.value;
    const sel = modalBody.querySelector(`.gg-select[data-idx="${index}"]`);
    return sel ? sel.value : null;
  }

  function wireVariantUI(product, selected) {
    const priceEl = modalBody.querySelector("#gg-price");
    const addBtn = modalBody.querySelector("#gg-add");
    const msg = modalBody.querySelector("#gg-add-msg");

    function updatePriceUI() {
      const variant = getVariantByOptions(product, selected);
      if (variant) {
        priceEl.textContent = formatMoney(variant.price);
        addBtn.dataset.variantId = variant.id;
      }
    }
    updatePriceUI();

    // Buttons
    modalBody.querySelectorAll(".gg-opt").forEach((btn) => {
      btn.addEventListener("click", function () {
        const idx = parseInt(this.dataset.idx, 10);
        selected[idx] = this.dataset.value;
        modalBody
          .querySelectorAll(`.gg-opt[data-idx="${idx}"]`)
          .forEach((b) => b.setAttribute("aria-pressed", "false"));
        this.setAttribute("aria-pressed", "true");
        updatePriceUI();
      });
    });

    // Selects
    modalBody.querySelectorAll(".gg-select").forEach((sel) => {
      sel.addEventListener("change", function () {
        const idx = parseInt(this.dataset.idx, 10);
        selected[idx] = this.value;
        updatePriceUI();
      });
    });

    // Add to Cart
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
        .then((r) => r.json())
        .then(() => {
          msg.textContent = "Added to cart!";

          // Upsell rule
          const colorIdx = (product.options || []).indexOf("Color");
          const sizeIdx = (product.options || []).indexOf("Size");
          const selectedColor =
            colorIdx >= 0
              ? selected[colorIdx] || findActiveOptionDom(colorIdx)
              : "";
          const selectedSize =
            sizeIdx >= 0
              ? selected[sizeIdx] || findActiveOptionDom(sizeIdx)
              : "";

          if (
            (selectedColor || "").toLowerCase() === "black" &&
            (selectedSize || "").toLowerCase() === "medium"
          ) {
            fetch(`/products/${UPSELL_PRODUCT_HANDLE}.js`)
              .then((r) => r.json())
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
