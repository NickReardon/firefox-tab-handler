import { planOrganization } from "./planner.js";
import { snapshotBrowser } from "./spike.js";

export function handleBackgroundMessage(api, message) {
  if (message?.type !== "planner:preview") {
    return undefined;
  }

  return snapshotBrowser(api).then((snapshot) => planOrganization(snapshot));
}

browser.runtime.onMessage.addListener((message) =>
  handleBackgroundMessage(browser, message),
);

console.info("Firefox Tab Organizer preview ready.");
