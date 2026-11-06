import { Capacitor } from "@capacitor/core";

/** True inside the Capacitor Android shell; false in any browser, including the deployed site. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
