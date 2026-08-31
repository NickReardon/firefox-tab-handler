import { handleSpikeMessage } from "./spike.js";

browser.runtime.onMessage.addListener((message) =>
  handleSpikeMessage(browser, message),
);

console.info("Firefox Tab Organizer API spike ready.");
