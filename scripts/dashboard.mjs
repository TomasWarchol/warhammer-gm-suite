/**
 * Panel MG: zakładki funkcji dostępnych w aktywnym systemie. Kolejne etapy dokładają tylko zakładki.
 * Pola formularzy trzymamy w `state`, bo panel odświeża się przy zmianach postaci.
 */
import { MODULE_ID, I18N, t } from "./constants.mjs";
import { getSetting, rollModes, setSetting } from "./settings.mjs";
import { pickParty } from "./party.mjs";
import { expandReason } from "./session-data.mjs";
import { resolveTest } from "./group-data.mjs";
import { awardXp, endSession, refreshResource } from "./session.mjs";
import { runGroupTest } from "./group-test.mjs";
import { applyGroupDamage } from "./damage.mjs";
import { damageOptions, hasAdditive, stepPool } from "./damage-data.mjs";
import { LIGHT_SETS, lightData, lightRange, sightData, visionPresets, visionRange } from "./token-presets.mjs";
import { sendWhispers } from "./whispers.mjs";
import { merchants, openStock, tradeActive } from "./trade/index.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const template = (name) => `modules/${MODULE_ID}/templates/${name}.hbs`;
const TAB_SETTINGS = { session: "enableSession", group: "enableGroup", combat: "enableCombat", tokens: "enableTokens", whispers: "enableWhispers", merchants: "enableMerchants" };

export class GMDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Adapter aktywnego systemu, ustawiany przy starcie modułu. */
  static adapter = null;
  static #instance = null;

  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: [MODULE_ID],
    window: { title: `${I18N}.Title`, icon: "fa-solid fa-chess-rook", resizable: true },
    position: { width: 640, height: 700 },
    actions: {
      award: GMDashboard.#onAward,
      refresh: GMDashboard.#onRefresh,
      endSession: GMDashboard.#onEndSession,
      runTest: GMDashboard.#onRunTest,
      quickTest: GMDashboard.#onQuickTest,
      applyDamage: GMDashboard.#onApplyDamage,
      poolStep: GMDashboard.#onPoolStep,
      poolReset: GMDashboard.#onPoolReset,
      lightPreset: GMDashboard.#onLightPreset,
      visionPreset: GMDashboard.#onVisionPreset,
      sendWhisper: GMDashboard.#onSendWhisper,
      stockMerchant: GMDashboard.#onStockMerchant
    }
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    session: { template: template("session"), scrollable: [""] },
    group: { template: template("group"), scrollable: [""] },
    combat: { template: template("combat"), scrollable: [""] },
    tokens: { template: template("tokens"), scrollable: [""] },
    whispers: { template: template("whispers"), scrollable: [""] },
    merchants: { template: template("merchants"), scrollable: [""] }
  };

  static TABS = {
    main: {
      tabs: [
        { id: "session", icon: "fa-solid fa-flag-checkered", label: `${I18N}.Tabs.Session` },
        { id: "group", icon: "fa-solid fa-dice-d20", label: `${I18N}.Tabs.Group` },
        { id: "combat", icon: "fa-solid fa-burst", label: `${I18N}.Tabs.Combat` },
        { id: "tokens", icon: "fa-solid fa-lightbulb", label: `${I18N}.Tabs.Tokens` },
        { id: "whispers", icon: "fa-solid fa-ghost", label: `${I18N}.Tabs.Whispers` },
        { id: "merchants", icon: "fa-solid fa-store", label: `${I18N}.Tabs.Merchants` }
      ],
      initial: "session"
    }
  };

  /** Otwiera panel (jeden na klienta), opcjonalnie na wskazanej zakładce. */
  static open(tab) {
    if (!game.user.isGM) return ui.notifications.warn(t("GMOnly"));
    if (!this.adapter) return ui.notifications.warn(t("Unsupported"));
    this.#instance ??= new this();
    this.#instance.render({ force: true }).then(() => {
      if (tab) this.#instance.changeTab(tab, "main");
    });
    return this.#instance;
  }

  /** Odświeża otwarty panel. */
  static refresh() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  get adapter() {
    return this.constructor.adapter;
  }

  state = null;
  catalog = null;
  lastResults = null;
  lastDamage = null;
  busy = false;

  /** Szepty istnieją tylko w systemach ze Spaczeniem, a Kupcy tylko z aktywnym Item Piles. */
  #tabEnabled(id) {
    if (id === "whispers" && !this.adapter.whispers) return false;
    if (id === "merchants" && !tradeActive()) return false;
    return getSetting(TAB_SETTINGS[id]);
  }

  _getTabsConfig(group) {
    const config = foundry.utils.deepClone(super._getTabsConfig(group));
    config.tabs = config.tabs.filter((tab) => this.#tabEnabled(tab.id));
    if (!config.tabs.some((tab) => tab.id === config.initial)) config.initial = config.tabs[0]?.id;
    return config;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    for (const tab of Object.keys(TAB_SETTINGS)) if (!this.#tabEnabled(tab)) delete parts[tab];
    return parts;
  }

  #initialState() {
    const difficulty = this.adapter.tests.difficulty(game);
    return {
      mode: getSetting("defaultMode"),
      excluded: new Set(),
      amount: 0,
      reason: getSetting("defaultReason") || t("Session.DefaultReason"),
      exportChat: false,
      clearChat: false,
      award: true,
      refresh: true,
      scene: false,
      advance: true,
      test: "",
      difficulty: difficulty?.initial ?? "",
      complexity: difficulty?.complexity ?? 1,
      modifier: 0,
      rollMode: getSetting("defaultRollMode"),
      showDialog: false,
      dmgFormula: "",
      dmgPerActor: false,
      tokenRange: 0,
      whisperAsk: "",
      ...Object.fromEntries(this.adapter.damage.fields.map((f) => [`dmg_${f.id}`, f.initial]))
    };
  }

  /** @param {string[]} [extraTypes] dodatkowe typy aktorów dla jednej zakładki, np. pojazdy w obrażeniach */
  #party(extraTypes = []) {
    const adapter = extraTypes.length ? { ...this.adapter, companyTypes: [...this.adapter.companyTypes, ...extraTypes] } : this.adapter;
    return pickParty({ mode: this.state.mode, actors: game.actors.contents, users: game.users.contents, controlled: canvas.tokens?.controlled.map((token) => token.actor) ?? [], adapter });
  }

  #selected(extraTypes) {
    return this.#party(extraTypes).filter((actor) => !this.state.excluded.has(actor.id));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.state ??= this.#initialState();
    const { adapter, state } = this;
    const party = this.#party();
    this.catalog ??= await adapter.tests.catalog(game, party);
    if (!state.test) state.test = this.#defaultTest();

    const refreshKey = adapter.refresh.key;
    const row = (actor) => ({
      id: actor.id,
      name: actor.name,
      img: actor.img,
      selected: !state.excluded.has(actor.id),
      xp: adapter.xp.read(actor),
      resource: adapter.refresh.perActor ? adapter.refresh.read(actor, game) : null,
      health: adapter.damage.read(actor),
      corruption: adapter.whispers?.read(actor)
    });
    const rows = party.map(row);
    const combatRows = this.#party(adapter.damage.extraTypes).map(row);
    const difficulty = adapter.tests.difficulty(game);
    const groups = ["skill", "characteristic", "attribute"]
      .map((group) => ({ label: t(`Group.Kinds.${group}`), options: this.catalog.filter((e) => e.group === group) }))
      .filter((group) => group.options.length);

    return Object.assign(context, {
      merchantRows: merchants().map((actor) => ({ id: actor.id, name: actor.name, img: actor.img })),
      tabs: this._prepareTabs("main"),
      state,
      rows,
      combatRows,
      modes: ["party", "company", "selected"].map((id) => ({ id, label: t(`Party.${id}`) })),
      sessionId: getSetting("sessionId"),
      holdingScene: getSetting("holdingScene"),
      scenes: game.scenes.contents.map((scene) => ({ id: scene.id, name: scene.name })).sort((a, b) => a.name.localeCompare(b.name)),
      reasonPreview: expandReason(state.reason, getSetting("sessionId")),
      refresh: { perActor: adapter.refresh.perActor, column: t(`Refresh.${refreshKey}.Column`), action: t(`Refresh.${refreshKey}.Action`) },
      freeText: adapter.tests.freeText,
      showModifier: adapter.tests.modifier,
      difficulty,
      groups,
      quick: adapter.tests.quick(game, this.catalog),
      rollModes: Object.entries(rollModes()).map(([id, label]) => ({ id, label: game.i18n.localize(label) })),
      results: this.lastResults,
      healthLabel: t(`Damage.Stat.${adapter.damage.stat}`),
      damage: {
        results: this.lastDamage,
        fields: adapter.damage.fields.map((f) => ({
          ...f,
          label: t(`Damage.Field.${f.id}`),
          value: state[`dmg_${f.id}`],
          choices: f.choices?.(game)
        }))
      },
      tokens: {
        count: canvas.tokens?.controlled.length ?? 0,
        lights: LIGHT_SETS[adapter.lightSet].map((id) => ({ id, label: t(`Tokens.Lights.${id}`), range: lightRange(id) })),
        vision: visionPresets().map((id) => ({ id, label: t(`Tokens.Visions.${id}`), range: visionRange(id) }))
      },
      pool: adapter.pools ? { title: t(`Pools.${adapter.pools.key}`), rows: this.#poolEntries() } : null
    });
  }

  async _preparePartContext(partId, context, options) {
    const part = await super._preparePartContext(partId, context, options);
    part.tab = part.tabs?.[partId];
    return part;
  }

  /** Pozycje puli walki z etykietami gotowymi do wyświetlenia. */
  #poolEntries() {
    return this.adapter.pools.list(game, this.#party()).map((entry) => ({ ...entry, label: entry.labelKey ? t(entry.labelKey) : entry.label }));
  }

  #defaultTest() {
    const entry = this.adapter.tests.quick(game, this.catalog)[0] ?? this.catalog[0];
    return this.adapter.tests.freeText ? entry?.label ?? "" : entry?.id ?? "";
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", (event) => this.#onChange(event));
  }

  async #onChange(event) {
    const input = event.target;
    if (input.dataset.exclude) {
      if (input.checked) this.state.excluded.delete(input.dataset.exclude);
      else this.state.excluded.add(input.dataset.exclude);
      return;
    }
    if (input.dataset.setting) {
      await setSetting(input.dataset.setting, input.value);
      return this.render();
    }
    const key = input.dataset.state;
    if (!key) return;
    this.state[key] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) || 0 : input.value;
    if (key === "mode" || key === "reason") this.render();
  }

  /** Wykonuje działanie bez nakładania się kliknięć. */
  async #exclusive(action) {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
    } finally {
      this.busy = false;
      this.render();
    }
  }

  #reason() {
    return expandReason(this.state.reason, getSetting("sessionId"));
  }

  static async #onAward() {
    const amount = Number(this.state.amount);
    if (amount <= 0) return ui.notifications.warn(t("Session.NoAmount"));
    await this.#exclusive(async () => {
      const actors = await awardXp(this.adapter, this.#selected(), amount, this.#reason());
      ui.notifications.info(t("Session.Awarded", { amount, count: actors.length }));
    });
  }

  static async #onRefresh() {
    await this.#exclusive(async () => {
      const actors = await refreshResource(this.adapter, this.#selected());
      ui.notifications.info(t("Session.Refreshed", { resource: t(`Refresh.${this.adapter.refresh.key}.Column`), count: actors.length }));
    });
  }

  static async #onEndSession() {
    const { state, adapter } = this;
    const sceneId = getSetting("holdingScene");
    const checks = [
      state.exportChat && t("Session.Step.exportChat"),
      state.clearChat && `<strong>${t("Session.Step.clearChat")}</strong> – ${t("Session.ClearWarning")}`,
      state.award && state.amount > 0 && `${t("Session.Step.award")}: ${state.amount}`,
      state.refresh && t(`Refresh.${adapter.refresh.key}.Action`),
      state.scene && sceneId && `${t("Session.Step.scene")}: ${foundry.utils.escapeHTML(game.scenes.get(sceneId)?.name ?? "")}`,
      state.advance && t("Session.Step.advance")
    ].filter(Boolean);
    if (!checks.length) return ui.notifications.warn(t("Session.NothingToDo"));
    const confirmed = await DialogV2.confirm({
      window: { title: t("Session.EndTitle") },
      content: `<p>${t("Session.EndConfirm")}</p><ul>${checks.map((c) => `<li>${c}</li>`).join("")}</ul>`
    });
    if (!confirmed) return;
    await this.#exclusive(() => endSession(adapter, this.#selected(), { ...state, reason: this.#reason(), sceneId }));
  }

  static #onQuickTest(_event, target) {
    this.state.test = this.adapter.tests.freeText ? target.dataset.label : target.dataset.test;
    this.render();
  }

  static async #onApplyDamage() {
    const { state, adapter } = this;
    const actors = this.#selected(adapter.damage.extraTypes);
    if (!actors.length) return ui.notifications.warn(t("Group.NoActors"));
    const formula = String(state.dmgFormula ?? "").trim();
    const options = damageOptions(adapter.damage.fields, state);
    if (formula && !Roll.validate(formula)) return ui.notifications.warn(t("Damage.BadFormula"));
    if (!formula && !hasAdditive(adapter.damage.fields, options)) return ui.notifications.warn(t("Damage.NoAmount"));
    await this.#exclusive(async () => {
      this.lastDamage = await applyGroupDamage(adapter, actors, { formula, perActor: state.dmgPerActor, options });
    });
  }

  static async #onPoolStep(_event, target) {
    const entry = this.#poolEntries().find((e) => e.id === target.dataset.id);
    if (!entry) return;
    await this.#exclusive(() => this.adapter.pools.set(game, entry, stepPool(entry.value, Number(target.dataset.delta), entry.max)));
  }

  static async #onPoolReset() {
    await this.#exclusive(async () => {
      for (const entry of this.#poolEntries()) await this.adapter.pools.set(game, entry, 0);
    });
  }

  /** Zmienia dane zaznaczonych tokenów jedną aktualizacją sceny. */
  async #updateTokens(field, data) {
    const tokens = canvas.tokens?.controlled ?? [];
    if (!tokens.length) return ui.notifications.warn(t("Tokens.NoneSelected"));
    await canvas.scene.updateEmbeddedDocuments("Token", tokens.map((token) => ({ _id: token.id, [field]: data })));
    ui.notifications.info(t("Tokens.Updated", { count: tokens.length }));
  }

  static #onLightPreset(_event, target) {
    return this.#updateTokens("light", lightData(target.dataset.id, this.state.tokenRange));
  }

  static #onVisionPreset(_event, target) {
    return this.#updateTokens("sight", sightData(target.dataset.id, this.state.tokenRange));
  }

  static async #onSendWhisper() {
    const ask = String(this.state.whisperAsk ?? "").trim();
    if (!ask) return ui.notifications.warn(t("Whispers.NoText"));
    const actors = this.#selected();
    if (!actors.length) return ui.notifications.warn(t("Group.NoActors"));
    await this.#exclusive(async () => {
      const { send, noCorruption, noPlayer } = await sendWhispers(this.adapter, actors, ask);
      ui.notifications.info(t("Whispers.Sent", { sent: send.length, noCorruption, noPlayer }));
      if (send.length) this.state.whisperAsk = "";
    });
  }

  static async #onRunTest() {
    const { state, adapter } = this;
    const actors = this.#selected();
    if (!actors.length) return ui.notifications.warn(t("Group.NoActors"));
    const entry = resolveTest(state.test, this.catalog);
    if (!entry) return ui.notifications.warn(t("Group.NoTest"));
    await this.#exclusive(async () => {
      this.lastResults = await runGroupTest(adapter, actors, entry, {
        difficulty: state.difficulty,
        complexity: state.complexity,
        modifier: state.modifier,
        rollMode: state.rollMode,
        skipDialog: !state.showDialog
      });
    });
  }

  static #onStockMerchant(_event, target) {
    const actor = game.actors.get(target.closest("[data-actor]")?.dataset.actor);
    if (actor) openStock(actor);
  }
}
