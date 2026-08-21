'use strict';

/* ==========================================================
   K SPORT — script.js
   Security notes:
   - No eval(), no innerHTML for any user-supplied data.
   - All dynamic text uses textContent.
   - Cart persistence in localStorage stores only product refs,
     quantities and sizes — never personal or payment data.
   - Checkout form data is only used to build a WhatsApp message;
     nothing is sent to any first-party server or stored beyond
     the current session's cart.
   ========================================================== */

(function () {
  const WHATSAPP_NUMBER = '573165524018';

  /* ---------------- Product catalog (static, trusted data) ---------------- */
  const PRODUCTS = [
    { id: 'ks-001', name: 'Air Flow Rosa', cat: ['mujer', 'nuevo'], price: 189900, oldPrice: 239900, sizes: [35,36,37,38,39], color: ['#FF2D87', '#E10F35'] },
    { id: 'ks-002', name: 'Urban Blaze Negro', cat: ['hombre', 'vendido'], price: 219900, oldPrice: null, sizes: [38,39,40,41,42,43], color: ['#1a1a1e', '#E10F35'] },
    { id: 'ks-003', name: 'K Runner Fucsia', cat: ['unisex', 'nuevo'], price: 199900, oldPrice: null, sizes: [36,37,38,39,40,41], color: ['#FF2D87', '#ffffff'] },
    { id: 'ks-004', name: 'Street Flow Blanco', cat: ['unisex', 'oferta'], price: 159900, oldPrice: 209900, sizes: [37,38,39,40,41], color: ['#ffffff', '#E10F35'] },
    { id: 'ks-005', name: 'Combat Grip Gris', cat: ['hombre'], price: 229900, oldPrice: null, sizes: [40,41,42,43,44], color: ['#3a3a42', '#FF2D87'] },
    { id: 'ks-006', name: 'Diamond Sport Rosa', cat: ['mujer', 'vendido'], price: 209900, oldPrice: 249900, sizes: [35,36,37,38], color: ['#FF2D87', '#0A0A0C'] },
    { id: 'ks-007', name: 'Flow Attitude Rojo', cat: ['hombre', 'nuevo'], price: 239900, oldPrice: null, sizes: [39,40,41,42,43], color: ['#E10F35', '#0A0A0C'] },
    { id: 'ks-008', name: 'City Step Unisex', cat: ['unisex'], price: 179900, oldPrice: null, sizes: [36,37,38,39,40,41,42], color: ['#0A0A0C', '#FF2D87'] },
    { id: 'ks-009', name: 'Night Runner Negro', cat: ['hombre', 'oferta'], price: 189900, oldPrice: 229900, sizes: [40,41,42,43], color: ['#0A0A0C', '#E10F35'] },
    { id: 'ks-010', name: 'Bloom Sneaker Blanco', cat: ['mujer', 'nuevo'], price: 199900, oldPrice: null, sizes: [35,36,37,38,39], color: ['#ffffff', '#FF2D87'] },
    { id: 'ks-011', name: 'K Sport Classic', cat: ['unisex', 'vendido'], price: 169900, oldPrice: null, sizes: [36,37,38,39,40,41], color: ['#17171b', '#ffffff'] },
    { id: 'ks-012', name: 'Sunset Flow Fucsia', cat: ['mujer', 'oferta'], price: 174900, oldPrice: 219900, sizes: [35,36,37,38,39], color: ['#FF2D87', '#E10F35'] }
  ];

  const currencyFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  function shoeSVG(colorA, colorB, uid) {
    // Purely generated from trusted internal color values — safe to build as a string.
    return `<svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sneaker">
      <defs>
        <linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colorA}"/>
          <stop offset="100%" stop-color="${colorB}"/>
        </linearGradient>
      </defs>
      <path d="M15 135 C 30 110, 55 90, 90 82 C 112 78, 124 68, 138 56 C 152 45, 170 42, 182 49 C 189 54, 186 63, 193 70 C 210 66, 238 70, 258 88 C 272 102, 279 120, 279 135 L 279 150 C 279 157, 272 161, 264 161 L 34 161 C 23 161, 14 154, 15 140 Z" fill="url(#g${uid})"/>
      <path d="M90 82 C 112 78, 124 68, 138 56 C 152 45, 170 42, 182 49" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <path d="M45 128 L 255 128" stroke="#000" stroke-width="7" stroke-linecap="round" opacity=".2"/>
      <path d="M34 161 C 34 171, 45 178, 68 178 L 248 178 C 266 178, 279 171, 279 159 L 279 150 L 34 150 Z" fill="#0A0A0C"/>
    </svg>`;
  }

  /* ---------------- State ---------------- */
  let activeFilter = 'todos';
  let searchTerm = '';
  const selectedSizes = {}; // productId -> size
  let cart = loadCart();

  /* ---------------- Cart persistence (non-sensitive only) ---------------- */
  function loadCart() {
    try {
      const raw = window.localStorage.getItem('ksport_cart');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Validate shape defensively — never trust stored data blindly.
      return parsed.filter(it =>
        it && typeof it.id === 'string' &&
        PRODUCTS.some(p => p.id === it.id) &&
        Number.isInteger(it.qty) && it.qty > 0 && it.qty <= 20 &&
        Number.isInteger(it.size)
      );
    } catch (e) {
      return [];
    }
  }
  function saveCart() {
    try {
      window.localStorage.setItem('ksport_cart', JSON.stringify(cart));
    } catch (e) { /* storage unavailable — cart stays in-memory only */ }
  }

  /* ---------------- Rendering: catalog ---------------- */
  const grid = document.getElementById('productGrid');
  const noResults = document.getElementById('noResults');

  function matchesFilter(p) {
    if (activeFilter === 'todos') return true;
    return p.cat.includes(activeFilter);
  }
  function matchesSearch(p) {
    if (!searchTerm) return true;
    return p.name.toLowerCase().includes(searchTerm);
  }

  function renderGrid() {
    const list = PRODUCTS.filter(p => matchesFilter(p) && matchesSearch(p));
    grid.textContent = '';

    if (list.length === 0) {
      noResults.hidden = false;
    } else {
      noResults.hidden = true;
    }

    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.dataset.id = p.id;

      const media = document.createElement('div');
      media.className = 'card-media';
      media.innerHTML = shoeSVG(p.color[0], p.color[1], p.id); // trusted internal SVG only

      if (p.cat.includes('nuevo')) {
        const b = document.createElement('span'); b.className = 'badge nuevo'; b.textContent = 'Nuevo'; media.appendChild(b);
      } else if (p.cat.includes('vendido')) {
        const b = document.createElement('span'); b.className = 'badge vendido'; b.textContent = 'Más vendido'; media.appendChild(b);
      }
      if (p.oldPrice) {
        const discount = Math.round(100 - (p.price / p.oldPrice) * 100);
        const b = document.createElement('span'); b.className = 'badge oferta'; b.textContent = `-${discount}%`; media.appendChild(b);
      }

      const body = document.createElement('div');
      body.className = 'card-body';

      const name = document.createElement('p'); name.className = 'card-name'; name.textContent = p.name;
      const catLine = document.createElement('p'); catLine.className = 'card-cat'; catLine.textContent = p.cat.filter(c => ['hombre','mujer','unisex'].includes(c)).join(' · ') || 'Unisex';

      const priceRow = document.createElement('div'); priceRow.className = 'card-price-row';
      const now = document.createElement('span'); now.className = 'price-now'; now.textContent = currencyFmt.format(p.price);
      priceRow.appendChild(now);
      if (p.oldPrice) {
        const old = document.createElement('span'); old.className = 'price-old'; old.textContent = currencyFmt.format(p.oldPrice);
        priceRow.appendChild(old);
      }

      const sizeRow = document.createElement('div'); sizeRow.className = 'size-row';
      p.sizes.forEach(sz => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'size-chip';
        chip.textContent = String(sz);
        chip.setAttribute('aria-label', `Talla ${sz}`);
        if (selectedSizes[p.id] === sz) chip.classList.add('selected');
        chip.addEventListener('click', () => {
          selectedSizes[p.id] = sz;
          sizeRow.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
        });
        sizeRow.appendChild(chip);
      });

      const actions = document.createElement('div'); actions.className = 'card-actions';
      const addBtn = document.createElement('button');
      addBtn.type = 'button'; addBtn.className = 'btn btn-primary';
      addBtn.textContent = '🛒 Agregar';
      addBtn.addEventListener('click', () => addToCart(p.id));

      const waBtn = document.createElement('a');
      waBtn.className = 'btn btn-outline';
      waBtn.target = '_blank'; waBtn.rel = 'noopener noreferrer';
      waBtn.textContent = '📲 WhatsApp';
      waBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const size = selectedSizes[p.id];
        const sizeTxt = size ? `Talla ${size}` : 'talla por confirmar';
        const msg = `Hola K SPORT 🔥, estoy interesado(a) en el modelo "${p.name}" (${sizeTxt}). ¿Me confirman disponibilidad y precio?`;
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      });

      actions.appendChild(addBtn); actions.appendChild(waBtn);

      body.appendChild(name); body.appendChild(catLine); body.appendChild(priceRow); body.appendChild(sizeRow); body.appendChild(actions);
      card.appendChild(media); card.appendChild(body);
      grid.appendChild(card);
      cardObserver.observe(card);
    });
  }

  /* ---------------- Filters ---------------- */
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderGrid();
    });
  });

  /* ---------------- Search (safe: text-only matching, no HTML execution) ---------------- */
  const searchToggle = document.getElementById('searchToggle');
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');

  searchToggle.addEventListener('click', () => {
    const isOpen = searchBar.classList.toggle('open');
    searchToggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) searchInput.focus();
  });

  searchInput.addEventListener('input', () => {
    // Never rendered as HTML — only used for case-insensitive substring compare.
    searchTerm = searchInput.value.slice(0, 60).toLowerCase();
    renderGrid();
  });

  /* ---------------- Cart logic ---------------- */
  const cartToggle = document.getElementById('cartToggle');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartClose = document.getElementById('cartClose');
  const cartBody = document.getElementById('cartBody');
  const cartCount = document.getElementById('cartCount');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const overlay = document.getElementById('overlay');
  const clearCartBtn = document.getElementById('clearCart');
  const checkoutBtn = document.getElementById('checkoutBtn');

  function addToCart(productId) {
    const size = selectedSizes[productId];
    if (!size) {
      showToast('Selecciona una talla primero');
      return;
    }
    const existing = cart.find(it => it.id === productId && it.size === size);
    if (existing) {
      existing.qty = Math.min(existing.qty + 1, 20);
    } else {
      cart.push({ id: productId, size, qty: 1 });
    }
    saveCart();
    renderCart();
    openCart();
    showToast('Agregado al carrito 🔥');
  }

  function changeQty(productId, size, delta) {
    const item = cart.find(it => it.id === productId && it.size === size);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(it => !(it.id === productId && it.size === size));
    }
    saveCart();
    renderCart();
  }

  function removeItem(productId, size) {
    cart = cart.filter(it => !(it.id === productId && it.size === size));
    saveCart();
    renderCart();
  }

  function cartTotal() {
    return cart.reduce((sum, it) => {
      const p = PRODUCTS.find(pr => pr.id === it.id);
      return p ? sum + p.price * it.qty : sum;
    }, 0);
  }

  function renderCart() {
    cartBody.textContent = '';
    const totalQty = cart.reduce((s, it) => s + it.qty, 0);
    cartCount.textContent = String(totalQty);

    if (cart.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cart-empty';
      empty.textContent = 'Tu carrito está vacío. ¡Agrega tus sneakers favoritos!';
      cartBody.appendChild(empty);
    } else {
      cart.forEach(it => {
        const p = PRODUCTS.find(pr => pr.id === it.id);
        if (!p) return;
        const row = document.createElement('div');
        row.className = 'cart-item';

        const media = document.createElement('div'); media.className = 'cart-item-media';
        media.innerHTML = shoeSVG(p.color[0], p.color[1], `mini-${p.id}-${it.size}`);

        const info = document.createElement('div'); info.className = 'cart-item-info';
        const name = document.createElement('p'); name.className = 'cart-item-name'; name.textContent = p.name;
        const meta = document.createElement('p'); meta.className = 'cart-item-meta'; meta.textContent = `Talla ${it.size}`;

        const qtyRow = document.createElement('div'); qtyRow.className = 'qty-row';
        const minus = document.createElement('button'); minus.type='button'; minus.className='qty-btn'; minus.textContent='−'; minus.setAttribute('aria-label','Disminuir cantidad');
        minus.addEventListener('click', () => changeQty(p.id, it.size, -1));
        const qtyVal = document.createElement('span'); qtyVal.className='qty-val'; qtyVal.textContent = String(it.qty);
        const plus = document.createElement('button'); plus.type='button'; plus.className='qty-btn'; plus.textContent='+'; plus.setAttribute('aria-label','Aumentar cantidad');
        plus.addEventListener('click', () => changeQty(p.id, it.size, 1));
        const remove = document.createElement('button'); remove.type='button'; remove.className='remove-item'; remove.textContent='Eliminar';
        remove.addEventListener('click', () => removeItem(p.id, it.size));
        const price = document.createElement('span'); price.className='item-price'; price.textContent = currencyFmt.format(p.price * it.qty);

        qtyRow.appendChild(minus); qtyRow.appendChild(qtyVal); qtyRow.appendChild(plus); qtyRow.appendChild(remove); qtyRow.appendChild(price);
        info.appendChild(name); info.appendChild(meta); info.appendChild(qtyRow);
        row.appendChild(media); row.appendChild(info);
        cartBody.appendChild(row);
      });
    }
    cartSubtotal.textContent = currencyFmt.format(cartTotal());
  }

  function openCart() {
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    cartToggle.setAttribute('aria-expanded', 'true');
  }
  function closeCart() {
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('open');
    cartToggle.setAttribute('aria-expanded', 'false');
    if (!checkoutModal.classList.contains('open')) overlay.classList.remove('open');
  }

  cartToggle.addEventListener('click', () => {
    cartDrawer.classList.contains('open') ? closeCart() : openCart();
  });
  cartClose.addEventListener('click', closeCart);
  overlay.addEventListener('click', () => { closeCart(); closeCheckout(); });

  clearCartBtn.addEventListener('click', () => {
    cart = [];
    saveCart();
    renderCart();
    showToast('Carrito vaciado');
  });

  /* ---------------- Checkout modal + form validation ---------------- */
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutClose = document.getElementById('checkoutClose');
  const checkoutForm = document.getElementById('checkoutForm');

  checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
      showToast('Tu carrito está vacío');
      return;
    }
    openCheckout();
  });

  function openCheckout() {
    checkoutModal.classList.add('open');
    checkoutModal.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');
    document.getElementById('fullName').focus();
  }
  function closeCheckout() {
    checkoutModal.classList.remove('open');
    checkoutModal.setAttribute('aria-hidden', 'true');
    if (!cartDrawer.classList.contains('open')) overlay.classList.remove('open');
  }
  checkoutClose.addEventListener('click', closeCheckout);

  const FIELD_RULES = {
    fullName: { required: true, min: 3, max: 80, pattern: /^[A-Za-zÀ-ÿ\s]{3,80}$/, label: 'nombre' },
    phone: { required: true, min: 7, max: 15, pattern: /^[0-9+\s]{7,15}$/, label: 'teléfono' },
    city: { required: true, min: 2, max: 60, label: 'ciudad' },
    address: { required: true, min: 4, max: 120, label: 'dirección' },
    paymentMethod: { required: true, label: 'método de pago' }
  };

  function validateField(id) {
    const rule = FIELD_RULES[id];
    if (!rule) return true;
    const el = document.getElementById(id);
    const errEl = document.getElementById(`err-${id}`);
    const val = el.value.trim();

    let message = '';
    if (rule.required && val.length === 0) {
      message = `Por favor ingresa tu ${rule.label}.`;
    } else if (rule.min && val.length < rule.min) {
      message = `El ${rule.label} es muy corto.`;
    } else if (rule.max && val.length > rule.max) {
      message = `El ${rule.label} es muy largo.`;
    } else if (rule.pattern && !rule.pattern.test(val)) {
      message = `Revisa el formato de tu ${rule.label}.`;
    }

    if (errEl) errEl.textContent = message;
    return message === '';
  }

  Object.keys(FIELD_RULES).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => validateField(id));
  });

  // Basic text sanitizer: strips angle brackets so nothing resembling markup
  // ever reaches the WhatsApp message text. Data is always treated as plain text.
  function sanitize(str, maxLen) {
    return String(str).replace(/[<>]/g, '').trim().slice(0, maxLen);
  }

  checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Honeypot: if filled, silently drop (likely a bot) without revealing why.
    const honeypot = document.getElementById('website').value;
    if (honeypot) {
      showToast('No pudimos procesar tu pedido. Intenta de nuevo.');
      return;
    }

    let valid = true;
    Object.keys(FIELD_RULES).forEach(id => { if (!validateField(id)) valid = false; });
    if (!valid) {
      showToast('Revisa los campos marcados en rojo');
      return;
    }

    const fullName = sanitize(document.getElementById('fullName').value, 80);
    const phone = sanitize(document.getElementById('phone').value, 15);
    const city = sanitize(document.getElementById('city').value, 60);
    const address = sanitize(document.getElementById('address').value, 120);
    const neighborhood = sanitize(document.getElementById('neighborhood').value, 80);
    const reference = sanitize(document.getElementById('reference').value, 120);
    const paymentMethod = sanitize(document.getElementById('paymentMethod').value, 30);
    const notes = sanitize(document.getElementById('notes').value, 300);

    const lines = [
      `🔥 Nuevo pedido — K SPORT`,
      ``,
      `Nombre: ${fullName}`,
      `WhatsApp: ${phone}`,
      `Ciudad: ${city}`,
      `Dirección: ${address}`,
      neighborhood ? `Barrio: ${neighborhood}` : null,
      reference ? `Referencia: ${reference}` : null,
      `Método de pago: ${paymentMethod}`,
      notes ? `Observaciones: ${notes}` : null,
      ``,
      `Productos:`
    ].filter(Boolean);

    cart.forEach(it => {
      const p = PRODUCTS.find(pr => pr.id === it.id);
      if (p) lines.push(`• ${p.name} — Talla ${it.size} — Cant. ${it.qty} — ${currencyFmt.format(p.price * it.qty)}`);
    });
    lines.push(``, `Total: ${currencyFmt.format(cartTotal())}`);

    const message = lines.join('\n');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');

    closeCheckout();
    closeCart();
    showToast('Pedido enviado por WhatsApp 🔥');
  });

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function showToast(text) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    document.getElementById('liveRegion').textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  /* ---------------- Navbar: scroll + mobile menu ---------------- */
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }));

  document.getElementById('scrollCue').addEventListener('click', () => {
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------------- Reveal-on-scroll ---------------- */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => {
    if (reduceMotion) { el.classList.add('in-view'); } else { revealObserver.observe(el); }
  });

  /* ---------------- Animated counters ---------------- */
  const statEls = document.querySelectorAll('.stat-num');
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      statsObserver.unobserve(entry.target);
      const target = parseInt(entry.target.dataset.count, 10) || 0;
      if (reduceMotion) { entry.target.textContent = String(target); return; }
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        entry.target.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  statEls.forEach(el => statsObserver.observe(el));

  /* ---------------- Init ---------------- */
  document.getElementById('year').textContent = String(new Date().getFullYear());
  renderGrid();
  renderCart();

  // Keyboard: close drawers/modal with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCart(); closeCheckout(); }
  });
})();