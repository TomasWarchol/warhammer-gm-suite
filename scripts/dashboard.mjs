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

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const template = (name) => `modules/${MODULE_ID}/templates/${name}.hbs`;
const TAB_SETTINGS = { session: "enableSession", group: "enableGroup" };

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
      quickTest: GMDashboard.#onQuickTest
    }
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    session: { template: template("session"), scrollable: [""] },
    group: { template: template("group"), scrollable: [""] }
  };

  static TABS = {
    main: {
      tabs: [
        { id: "session", icon: "fa-solid fa-flag-checkered", label: `${I18N}.Tabs.Session` },
        { id: "group", icon: "fa-solid fa-dice-d20", label: `${I18N}.Tabs.Group` }
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
  busy = false;

  _getTabsConfig(group) {
    const config = foundry.utils.deepClone(super._getTabsConfig(group));
    config.tabs = config.tabs.filter((tab) => getSetting(TAB_SETTINGS[tab.id]));
    if (!config.tabs.some((tab) => tab.id === config.initial)) config.initial = config.tabs[0]?.id;
    return config;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    for (const [tab, setting] of Object.entries(TAB_SETTINGS)) if (!getSetting(setting)) delete parts[tab];
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
      showDialog: false
    };
  }

  #party() {
    return pickParty({ mode: this.state.mode, actors: game.actors.contents, users: game.users.contents, controlled: canvas.tokens?.controlled.map((token) => token.actor) ?? [], adapter: this.adapter });
  }

  #selected() {
    return this.#party().filter((actor) => !this.state.excluded.has(actor.id));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.state ??= this.#initialState();
    const { adapter, state } = this;
    const party = this.#party();
    this.catalog ??= await adapter.tests.catalog(game, party);
    if (!state.test) state.test = this.#defaultTest();

    const refreshKey = adapter.refresh.key;
    const rows = party.map((actor) => ({
      id: actor.id,
      name: actor.name,
      img: actor.img,
      selected: !state.excluded.has(actor.id),
      xp: adapter.xp.read(actor),
      resource: adapter.refresh.perActor ? adapter.refresh.read(actor, game) : null
    }));
    const difficulty = adapter.tests.difficulty(game);
    const groups = ["skill", "characteristic", "attribute"]
      .map((group) => ({ label: t(`Group.Kinds.${group}`), options: this.catalog.filter((e) => e.group === group) }))
      .filter((group) => group.options.length);

    return Object.assign(context, {
      tabs: this._prepareTabs("main"),
      state,
      rows,
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
      results: this.lastResults
    });
  }

  async _preparePartContext(partId, context, options) {
    const part = await super._preparePartContext(partId, context, options);
    part.tab = part.tabs?.[partId];
    return part;
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
}
