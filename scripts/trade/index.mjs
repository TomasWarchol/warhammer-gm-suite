/**
 * Handel: integracja Item Piles dla systemów Warhammera i generator towaru kupców.
 * Działa tylko z aktywnym Item Piles; bez niego reszta panelu MG pozostaje bez zmian.
 */
import { MODULE_ID, t, log } from "./constants.mjs";
import { physicalTypes } from "./availability.mjs";
import { buildIntegration } from "./integration.mjs";
import { openStockDialog, stockMerchant } from "./merchant.mjs";
import { adapterFor } from "./systems/index.mjs";

/** Starszy, osobny moduł; razem zarejestrowałyby integrację dwa razy. */
const STANDALONE = "item-piles-warhammer-trade";

let adapter = null;

export const tradeActive = () => Boolean(adapter && game.itempiles);

/** Kupcy Item Piles wśród aktorów świata. */
export const merchants = () => (tradeActive() ? game.actors.filter((actor) => game.itempiles.API.isItemPileMerchant(actor)) : []);

export const openStock = (actor) => adapter && openStockDialog(adapter, actor);

export function registerTrade() {
  if (game.modules.get(STANDALONE)?.active) return log.info(`aktywny moduł ${STANDALONE}, handel z panelu MG wyłączony`);
  adapter = adapterFor(game.system.id);
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

  // Menu kontekstowe katalogu aktorów: generator towaru dla kupców (tylko MG)
  Hooks.on("getActorContextOptions", (_app, options) => options.push({
    name: "WHTRADE.Stock.Menu",
    icon: '<i class="fa-solid fa-cart-plus"></i>',
    condition: (li) => {
      if (!tradeActive() || !game.user.isGM) return false;
      const actor = game.actors.get(li.dataset?.entryId);
      return Boolean(actor && game.itempiles.API.isItemPileMerchant(actor));
    },
    callback: (li) => openStock(game.actors.get(li.dataset?.entryId))
  }));

  game.modules.get(MODULE_ID).api.trade = {
    currencies: () => adapter.currencies(game, t),
    applyCurrencies: async () => game.itempiles?.API.setCurrencies(await adapter.currencies(game, t)),
    stockMerchant: (merchant, options) => stockMerchant(adapter, merchant, options),
    openStockDialog: openStock
  };
}
