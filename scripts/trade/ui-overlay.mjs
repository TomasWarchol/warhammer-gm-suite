/**
 * Lekka nakładka MG w oknie kupca Item Piles (MerchantApp):
 * szybkie otwieranie/zamykanie sklepu, zmiana osady, przelosowanie dostępności,
 * synchronizacja z kompendiami oraz przycisk +1 przy ukrytych/wyzerowanych pozycjach.
 */
import { t } from "./constants.mjs";
import { settlementLimit } from "./presets.mjs";
import { isShopOpen, rerollShopAvailability, revealShopItem, shopMeta, syncShopCatalog, toggleShopOpen } from "./shops.mjs";

function createBar(adapter, merchant) {
  const meta = shopMeta(merchant);
  const open = isShopOpen(merchant);
  const locations = adapter.locations(game) ?? [];
  const currentLoc = meta?.location ?? locations[0]?.key ?? "MARKET.Village";
  const currentLimit = meta?.limit ?? settlementLimit(currentLoc);

  const bar = document.createElement("div");
  bar.className = "whgm-shop-bar";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  const renderToggle = (state) => {
    toggleBtn.className = `whgm-shop-toggle ${state ? "open" : "closed"}`;
    toggleBtn.innerHTML = `<i class="fa-solid ${state ? "fa-lock-open" : "fa-lock"}"></i> ${foundry.utils.escapeHTML(t(state ? "Shop.Status.Open" : "Shop.Status.Closed"))}`;
  };
  renderToggle(open);
  toggleBtn.addEventListener("click", async () => {
    const next = await toggleShopOpen(merchant);
    renderToggle(next);
  });
  bar.appendChild(toggleBtn);

  const select = document.createElement("select");
  select.title = t(`Stock.Location.${adapter.id}`);
  for (const loc of locations) {
    const option = document.createElement("option");
    option.value = loc.key;
    option.textContent = loc.label;
    if (loc.key === currentLoc) option.selected = true;
    select.appendChild(option);
  }
  bar.appendChild(select);

  const limitInput = document.createElement("input");
  limitInput.type = "number";
  limitInput.min = "1";
  limitInput.max = "500";
  limitInput.value = String(currentLimit);
  limitInput.title = t("Shop.Limit");
  bar.appendChild(limitInput);

  select.addEventListener("change", () => {
    limitInput.value = String(settlementLimit(select.value));
  });

  const rerollBtn = document.createElement("button");
  rerollBtn.type = "button";
  rerollBtn.innerHTML = `<i class="fa-solid fa-dice"></i> ${foundry.utils.escapeHTML(t("Shop.Bar.Reroll"))}`;
  rerollBtn.addEventListener("click", async () => {
    rerollBtn.disabled = true;
    try {
      const plan = await rerollShopAvailability(adapter, merchant, {
        location: select.value,
        modifier: meta?.modifier ?? 0,
        limit: Number(limitInput.value) || settlementLimit(select.value)
      });
      if (plan) ui.notifications.info(t("Shop.Rerolled", { merchant: merchant.name, available: plan.availableCount, hidden: plan.hiddenCount }));
    } finally {
      rerollBtn.disabled = false;
    }
  });
  bar.appendChild(rerollBtn);

  if (meta?.preset) {
    const syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.title = t("Shop.Bar.SyncHint");
    syncBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> ${foundry.utils.escapeHTML(t("Shop.Bar.Sync"))}`;
    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      try {
        const added = await syncShopCatalog(adapter, merchant);
        ui.notifications.info(t("Shop.Synced", { merchant: merchant.name, count: added }));
      } finally {
        syncBtn.disabled = false;
      }
    });
    bar.appendChild(syncBtn);
  }

  return bar;
}

function injectIntoSheet(adapter, root, merchant, { replace = false } = {}) {
  if (!(root instanceof HTMLElement)) return false;
  const shell = root.querySelector(".window-content > div") ?? root.querySelector(".window-content");
  if (!shell) return false;
  const existing = shell.querySelector(".whgm-shop-bar");
  if (existing) {
    if (!replace) return true;
    existing.remove();
  }
  shell.prepend(createBar(adapter, merchant));
  return true;
}

function mountShopBar(adapter, app, merchant, attempts = 60) {
  if (!game.user.isGM || !app || !merchant) return;
  const raw = app.element?.[0] ?? app.element;
  const root = raw instanceof HTMLElement ? raw : document.getElementById(app.id);
  if (!injectIntoSheet(adapter, root, merchant, { replace: true }) && attempts > 0) {
    requestAnimationFrame(() => mountShopBar(adapter, app, merchant, attempts - 1));
  }
}

function decorateMerchantItem(adapter, element, item) {
  if (!game.user.isGM || !element || !item?.parent) return;
  const sheet = element.closest?.(".item-piles-merchant-sheet");
  if (sheet) injectIntoSheet(adapter, sheet, item.parent, { replace: false });

  const existing = element.querySelector(".whgm-quick-reveal");
  const hidden = Boolean(item.getFlag?.("item-piles", "item.hidden"));
  const qty = Number(foundry.utils.getProperty(item, adapter.quantityPath) ?? 0);
  if (!hidden && qty > 0) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const controls = element.querySelector(".fa-eye, .fa-eye-slash")?.closest("div") ?? element.lastElementChild;
  if (!controls) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "whgm-quick-reveal";
  btn.title = t("Shop.Bar.Reveal");
  btn.textContent = "+1";
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await revealShopItem(adapter, item.parent, item, Math.max(1, qty || 1));
  });
  controls.appendChild(btn);
}

/** Rejestruje nakładkę MG dla okna kupca Item Piles. */
export function registerShopOverlay(getAdapter) {
  Hooks.on("item-piles-openInterface", (app, merchant) => {
    const adapter = getAdapter();
    if (!adapter?.shopPresets?.length || !merchant) return;
    requestAnimationFrame(() => mountShopBar(adapter, app, merchant));
  });

  Hooks.on("item-piles-renderMerchantItem", (element, item) => {
    const adapter = getAdapter();
    if (!adapter?.shopPresets?.length) return;
    decorateMerchantItem(adapter, element, item);
  });
}
