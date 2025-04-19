import path from "path";
import { readJson, runCommandWithOutput, sanitizeFilename, writeFile, writeJson } from "./appUtils.js";
import { SETTINGS, INFO_JSON_PATH, DOWNLOADS_DATA_FOLDER, setInfoJsonPath } from "../globals.js";
import fs from "fs";



function convertTimestamp(timestamp) {
    const dateObj = new Date(timestamp * 1000);
    return dateObj.toLocaleString();
}

async function addExpireTime() {
    const infoJson = await readJson(INFO_JSON_PATH);
    const firstObjWithManifest = infoJson.formats.find((format) => {
        return format.hasOwnProperty("manifest_url");
    });
    const manifestUrl = firstObjWithManifest.manifest_url;
    const manifestUrlArr = manifestUrl.split('/')
    const expireTimestamp = manifestUrlArr[manifestUrlArr.indexOf('expire') + 1];
    const expireLocaleString = convertTimestamp(expireTimestamp);

    infoJson.expire_timestamp = expireTimestamp;
    infoJson.expire_locale_string = expireLocaleString;

    await writeJson(INFO_JSON_PATH, infoJson);
}

async function downloadImage(url, path) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(path, buffer);
    } catch (err) {
        throw new Error(`Failed to download image: ${err.message}`);
    }
}

async function downloadYoutubeThumbnail() {
    const infoJson = await readJson(INFO_JSON_PATH);
    const thumbnailUrl = infoJson.thumbnail;
    const sanitizedTitle = sanitizeFilename(infoJson.fulltitle);
    const thumbnailPath = path.join(DOWNLOADS_DATA_FOLDER, infoJson.id, `${sanitizedTitle}.thumbnail.jpg`);
    await downloadImage(thumbnailUrl, thumbnailPath);
}

async function writeDescription() {
    const infoJson = await readJson(INFO_JSON_PATH);
    const description = infoJson.description;
    const sanitizedTitle = sanitizeFilename(infoJson.fulltitle);
    const descriptionPath = path.join(DOWNLOADS_DATA_FOLDER, infoJson.id, `${sanitizedTitle}.description.txt`);
    await writeFile(descriptionPath, description);
}

export async function createVideoInfoJsonFromYtDlp(videoId, videoUrl) {
    const outputFolder = path.join(DOWNLOADS_DATA_FOLDER, videoId, videoId);
    setInfoJsonPath(outputFolder + ".info.json");

    async function create() {
        const commandsArray = [];

        commandsArray.push(SETTINGS.ytdlp_path);
        commandsArray.push('--skip-download');
        commandsArray.push('-o');
        commandsArray.push(outputFolder);
        commandsArray.push('--write-info-json');
        commandsArray.push(videoUrl);

        await runCommandWithOutput(commandsArray);
        await addExpireTime();
        await downloadYoutubeThumbnail();
        await writeDescription();
    }

    if (!fs.existsSync(INFO_JSON_PATH)) {
        await create();
    }
    else if (fs.existsSync(INFO_JSON_PATH)) {
        const infoJson = await readJson(INFO_JSON_PATH);
        const nowTimestamp = new Date();
        if (nowTimestamp > new Date(infoJson.expire_timestamp * 1000)) {
            await create();
        }
    }
}

export async function getFormatsFromInfoJson() {

    function constructFormats(formats) {
        return formats.map((format) => {
            return {
                name: format.format,
                value: format.format_id,
                description: `Language : ${format.language ? format.language : 'N/A'} | Resolution : ${format.resolution ? format.resolution : 'N/A'} | Video Ext : ${format.video_ext ? format.video_ext : 'N/A'} | Audio Ext : ${format.audio_ext ? format.audio_ext : 'N/A'} | Vcodec : ${format.vcodec ? format.vcodec : 'N/A'} | Acodec : ${format.acodec ? format.acodec : 'N/A'} | VBR : ${format.vbr ? format.vbr : 'N/A'} | ABR : ${format.abr ? format.abr : 'N/A'}`
            };
        });
    }

    const infoJson = await readJson(INFO_JSON_PATH);
    let allFormats = infoJson.formats.filter((format) => {
        return format.format_note !== "storyboard";
    });
    let audioFormats = allFormats.filter((format) => {
        return format.format.includes("audio");
    });
    let videoFormats = allFormats.filter((format) => {
        return !format.format.includes("audio");
    });
    allFormats = constructFormats(allFormats);
    audioFormats = constructFormats(audioFormats);
    videoFormats = constructFormats(videoFormats);

    return { allFormats, audioFormats, videoFormats };
}