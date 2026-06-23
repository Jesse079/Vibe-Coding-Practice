import type { AppEvent, AppState } from "../types";

export const initialAppState: AppState = {
  mode: "idle",
  requiresPinchRelease: false,
};

export function transitionAppState(
  state: AppState,
  event: AppEvent,
): AppState {
  switch (state.mode) {
    case "idle":
      if (event.type === "OPEN_PALM_READY") {
        return { mode: "configuring", requiresPinchRelease: false };
      }
      if (event.type === "PINCH_STARTED" && !state.requiresPinchRelease) {
        return { mode: "drawing", requiresPinchRelease: false };
      }
      if (event.type === "PINCH_ENDED" && state.requiresPinchRelease) {
        return { ...state, requiresPinchRelease: false };
      }
      return state;

    case "configuring":
      if (event.type === "CONFIG_COMPLETED" || event.type === "CANCEL") {
        return { mode: "idle", requiresPinchRelease: true };
      }
      return state;

    case "drawing":
      if (event.type === "PINCH_ENDED" || event.type === "CANCEL") {
        return { mode: "idle", requiresPinchRelease: false };
      }
      return state;
  }
}

