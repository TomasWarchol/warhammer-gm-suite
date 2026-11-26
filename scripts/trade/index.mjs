/**
 * Handel: integracja Item Piles dla systemów Warhammera, generator towaru oraz predefiniowane sklepy.
 * Działa tylko z aktywnym Item Piles; bez niego reszta panelu MG pozostaje bez zmian.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { physicalTypes } from "./availability.mjs";
import { buildIntegration } from "./integration.mjs";
import { openStockDialog, stockMerchant } from "./merchant.mjs";
import {
  createPresetShop,
  isShopOpen,
  openCreateShopDialog,
  openRerollDialog,
  openShopInterface,
  rerollShopAvailability,
  shopMeta,
  syncShopCatalog,
  toggleShopOpen
} from "./shops.mjs";
import { registerShopOverlay } from "./ui-overlay.mjs";
import { adapterFor } from "./systems/index.mjs";

/**
 * Osobne moduły z tą samą integracją Item Piles (obecny i jego dawna nazwa). Gdy któryś jest aktywny,
 * to on konfiguruje Item Piles i dodaje menu kontekstowe, a zakładka Kupcy korzysta z jego API.
 */
const STANDALONE = ["item-piles-warhammer", "item-piles-warhammer-trade"];

let adapter = null;
let shopAdapter = null;
let standalone = null;

/** API aktywnego osobnego modułu (ustawiane w jego hooku init, więc czytane dopiero przy użyciu). */
const standaloneApi = () => (standalone ? game.modules.get(standalone)?.api : null);

export const tradeActive = () => Boolean(game.itempiles && (adapter || standaloneApi()?.adapter));

/** Kupcy Item Piles wśród aktorów świata. */
export const merchants = () => (tradeActive() ? game.actors.filter((actor) => game.itempiles.API.isItemPileMerchant(actor)) : []);

export const openStock = (actor) => (adapter ? openStockDialog(adapter, actor) : standaloneApi()?.openStockDialog(actor));
export const shopPresets = () => shopAdapter?.shopPresets ?? [];
export const shopLocations = () => (shopAdapter?.locations ? shopAdapter.locations(game) ?? [] : []);
export const merchantInfo = (actor) => ({ open: isShopOpen(actor), meta: shopMeta(actor) });
export const toggleShop = (actor, open) => toggleShopOpen(actor, open);
export const openShop = (actor) => openShopInterface(actor);
export const openReroll = (actor) => (shopAdapter ? openRerollDialog(shopAdapter, actor) : null);
export const openCreateShop = (options) =>
  shopAdapter ? (options ? createPresetShop(shopAdapter, options) : openCreateShopDialog(shopAdapter)) : null;

export function registerTrade() {
  shopAdapter = adapterFor(game.system.id);
  standalone = STANDALONE.find((id) => game.modules.get(id)?.active) ?? null;
  if (standalone) {
    // Zgodność makr: api.trade przekazuje wywołania do osobnego modułu
    game.modules.get(MODULE_ID).api.trade = {
      currencies: () => standaloneApi()?.currencies(),
      applyCurrencies: () => standaloneApi()?.applyCurrencies(),
      stockMerchant: (merchant, options) => standaloneApi()?.stockMerchant(merchant, options),
      openStockDialog: openStock,
      presets: shopAdapter?.shopPresets ?? [],
      createPresetShop: (options) => (shopAdapter ? createPresetShop(shopAdapter, options) : null),
      rerollShopAvailability: (merchant, options) => (shopAdapter ? rerollShopAvailability(shopAdapter, merchant, options) : null),
      toggleShopOpen,
      syncShopCatalog: (merchant) => (shopAdapter ? syncShopCatalog(shopAdapter, merchant) : 0)
    };
    if (shopAdapter?.shopPresets?.length) registerShopOverlay(() => shopAdapter);
    return log.info(`aktywny moduł ${standalone}: on konfiguruje Item Piles, zakładka Kupcy używa jego generatora`);
  }
  adapter = shopAdapter;
  if (!adapter) return;

  // Item Piles woła ten hook, gdy jest gotowy na integrację systemu
  Hooks.once("item-piles-ready", async () => {
    try {
      const currencies = await adapter.currencies(game, t);
      const itemTypes = Object.keys(CONFIG.Item.dataModels ?? {});
      const physical = physicalTypes(CONFIG.Item.dataModels);
      game.itempiles.API.addSystemIntegration(buildIntegration({ adapter, currencies, itemTypes, physical }));
      log.info(`integracja Item Piles (${game.system.id}): ${currencies.map((c) => c.name).join(", ") || "bez waluty"}`);
    } catch (err) {
      log.error("Integracja Item Piles", err);
    }
  });

  if (adapter.shopPresets?.length) registerShopOverlay(() => adapter);

  // Menu kontekstowe katalogu aktorów: generator towaru i przelosowanie dla kupców (tylko MG)
  Hooks.on("getActorContextOptions", (_app, options) => {
    options.push({
      name: "WHTRADE.Stock.Menu",
      icon: '<i class="fa-solid fa-cart-plus"></i>',
      condition: (li) => {
        if (!tradeActive() || !game.user.isGM) return false;
        const actor = game.actors.get(li.dataset?.entryId);
        return Boolean(actor && game.itempiles.API.isItemPileMerchant(actor));
      },
      callback: (li) => openStock(game.actors.get(li.dataset?.entryId))
    });
    if (adapter.shopPresets?.length) {
      options.push({
        name: "WHTRADE.Shop.RerollMenu",
        icon: '<i class="fa-solid fa-dice"></i>',
        condition: (li) => {
          if (!tradeActive() || !game.user.isGM) return false;
          const actor = game.actors.get(li.dataset?.entryId);
          return Boolean(actor && game.itempiles.API.isItemPileMerchant(actor));
        },
        callback: (li) => openReroll(game.actors.get(li.dataset?.entryId))
      });
    }
  });

  game.modules.get(MODULE_ID).api.trade = {
    currencies: () => adapter.currencies(game, t),
    applyCurrencies: async () => game.itempiles?.API.setCurrencies(await adapter.currencies(game, t)),
    stockMerchant: (merchant, options) => stockMerchant(adapter, merchant, options),
    openStockDialog: openStock,
    presets: adapter.shopPresets ?? [],
    createPresetShop: (options) => createPresetShop(adapter, options),
    rerollShopAvailability: (merchant, options) => rerollShopAvailability(adapter, merchant, options),
    toggleShopOpen,
    syncShopCatalog: (merchant) => syncShopCatalog(adapter, merchant)
  };
}
