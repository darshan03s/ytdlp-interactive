import { getAppFolder } from "./utils/appUtils.js";
import path from "path";

export const APP_FOLDER = getAppFolder(import.meta.url);
export const SETTINGS_PATH = path.join(APP_FOLDER, 'settings.json');
export const DOWNLOADS_DATA_FOLDER = path.join(APP_FOLDER, 'downloads-data');

export let SETTINGS = {};
export let INFO_JSON_PATH = "";

export function setAppSettings(data) {
    SETTINGS = data;
}

export function setInfoJsonPath(path) {
    INFO_JSON_PATH = path;
}