document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("product-modal");
  const closeBtn = modal.querySelector(".close-btn");
  const modalBody = modal.querySelector(".modal-body");
  const addBtns = document.querySelectorAll(".add-to-cart-btn");
  const menuBtn = document.querySelector(".gg-menu-toggle");
  const mobileMenu = document.querySelector(".gg-mobile-menu");

  const UPSELL_PRODUCT_HANDLE = "soft-winter-jacket"; // replace if different

  // =============================
  // MENU TOGGLE (Hamburger <-> X)
  // =============================
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      this.classList.toggle("open");
      mobileMenu.classList.toggle("open");
    });
  }

  // =============================
  // CLOSE MODAL
  // =============================
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }
  window.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });

  function closeModal() {
    modal.style.display = "none";
    modalBody.innerHTML = "";
  }

  // =============================
  // RENDER MODAL CONTENT
  // =============================
  function renderModal(product) {
    const variants = product.variants;
    const options = product.options;
    let selected = {};

    // Options HTML
    const optionHTML = options
      .map(
        (opt, i) => `
      <div class="option-group" data-index="${i}">
        <h4>${opt.name}</h4>
        ${opt.values
          .map(
            (val) => `
          <button type="button" class="option-btn" data-value="${val}">
            ${val}
          </button>`
          )
          .join("")}
      </div>`
      )
      .join("");

    modalBody.innerHTML = `
      <h2>${product.title}</h2>
      <img src="${product.images[0]}" alt="${product.title}" />
      ${optionHTML}
      <button type="button" class="confirm-add">Add to Cart</button>
      <p class="add-msg"></p>
    `;
    modal.style.display = "block";

    // Event listeners for selecting options
    const optionBtns = modalBody.querySelectorAll(".option-btn");
    optionBtns.forEach((btn) =>
      btn.addEventListener("click", function () {
        const group = this.closest(".option-group");
        const index = group.dataset.index;
        selected[index] = this.dataset.value;

        // Highlight active
        group.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
      })
    );

    // Confirm Add
    const addBtn = modalBody.querySelector(".confirm-add");
    addBtn.addEventListener("click", function () {
      const msg = modalBody.querySelector(".add-msg");

      // Match variant
      const variant = variants.find((v) =>
        v.options.every((opt, i) => !selected[i] || selected[i] === opt)
      );

      if (!variant) {
        msg.textContent = "Please select valid options.";
        return;
      }

      addBtn.disabled = true;

      // Add main product
      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variant.id, quantity: 1 }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("Add failed");
          return r.json();
        })
        .then(() => fetch("/cart.js")) // confirm in cart
        .then((r) => r.json())
        .then((cart) => {
          const exists = cart.items.some((i) => i.variant_id === variant.id);
          msg.textContent = exists ? "Added to cart!" : "Failed to add. Try again.";

          // ============= UPSSELL CHECK =============
          const optionNames = product.options.map((o) => o.name || o);
          const colorIdx = optionNames.indexOf("Color");
          const sizeIdx = optionNames.indexOf("Size");

          const selectedColor = colorIdx >= 0 ? selected[colorIdx] : "";
          const selectedSize = sizeIdx >= 0 ? selected[sizeIdx] : "";

          if (
            (selectedColor || "").toLowerCase() === "black" &&
            (selectedSize || "").toLowerCase() === "medium"
          ) {
            fetch(`/products/${UPSELL_PRODUCT_HANDLE}.js`)
              .then((r) => (r.ok ? r.json() : Promise.reject("Upsell fetch failed")))
              .then((up) => {
                if (up?.variants?.[0]) {
                  return fetch("/cart/add.js", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: up.variants[0].id, quantity: 1 }),
                  });
                }
              })
              .catch((err) => console.warn("Upsell failed", err));
          }

          setTimeout(closeModal, 1000);
        })
        .catch((err) => {
          console.error(err);
          msg.textContent = "Failed to add. Please try again.";
        })
        .finally(() => {
          addBtn.disabled = false;
        });
    });
  }

  // =============================
  // ATTACH TO PRODUCT CARDS
  // =============================
  addBtns.forEach((btn) =>
    btn.addEventListener("click", function () {
      const handle = this.dataset.handle;
      fetch(`/products/${handle}.js`)
        .then((r) => (r.ok ? r.json() : Promise.reject("Product not found")))
        .then((product) => renderModal(product))
        .catch((err) => console.error(err));
    })
  );
});
