import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../src/components/booking/shared/AutocompleteField.jsx",
  import.meta.url,
);

test("the autocomplete input connects its keyboard navigation handler", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /<input[\s\S]*?onKeyDown=\{handleKeyDown\}/);
});
