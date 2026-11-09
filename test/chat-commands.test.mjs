import { describe, expect, it } from "vitest";
import { getCommandRegistry, listCommands } from "../scripts/chat/commands.mjs";

const registry = {
  prefix: "/",
  commands: {
    help: { args: [], callback: () => {}, description: "Help" },
    table: {
      args: ["table", "modifier", "column"],
      defaultArg: "table",
      description: "Roll on a table",
      examples: "<br>/table critarm",
      callback: () => {}
    },
    broken: { args: ["x"] }
  }
};

describe("commands", () => {
  it("znajduje rejestr aktywnego systemu", () => {
    expect(getCommandRegistry({ system: { id: "wfrp4e" }, wfrp4e: { commands: registry } })).toBe(registry);
    expect(getCommandRegistry({ system: { id: "whtow" }, whtow: { commands: registry } })).toBe(registry);
    expect(getCommandRegistry({ system: { id: "dnd5e" } })).toBeNull();
    expect(getCommandRegistry(undefined)).toBeNull();
  });

  it("normalizuje definicje i pomija komendy bez callbacku", () => {
    const list = listCommands(registry);
    expect(list.map((c) => c.key)).toEqual(["help", "table"]);
    expect(list[1]).toEqual({
      key: "table",
      prefix: "/",
      aliases: [],
      args: ["table", "modifier", "column"],
      defaultArg: "table",
      description: "Roll on a table",
      notes: "",
      examples: "<br>/table critarm"
    });
    expect(listCommands(null)).toEqual([]);
  });

  it("grupuje aliasy (wspólny callback albo dopisek w opisie)", () => {
    const tableCb = () => {};
    const corruptionCb = () => {};
    const aliased = {
      commands: {
        table: { args: ["table"], defaultArg: "table", description: "Roll on a table", callback: tableCb },
        corruption: { args: ["strength"], description: "Prompt Corruption Test", callback: corruptionCb },
        tabela: { args: ["table"], description: "Rzut na tabelę (alias /table)", callback: tableCb },
        tabelka: { args: ["table"], description: "Rzut na tabelę", callback: tableCb },
        zepsucie: { args: ["strength"], description: "Test Zepsucia (alias /corruption)", callback: () => {} },
        coruption: { args: ["strength"], description: "Alias for /corruption", callback: () => {} },
        "płać": { args: [], description: "Alias for /missing", callback: () => {} }
      }
    };
    const list = listCommands(aliased);
    expect(list.map((c) => [c.key, c.aliases])).toEqual([
      ["table", ["tabela", "tabelka"]],
      ["corruption", ["zepsucie", "coruption"]],
      ["płać", []]
    ]);
  });
});
