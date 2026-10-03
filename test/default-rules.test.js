import assert from "node:assert/strict";
import test from "node:test";

import { matchesRule, planOrganization } from "../src/planner.js";
import { getDefaultRules } from "../src/rules.js";

// Each case is [url, title, expected group]. These guard the default order:
// app sites, then topic phrases, then content sites.
const cases = [
  ["https://mail.google.com/mail/u/0/", "Unreal Engine 5.6 release notes - Gmail", "Communication"],
  ["https://app.slack.com/client/T1", "", "Communication"],
  ["https://docs.google.com/document/d/x", "Shader notes - Google Docs", "Docs"],
  ["https://www.youtube.com/watch?v=1", "Unreal Engine 5 GAS tutorial - YouTube", "Development"],
  ["https://www.reddit.com/r/unrealengine/", "r/unrealengine: Unreal Engine", "Development"],
  ["https://claude.ai/chat/1", "C++ move semantics - Claude", "Development"],
  ["https://claude.ai/chat/2", "Weeknight recipes - Claude", "AI"],
  ["https://github.com/foo/bar", "", "Development"],
  ["https://dev.epicgames.com/documentation/en-us/unreal-engine", "", "Development"],
  ["https://forums.unrealengine.com/t/x", "", "Development"],
  ["http://localhost:5173/", "", "Development"],
  ["https://docs.aws.amazon.com/ec2/", "", "Development"],
  ["https://scholar.google.com/scholar?q=x", "", "Research"],
  ["https://en.wikipedia.org/wiki/Tab", "", "Research"],
  ["https://library.mit.edu/", "", "School"],
  ["https://canvas.instructure.com/courses/1", "", "School"],
  ["https://store.steampowered.com/app/1", "", "Gaming"],
  ["https://store.epicgames.com/en-US/", "", "Gaming"],
  ["https://www.twitch.tv/x", "", "Gaming"],
  ["https://www.youtube.com/watch?v=3", "Trust the process - YouTube", "Media"],
  ["https://open.spotify.com/track/1", "", "Media"],
  ["https://old.reddit.com/r/x", "Gameplay programming tips", "Social"],
  ["https://x.com/user", "", "Social"],
  ["https://news.ycombinator.com/", "", "News"],
  ["https://www.bbc.co.uk/news", "", "News"],
  ["https://www.amazon.com/dp/1", "", "Shopping"],
  ["https://aws.amazon.com/", "", undefined],
  ["https://www.microsoft.com/", "", undefined],
  ["https://www.idea.com/", "", undefined],
  ["about:newtab", "New Tab", undefined],
];

test("routes sample tabs to the expected default group", () => {
  const rules = getDefaultRules();

  for (const [url, title, expected] of cases) {
    const actual = rules.find((rule) => matchesRule(rule, { url, title }))?.name;
    assert.equal(actual, expected, `${url} "${title}"`);
  }
});

test("same-name default rules plan one group", () => {
  const plan = planOrganization({
    focusedWindowId: 1,
    windows: [{
      id: 1,
      groups: [],
      tabs: [
        { id: 1, index: 0, active: true, groupId: -1, url: "https://github.com/a/b", title: "" },
        { id: 2, index: 1, groupId: -1, url: "https://www.youtube.com/watch?v=1", title: "Unreal Engine tutorial" },
      ],
    }],
  }, getDefaultRules());

  assert.deepEqual(
    plan.newGroups.map((group) => [group.title, group.tabMoves.map((move) => move.tabId)]),
    [["Development", [1, 2]]],
  );
});
