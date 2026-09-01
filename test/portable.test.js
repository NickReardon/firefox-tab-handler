import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTabInventory,
  createRuleConfig,
  parseRuleConfig,
  previewRuleReplacement,
} from "../src/portable.js";

const rule = {
  id: "epic",
  name: "Epic",
  color: "blue",
  match: { hostnames: ["dev.epicgames.com"] },
};

test("round-trips a strict versioned rule config", () => {
  const config = createRuleConfig([rule]);

  assert.deepEqual(parseRuleConfig(JSON.stringify(config)), config);
  assert.throws(
    () => parseRuleConfig(JSON.stringify({ ...config, extra: true })),
    /unknown field extra/,
  );
  assert.throws(
    () => parseRuleConfig(JSON.stringify({ ...config, version: 2 })),
    /Unsupported rule config version 2/,
  );
  assert.throws(
    () => parseRuleConfig(JSON.stringify({
      ...config,
      rules: [{ ...rule, match: { ...rule.match, typo: [] } }],
    })),
    /unknown field typo/,
  );
});

test("previews added, changed, and removed rules", () => {
  const changed = { ...rule, name: "Epic Games" };
  const added = { ...rule, id: "mozilla", name: "Mozilla" };
  const removed = { ...rule, id: "old", name: "Old" };
  const preview = previewRuleReplacement([rule, removed], [changed, added]);

  assert.deepEqual(preview.added.map(({ id }) => id), ["mozilla"]);
  assert.deepEqual(preview.changed.map(({ id }) => id), ["epic"]);
  assert.deepEqual(preview.removed.map(({ id }) => id), ["old"]);
});

test("exports a sanitized tab inventory unless full URLs are explicit", () => {
  const snapshot = {
    capturedAt: "2026-09-01T00:00:00.000Z",
    windows: [{
      id: 1,
      focused: true,
      groups: [{ id: 10, title: "Docs" }],
      tabs: [{
        groupId: 10,
        title: "Private query",
        url: "https://user:secret@example.com/path?token=secret#section",
        pinned: true,
        cookieStoreId: "firefox-container-1",
      }],
    }],
  };

  const sanitized = buildTabInventory(snapshot);
  assert.deepEqual(sanitized.windows[0].tabs[0], {
    groupName: "Docs",
    title: "Private query",
    hostname: "example.com",
    url: "https://example.com/path",
    pinned: true,
    cookieStoreId: "firefox-container-1",
  });
  assert.equal(
    buildTabInventory(snapshot, { includeFullUrls: true }).windows[0].tabs[0].url,
    "https://example.com/path?token=secret#section",
  );
  assert.deepEqual(
    buildTabInventory(snapshot, { windowIds: [] }).windows,
    [],
  );
});
