document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');

    function updateToggleText() {
        if (!themeToggle) {
            return;
        }
        const isDark = document.documentElement.classList.contains('dark');
        themeToggle.textContent = isDark ? 'Tema Claro' : 'Cambiar Tema';
    }

    function triggerTitleUnderline() {
        const title = document.querySelector('.store-title');
        if (!title) {
            return;
        }
        title.classList.remove('title-animate');
        void title.offsetWidth;
        title.classList.add('title-animate');
    }

    updateToggleText();
    triggerTitleUnderline();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateToggleText();
            triggerTitleUnderline();
        });
    }

    const CART_KEY = 'pc_cart_v1';

    function readCart() {
        try {
            const raw = localStorage.getItem(CART_KEY);
            if (!raw) {
                return { items: {} };
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return { items: {} };
            }
            if (!parsed.items || typeof parsed.items !== 'object') {
                parsed.items = {};
            }
            let changed = false;
            Object.keys(parsed.items).forEach((key) => {
                const item = parsed.items[key];
                const count = Number(item?.count || 0);
                const safeCount = Number.isFinite(count) ? count : 0;
                const clamped = Math.max(0, Math.min(10, safeCount));
                if (!Number.isFinite(count) || clamped !== safeCount) {
                    changed = true;
                }
                if (clamped === 0) {
                    delete parsed.items[key];
                    changed = true;
                } else {
                    parsed.items[key] = {
                        ...item,
                        count: clamped
                    };
                }
            });
            if (changed) {
                localStorage.setItem(CART_KEY, JSON.stringify(parsed));
            }
            return parsed;
        } catch (error) {
            return { items: {} };
        }
    }

    function writeCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    function getTotalCount(cart) {
        return Object.values(cart.items).reduce((sum, item) => {
            return sum + (item?.count || 0);
        }, 0);
    }

    function getItemName(itemEl) {
        return itemEl.dataset.itemName || itemEl.querySelector('strong, h3')?.textContent?.trim() || 'Item';
    }

    const selectableItems = Array.from(document.querySelectorAll('[data-item-id]'));
    const LONG_PRESS_MS = 2000;
    const floatingOrderCard = document.getElementById('floating-order-card');
    let orderPanel = null;
    const pressState = new WeakMap();

    function updateCounters(cart) {
        selectableItems.forEach((itemEl) => {
            const id = itemEl.dataset.itemId;
            const count = cart.items[id]?.count || 0;
            const counterContainer = itemEl.querySelector('.product-media, .service-media') || itemEl;
            let counterEl = itemEl.querySelector('.counter');

            if (!counterEl) {
                counterEl = document.createElement('span');
                counterEl.className = 'counter';
            }
            if (counterEl.parentElement !== counterContainer) {
                counterContainer.appendChild(counterEl);
            }

            if (count > 0) {
                counterEl.textContent = count;
                counterEl.style.display = 'block';
            } else {
                counterEl.textContent = '';
                counterEl.style.display = 'none';
            }
        });
    }

    function updateFloatingCard(cart) {
        if (!floatingOrderCard) {
            return;
        }
        const totalCount = getTotalCount(cart);
        floatingOrderCard.style.display = totalCount > 0 ? 'block' : 'none';
        if (totalCount > 0) {
            floatingOrderCard.textContent = `Ver pedido (${totalCount})`;
        }
    }

    function ensureOrderPanel() {
        if (orderPanel) {
            return orderPanel;
        }
        orderPanel = document.createElement('div');
        orderPanel.id = 'order-panel';
        orderPanel.className = 'order-panel';
        orderPanel.innerHTML = `
            <div class="order-panel-header">
                <div>
                    <h3 class="order-panel-title">Tu pedido</h3>
                    <p class="order-panel-subtitle"></p>
                </div>
                <button class="order-panel-close" data-action="close" aria-label="Cerrar">×</button>
            </div>
            <div class="order-panel-list"></div>
            <div class="order-panel-footer">
                <button class="ghost-btn order-clear" data-action="clear">Vaciar</button>
            </div>
        `;
        document.body.appendChild(orderPanel);
        return orderPanel;
    }

    function renderOrderPanel(cart) {
        if (!floatingOrderCard) {
            return;
        }
        const panel = ensureOrderPanel();
        const list = panel.querySelector('.order-panel-list');
        const subtitle = panel.querySelector('.order-panel-subtitle');
        const footer = panel.querySelector('.order-panel-footer');
        const entries = Object.entries(cart.items).filter(([, item]) => item && item.count > 0);
        const totalCount = getTotalCount(cart);

        subtitle.textContent = totalCount > 0 ? `${totalCount} seleccionados` : 'Sin selecciones';
        list.innerHTML = '';

        if (entries.length === 0) {
            list.innerHTML = '<p class="order-panel-empty">Todavía no seleccionaste nada.</p>';
            if (footer) {
                footer.style.display = 'none';
            }
            return;
        }

        if (footer) {
            footer.style.display = 'flex';
        }

        entries.forEach(([id, item]) => {
            const row = document.createElement('div');
            row.className = 'order-item';
            row.innerHTML = `
                <div class="order-item-info">
                    <span class="order-item-name">${item.name}</span>
                    <span class="order-item-count">x${item.count}</span>
                </div>
                <button class="order-item-remove" data-action="remove" data-item-id="${id}">Quitar</button>
            `;
            list.appendChild(row);
        });
    }

    function deselectItem(itemEl) {
        const id = itemEl.dataset.itemId;
        if (!id) {
            return;
        }
        const cart = readCart();
        if (cart.items[id]) {
            delete cart.items[id];
            writeCart(cart);
            updateCounters(cart);
            updateFloatingCard(cart);
            renderOrderPanel(cart);
        }
    }

    function addItem(itemEl) {
        const id = itemEl.dataset.itemId;
        if (!id) {
            return;
        }
        const name = getItemName(itemEl);
        const type = itemEl.dataset.itemType || 'item';
        const cart = readCart();
        const current = cart.items[id]?.count || 0;
        if (current >= 10) {
            delete cart.items[id];
            writeCart(cart);
            updateCounters(cart);
            updateFloatingCard(cart);
            renderOrderPanel(cart);
            return;
        }

        cart.items[id] = {
            name,
            count: current + 1,
            type
        };

        writeCart(cart);
        updateCounters(cart);
        updateFloatingCard(cart);
        renderOrderPanel(cart);
    }

    selectableItems.forEach((itemEl) => {
        pressState.set(itemEl, { timer: null, ignoreClick: false });

        itemEl.addEventListener('pointerdown', (event) => {
            if (event.button !== undefined && event.button !== 0) {
                return;
            }
            const state = pressState.get(itemEl);
            if (!state) {
                return;
            }
            state.ignoreClick = false;
            if (state.timer) {
                clearTimeout(state.timer);
            }
            state.timer = setTimeout(() => {
                state.ignoreClick = true;
                deselectItem(itemEl);
            }, LONG_PRESS_MS);
        });

        const clearPress = () => {
            const state = pressState.get(itemEl);
            if (!state) {
                return;
            }
            if (state.timer) {
                clearTimeout(state.timer);
                state.timer = null;
            }
        };

        itemEl.addEventListener('pointerup', clearPress);
        itemEl.addEventListener('pointerleave', clearPress);
        itemEl.addEventListener('pointercancel', clearPress);

        itemEl.addEventListener('click', () => {
            const state = pressState.get(itemEl);
            if (state?.ignoreClick) {
                state.ignoreClick = false;
                return;
            }
            addItem(itemEl);
        });
    });

    if (floatingOrderCard) {
        floatingOrderCard.addEventListener('click', () => {
            const cart = readCart();
            renderOrderPanel(cart);
            const panel = ensureOrderPanel();
            panel.classList.toggle('open');
        });
    }

    document.addEventListener('click', (event) => {
        if (!orderPanel || !orderPanel.classList.contains('open')) {
            return;
        }
        if (orderPanel.contains(event.target)) {
            return;
        }
        if (floatingOrderCard && floatingOrderCard.contains(event.target)) {
            return;
        }
        orderPanel.classList.remove('open');
    });

    document.addEventListener('click', (event) => {
        if (!orderPanel || !orderPanel.contains(event.target)) {
            return;
        }
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }
        const cart = readCart();

        if (action === 'close') {
            orderPanel.classList.remove('open');
            return;
        }

        if (action === 'clear') {
            cart.items = {};
            writeCart(cart);
            updateCounters(cart);
            updateFloatingCard(cart);
            renderOrderPanel(cart);
            return;
        }

        if (action === 'remove') {
            const id = event.target.dataset.itemId;
            if (id && cart.items[id]) {
                delete cart.items[id];
                writeCart(cart);
                updateCounters(cart);
                updateFloatingCard(cart);
                renderOrderPanel(cart);
            }
        }
    });

    // Listen for theme/cart changes in other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            if (e.newValue === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            updateToggleText();
            triggerTitleUnderline();
        }
        if (e.key === CART_KEY) {
            const cart = readCart();
            updateCounters(cart);
            updateFloatingCard(cart);
            renderOrderPanel(cart);
        }
    });

    const initialCart = readCart();
    updateCounters(initialCart);
    updateFloatingCard(initialCart);
    renderOrderPanel(initialCart);

    const commentTextarea = document.querySelector('.comment-input textarea');
    const commentButton = document.querySelector('.write-comment-btn');

    if (commentTextarea && commentButton) {
        const toggleCommentButton = () => {
            const hasText = commentTextarea.value.trim().length > 0;
            commentButton.classList.toggle('is-visible', hasText);
        };

        toggleCommentButton();
        commentTextarea.addEventListener('input', toggleCommentButton);
    }
});
