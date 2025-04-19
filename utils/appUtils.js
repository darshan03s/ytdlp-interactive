import { exec } from 'child_process';
import fs from "fs";
import process from 'process';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import dns from 'dns';
import * as cheerio from 'cheerio';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { INFO_JSON_PATH, SETTINGS_PATH, DOWNLOADS_DATA_FOLDER } from '../globals.js';

export function execCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export function runCommandWithOutput(cmdArray) {
    return new Promise((resolve, reject) => {
        const [command, ...args] = cmdArray;
        // console.log(chalk.yellowBright(`\nRunning command: ${command} ${args.join(' ')}\n`));
        const child = spawn(command, args, {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            // console.log(output);
        });

        child.stderr.on('data', (data) => {
            console.log(chalk.red('STDERR: '));
            const output = data.toString();
            stderr += output;
            // console.error(chalk.red(output));
        });

        child.on('close', code => {
            if (code === 0) {
                resolve(stdout);
            } else {
                console.log(chalk.red('On close error: '));
                console.error(`Command failed with code ${code}`);
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });

        child.on('error', err => {
            console.log(chalk.red('On error: '));
            console.error(err.message);
            reject(err);
        });
    });
}


export async function isYtDlpPresent() {
    try {
        await execCommand('yt-dlp --version');
        return true;
    } catch {
        return false;
    }
}

export async function isFFmpegPresent() {
    try {
        await execCommand('ffmpeg -version');
        return true;
    } catch {
        return false;
    }
}

export async function getYtDlpPath() {
    const isWindows = getPlatform() === 'win32';
    const command = isWindows ? 'where yt-dlp' : 'which yt-dlp';

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error || !stdout.trim()) {
                reject(new Error('yt-dlp not found on system.'));
            } else {
                // On Windows, `where` can return multiple paths (e.g., .exe and docs); pick the first valid .exe
                const lines = stdout.trim().split('\n').map(line => line.trim());
                const exePath = lines.find(line => line.toLowerCase().endsWith('yt-dlp.exe') || line.includes('yt-dlp.exe'));

                if (!exePath) {
                    reject(new Error('ffmpeg executable not found in output.'));
                } else {
                    resolve(exePath);
                }
            }
        });
    });
}

export async function getYtDlpVersion() {
    return await execCommand('yt-dlp --version');
}


export async function getFFmpegPath() {
    const isWindows = getPlatform() === 'win32';
    const command = isWindows ? 'where ffmpeg' : 'which ffmpeg';

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout) => {
            if (error || !stdout.trim()) {
                reject(new Error('ffmpeg not found on system.'));
            } else {
                // On Windows, `where` can return multiple paths (e.g., .exe and docs); pick the first valid .exe
                const lines = stdout.trim().split('\n').map(line => line.trim());
                const exePath = lines.find(line => line.toLowerCase().endsWith('ffmpeg.exe') || line.includes('ffmpeg.exe'));

                if (!exePath) {
                    reject(new Error('ffmpeg executable not found in output.'));
                } else {
                    resolve(exePath);
                }
            }
        });
    });
}


export async function getFFmpegVersion() {
    let res = await execCommand('ffmpeg -version');
    res = res.split('\n')[0];
    return res;
}

export async function readJson(path) {
    const content = await fs.promises.readFile(path, 'utf8');
    try {
        return JSON.parse(content);
    } catch (err) {
        throw new Error(`Failed to parse JSON from ${path}: ${err.message}`);
    }
}

export async function writeJson(path, data) {
    const json = JSON.stringify(data, null, 2);
    try {
        await fs.promises.writeFile(path, json, 'utf8');
    } catch (err) {
        throw new Error(`Failed to write JSON to ${path} : ${err.message}`)
    }
}

export async function readFile(path) {
    const content = await fs.promises.readFile(path, 'utf8');
    try {
        return content;
    } catch (err) {
        throw new Error(`Failed to read content from ${path}: ${err.message}`);
    }
}

export async function writeFile(path, data) {
    try {
        await fs.promises.writeFile(path, data, 'utf8');
    } catch (err) {
        throw new Error(`Failed to write data to ${path} : ${err.message}`)
    }
}

function getUserDownloadsPath() {
    return path.join(process.env.USERPROFILE, 'Downloads');
}

export async function createSettings(SETTINGS_PATH, APP_FOLDER, DOWNLOADS_DATA_FOLDER) {
    const settings = {};

    try {
        settings.ytdlp_path = await getYtDlpPath();
        settings.ffmpeg_path = await getFFmpegPath();
        settings.ytdlp_version = await getYtDlpVersion();
        settings.ytdlp_version_latest = "";
        settings.ffmpeg_version = await getFFmpegVersion();
        settings.platform = getPlatform();
        settings.app_folder = APP_FOLDER;
        settings.downloads_data_folder = DOWNLOADS_DATA_FOLDER;
        settings.user_downloads_location = getUserDownloadsPath();
        settings.default_download_location = getUserDownloadsPath();
        settings.url_history = [];
        settings.download_location_history = [];
        settings.download_location_history.push(settings.user_downloads_location);
        settings.extra_commands_history = [];
        settings.downloads_history = [];
        settings.default_format = 'bv+ba';
        settings.last_fetched_ytdlp_version_at = "";

        await writeJson(SETTINGS_PATH, settings);
        console.log("Settings written successfully.");
    } catch (err) {
        console.error("Failed to create settings:", err.message);
    }
}

export function isSettingsPresent(SETTINGS_PATH) {
    if (fs.existsSync(SETTINGS_PATH)) {
        return true;
    }
    return false;
}

export async function getSettings() {
    return await readJson(SETTINGS_PATH);
}

export function getPlatform() {
    return process.platform;
}

export function getAppFolder(metaUrl) {
    const __filename = fileURLToPath(metaUrl);
    const __dirname = dirname(__filename);
    return __dirname;
}

export async function createDownloadsDataFolder(folderPath) {
    try {
        await fs.promises.mkdir(folderPath, { recursive: true });
        console.log("Downloads data folder created successfully.");
    } catch (err) {
        console.error("Failed to create folder:", err.message);
    }
}

export async function createVideoIdFolder(videoId) {
    try {
        await fs.promises.mkdir(path.join(DOWNLOADS_DATA_FOLDER, videoId), { recursive: true });
        // console.log("Folder for video ID created successfully.");
    } catch (err) {
        console.error("Failed to create folder:", err.message);
    }
}

export async function getPublicIp() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (!res.ok) {
            throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
        return data.ip;
    } catch (err) {
        console.error('Failed to fetch public IP:', err.message);
        return null;
    }
}

export async function isOnline() {
    return new Promise((resolve) => {
        dns.lookup('google.com', (err) => {
            resolve(!err);
        });
    });
}

export function parseDotDate(str) {
    const [year, month, day] = str.split('.').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
}

export async function getLatestYtDlpVersion() {
    const settings = await readJson(SETTINGS_PATH);
    const lastFetchedYtDlpVersionAt = settings.last_fetched_ytdlp_version_at;
    const dateObjNow = new Date();
    if ((dateObjNow.getHours() - new Date(lastFetchedYtDlpVersionAt).getHours()) < 1) {
        return settings.ytdlp_version_latest;
    }
    const url = 'https://github.com/yt-dlp/yt-dlp/releases';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

        const html = await res.text();
        const $ = cheerio.load(html);
        const latestVersion = $('a[href^="/yt-dlp/yt-dlp/releases/tag/"]').first().text(); // yt-dlp version;
        settings.ytdlp_version_latest = latestVersion.split(' ')[1];
        settings.last_fetched_ytdlp_version_at = dateObjNow.toISOString();
        await writeJson(SETTINGS_PATH, settings);
        return latestVersion.split(' ')[1];
    } catch (error) {
        console.error('Failed to fetch latest yt-dlp version:', error.message);
        return null;
    }
}

export async function updateUrlHistory() {
    const settings = await readJson(SETTINGS_PATH);
    const infoJson = await readJson(INFO_JSON_PATH);

    const sanitizedFilename = sanitizeFilename(infoJson.fulltitle);
    const thumbnailPath = path.join(DOWNLOADS_DATA_FOLDER, infoJson.id, `${sanitizedFilename}.thumbnail.jpg`);
    const thumbnailLocal = `file://${thumbnailPath.replace(/\\/g, '/')}`;

    const urlHistoryObj = {};
    urlHistoryObj.url = infoJson.webpage_url;
    urlHistoryObj.thumbnail = infoJson.thumbnail;
    urlHistoryObj.title = infoJson.fulltitle;
    urlHistoryObj.thumbnail_local = thumbnailLocal;

    const indexOfUrl = settings.url_history.findIndex(item => item.url === urlHistoryObj.url);

    if (indexOfUrl === -1) {
        settings.url_history.unshift(urlHistoryObj);
    } else {
        settings.url_history.splice(indexOfUrl, 1);
        settings.url_history.unshift(urlHistoryObj);
    }

    await writeJson(SETTINGS_PATH, settings);
}

export async function updateDownloadLocationHistory(selectedDownloadLocation) {
    const settings = await readJson(SETTINGS_PATH);
    const downloadLocationHistory = settings.download_location_history;

    const indexOfDownloadLocation = downloadLocationHistory.findIndex(item => item === selectedDownloadLocation);

    if (indexOfDownloadLocation === -1) {
        downloadLocationHistory.unshift(selectedDownloadLocation);
    } else {
        downloadLocationHistory.splice(indexOfDownloadLocation, 1);
        downloadLocationHistory.unshift(selectedDownloadLocation);
    }

    settings.download_location_history = downloadLocationHistory;
    await writeJson(SETTINGS_PATH, settings);
}

export async function updateExtraCommandsHistory(extraCommands) {
    const settings = await readJson(SETTINGS_PATH);
    const extraCommandsHistory = settings.extra_commands_history;

    const indexOfExtraCommands = extraCommandsHistory.findIndex(item => item === extraCommands);

    if (indexOfExtraCommands === -1) {
        extraCommandsHistory.unshift(extraCommands);
    } else {
        extraCommandsHistory.splice(indexOfExtraCommands, 1);
        extraCommandsHistory.unshift(extraCommands);
    }

    settings.extra_commands_history = extraCommandsHistory;
    await writeJson(SETTINGS_PATH, settings);
}

export async function updateDefaultFormat(format) {
    const settings = await readJson(SETTINGS_PATH);
    settings.default_format = format;
    await writeJson(SETTINGS_PATH, settings);
}

export async function updateDefaultDownloadLocation(downloadLocation) {
    const settings = await readJson(SETTINGS_PATH);
    settings.default_download_location = downloadLocation;
    await writeJson(SETTINGS_PATH, settings);
}

export function sanitizeFilename(filename) {
    return filename.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 50);
}