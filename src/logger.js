const DEBUG_KEY = "debugLogging";
const PREFIX = "[Firefox Tab Organizer]";

export async function getDebugLogging(api) {
  const stored = await api.storage.local.get(DEBUG_KEY);
  return stored[DEBUG_KEY] === true;
}

export async function setDebugLogging(api, enabled) {
  if (typeof enabled !== "boolean") {
    throw new TypeError("Debug logging must be true or false.");
  }

  await api.storage.local.set({ [DEBUG_KEY]: enabled });
  console.info(`${PREFIX} Debug logging ${enabled ? "enabled" : "disabled"}.`);
  return enabled;
}

export async function createDebugLogger(api, sink = console.info) {
  const enabled = await getDebugLogging(api);

  return (event, details = {}) => {
    if (enabled) {
      sink(`${PREFIX} ${event}`, details);
    }
  };
}
