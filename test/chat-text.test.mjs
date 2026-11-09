import { describe, expect, it } from "vitest";
import { cleanParameters, decodeEntities, escapeHTML, normalize, stripHTML } from "../scripts/chat/text.mjs";

describe("text", () => {
  it("decodeEntities zamienia encje i twarde spacje", () => {
    expect(decodeEntities("a&nbsp;b &amp; c\u00a0d")).toBe("a b & c d");
  });

  it("stripHTML radzi sobie z zepsutymi przykładami systemu", () => {
    const example = "<br><span font-family:'monospaced'</span>/table critarm</span><br><span font-family:'monospaced'</span>/table mutatephys modifier=20 column=khorne</span>";
    expect(stripHTML(example)).toBe("/table critarm\n/table mutatephys modifier=20 column=khorne");
  });

  it("stripHTML zachowuje zwykły tekst", () => {
    expect(stripHTML("Roll on a table")).toBe("Roll on a table");
    expect(stripHTML(undefined)).toBe("");
  });

  it("cleanParameters normalizuje treść z ProseMirror", () => {
    expect(cleanParameters("critarm&nbsp;")).toBe("critarm");
    expect(cleanParameters("12ss for=Room &amp; Board ")).toBe("12ss for=Room & Board");
    expect(cleanParameters(null)).toBe("");
  });

  it("escapeHTML", () => {
    expect(escapeHTML(`<b a="1">'&'</b>`)).toBe("&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;");
  });

  it("normalize usuwa polskie znaki", () => {
    expect(normalize("  Zręczność ŁÓDŹ ")).toBe("zrecznosc lodz");
  });
});
