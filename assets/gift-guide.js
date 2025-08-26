document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("gift-guide-modal");
  const modalContent = modal.querySelector(".modal-product");
  const closeBtn = modal.querySelector(".gift-guide-modal__close");

  // Open modal on grid item click
  document.querySelectorAll(".gift-guide-grid__item").forEach(item => {
    item.addEventListener("click", () => {
      const handle = item.dataset.handle;
      fetch(`/products/${handle}.js`)
        .then(res => res.json())
        .then(product => {
          let variantsHtml = "";

          // Color options
          if (product.options.includes("Color")) {
            variantsHtml += `<div><strong>Color:</strong><br>`;
            product.options_with_values.find(o => o.name === "Color").values.forEach(v => {
              variantsHtml += `<button class="variant-btn" data-option="Color" data-value="${v}">${v}</button>`;
            });
            variantsHtml += `</div>`;
          }

          // Size dropdown
          if (product.options.includes("Size")) {
            variantsHtml += `<div><strong>Size:</strong>
              <select id="variant-size"><option>Choose your size</option>`;
            product.options_with_values.find(o => o.name === "Size").values.forEach(v => {
              variantsHtml += `<option value="${v}">${v}</option>`;
            });
            variantsHtml += `</select></div>`;
          }

          modalContent.innerHTML = `
            <img src="${product.featured_image}" alt="${product.title}" style="max-width:100%">
            <h2>${product.title}</h2>
            <p>${Shopify.formatMoney(product.price, window.money_format)}</p>
            <p>${product.description}</p>
            ${variantsHtml}
            <button id="add-to-cart">Add to Cart</button>
          `;

          modal.classList.remove("hidden");

          document.getElementById("add-to-cart").addEventListener("click", () => {
            const variantId = product.variants[0].id; // Simplified: pick first variant
            fetch("/cart/add.js", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: variantId, quantity: 1 })
            }).then(() => {
              alert("Added to cart!");
            });
          });
        });
    });
  });

  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
});
