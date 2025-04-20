import {
    createSettings,
    getSettings,
    isFFmpegPresent,
    isSettingsPresent,
    isYtDlpPresent,
    createDownloadsDataFolder,
    getPublicIp,
    isOnline,
    getLatestYtDlpVersion,
    parseDotDate,
    createVideoIdFolder,
    updateUrlHistory,
    updateDownloadLocationHistory,
    updateExtraCommandsHistory,
    updateDefaultFormat,
    updateDefaultDownloadLocation,
    readJson,
    runCommandWithOutput,
} from "./utils/appUtils.js";

import {
    createYoutubePlaylistUrl,
    createYoutubeVideoUrl,
    getYoutubePlaylistId,
    getYoutubeVideoId,
    isYoutube,
    isYoutubeVideo,
} from "./utils/youtubeUtils.js";
import {
    createVideoInfoJsonFromYtDlp,
    getFormatsFromInfoJson,
} from "./utils/ytdlpUtils.js";
import { printDivider, printDividerWithText } from "./utils/shellUtils.js";
import {
    APP_FOLDER,
    SETTINGS,
    SETTINGS_PATH,
    DOWNLOADS_DATA_FOLDER,
    setAppSettings,
    INFO_JSON_PATH,
} from "./globals.js";

import process from "process";
import chalk from "chalk";
import isUrl from "is-url";
import { input, select, Separator, confirm } from "@inquirer/prompts";
import yoctoSpinner from "yocto-spinner";
import path from "path";

let PUBLIC_IP;

let isYtDlpInstalled;
let isFfmpegInstalled;
let isConnectedToInternet;

let spinner;

let args = [];

async function updateSettings() {
    const settingsData = await getSettings();
    setAppSettings(settingsData);
}

async function init() {
    if (isSettingsPresent(SETTINGS_PATH)) {
        await updateSettings();
    } else {
        isYtDlpInstalled = await isYtDlpPresent();
        isFfmpegInstalled = await isFFmpegPresent();
        if (!isYtDlpInstalled) {
            console.error("yt-dlp is not installed.");
            process.exit(0);
        } else {
            console.log("yt-dlp is installed.");
        }

        if (!isFfmpegInstalled) {
            console.error("ffmpeg is not installed.");
            process.exit(0);
        } else {
            console.log("ffmpeg is installed.");
        }

        if (isYtDlpInstalled && isFfmpegInstalled) {
            await createDownloadsDataFolder(DOWNLOADS_DATA_FOLDER);
            await createSettings(
                SETTINGS_PATH,
                APP_FOLDER,
                DOWNLOADS_DATA_FOLDER
            );
            await updateSettings();
        }
    }
}

// ----- INIT BEGIN -----
console.clear();
printDividerWithText("YTDLP-Interactive", "greenBright", "yellowBright");
await init();
// ----- INIT END -----

// ------ BEGIN CHECK IF CONNECTED TO INTERNET -----
isConnectedToInternet = await isOnline();

if (!isConnectedToInternet) {
    console.error("You are not connected to the internet.");
    process.exit(0);
}
// ----- END CHECK IF CONNECTED TO INTERNET -----

// ----- BEGIN GET PUBLIC IP -----
PUBLIC_IP = await getPublicIp();
console.log(`Your Public IP: ${PUBLIC_IP}`);
// ----- END GET PUBLIC IP -----

// ----- BEGIN CHECK YTDLP LATEST VERSION -----
const latestYtDlpVersion = await getLatestYtDlpVersion();
console.log(`Latest yt-dlp version: ${latestYtDlpVersion}`);

if (parseDotDate(latestYtDlpVersion) > parseDotDate(SETTINGS.ytdlp_version)) {
    console.log(chalk.yellowBright("Update available."));
    console.log(
        chalk.yellowBright(
            `Download latest version from: https://github.com/yt-dlp/yt-dlp/releases or use yt-dlp -U`
        )
    );
} else {
    console.log(chalk.greenBright("You are using the latest version."));
}
// ----- END CHECK YTDLP LATEST VERSION -----

printDivider("greenBright");

async function getAndValidateUserInput(defaultInput = "") {
    const userEnteredUrl = await input({
        message: "Enter URL: ",
        default: defaultInput,
    });
    if (!isUrl(userEnteredUrl)) {
        console.log(chalk.redBright("Invalid URL."));
        process.exit(0);
    }
    if (!isYoutube(userEnteredUrl)) {
        console.log(chalk.redBright("Currently only youtube supported"));
        process.exit(0);
    }
    if (!isYoutubeVideo(userEnteredUrl)) {
        console.log(chalk.redBright("Enter a valid youtube VIDEO URL."));
        process.exit(0);
    }

    return userEnteredUrl;
}

async function getSelectedFormat() {
    const { allFormats, audioFormats, videoFormats } =
        await getFormatsFromInfoJson();
    let format = SETTINGS.default_format;
    console.log(
        chalk.cyanBright(
            `Default format: ${
                format === "bv+ba" ? "Best Video + Best Audio" : format.info
            }`
        )
    );

    const useDefaultFormat = await confirm({ message: "Use default format?" });
    if (!useDefaultFormat) {
        const selectedFormat = await select({
            message: chalk.yellowBright("Select a Format:"),
            choices: [
                new Separator(chalk.yellowBright("Formats")),
                ...allFormats,
                new Separator(chalk.yellowBright("Audio Formats")),
                ...audioFormats,
                new Separator(chalk.yellowBright("Video Formats")),
                ...videoFormats,
            ],
        });
        format = selectedFormat;
        const setDefaultFormat = await confirm(
            { message: "Set this format as default?" },
            { defaultValue: false }
        );
        if (setDefaultFormat) {
            await updateDefaultFormat(selectedFormat);
            await updateSettings();
        }
    }
    return format;
}

async function getSelectedDownloadLocation() {
    let downloadLocation = SETTINGS.default_download_location;
    console.log(
        chalk.cyanBright(`\nDefault download location: ${downloadLocation}`)
    );
    const useDefaultDownloadLocation = await confirm({
        message: "Use default download location?",
    });
    if (!useDefaultDownloadLocation) {
        const CHOOSE_CUSTOM = "Enter a custom location...";
        let selectedDownloadLocation = await select({
            message: chalk.yellowBright("Select an option:"),
            choices: [
                CHOOSE_CUSTOM,
                new Separator(chalk.yellowBright("Download Locations")),
                ...SETTINGS.download_location_history,
            ],
        });
        if (selectedDownloadLocation === CHOOSE_CUSTOM) {
            selectedDownloadLocation = await input({
                message: chalk.cyan("Enter your custom download path:"),
            });
        }
        downloadLocation = selectedDownloadLocation;
        const setDefaultDownloadLocation = await confirm(
            { message: "Set this download location as default?" },
            { defaultValue: false }
        );
        if (setDefaultDownloadLocation) {
            await updateDefaultDownloadLocation(selectedDownloadLocation);
            await updateSettings();
        }
    }
    return downloadLocation;
}

function updateArgs(pre, val) {
    const indexOfPre = args.indexOf(pre);
    if (indexOfPre === -1) {
        args.push(pre, val);
    } else {
        const indexOfVal = indexOfPre + 1;
        args.splice(indexOfVal, 1, val);
    }
}

async function startDownload(
    selectedDownloadLocation,
    selectedFormat,
    startTime,
    endTime,
    save_in_channel_folder = false,
    save_in_video_title_folder = false
) {
    function updateOutputTemplate() {
        let outputTemplate = "%(title)s";
        if (save_in_channel_folder && !save_in_video_title_folder) {
            outputTemplate = path.join("%(channel)s", outputTemplate);
        } else if (save_in_video_title_folder && !save_in_channel_folder) {
            outputTemplate = path.join("%(title)s", outputTemplate);
        } else if (save_in_video_title_folder && save_in_channel_folder) {
            outputTemplate = path.join(
                "%(channel)s",
                "%(title)s",
                outputTemplate
            );
        }
        outputTemplate = outputTemplate + `_${selectedFormat.info}`;
        if (startTime && !endTime) {
            outputTemplate = outputTemplate + ` [${startTime} -]`;
        } else if (startTime && endTime) {
            outputTemplate = outputTemplate + ` [${startTime} - ${endTime}]`;
        }
        outputTemplate = outputTemplate + ".%(ext)s";
        updateArgs("-o", path.join(selectedDownloadLocation, outputTemplate));
        console.log(args);
    }
    updateOutputTemplate();
    await runCommandWithOutput(args, true);
}

try {
    while (true) {
        // ----- BEGIN DISPLAY SOME SETTINGS INFO -----
        console.log();
        console.log(
            chalk.blueBright(`URL History: ${SETTINGS.url_history.length}`)
        );
        console.log(
            chalk.blueBright(
                `Download Location History: ${SETTINGS.download_location_history.length}`
            )
        );
        console.log(
            chalk.blueBright(
                `Extra Commands History: ${SETTINGS.extra_commands_history.length}`
            )
        );
        console.log(
            chalk.blueBright(
                `Downloads History: ${SETTINGS.downloads_history.length}`
            )
        );
        // ----- END DISPLAY SOME SETTINGS INFO -----

        // ----- BEGIN INITIALIZE BASE ARGS -----
        args = [];
        args.push(SETTINGS.ytdlp_path);
        args.push("--ffmpeg-location");
        args.push(SETTINGS.ffmpeg_path);
        // ----- END INITIALIZE BASE ARGS -----

        // ----- BEGIN ENTER URL AND VALIDATE URL -----
        console.log();
        let userInputArg;
        if (process.argv.length > 2) {
            userInputArg = process.argv[2];
        }
        const userEnteredUrl = await getAndValidateUserInput(userInputArg);
        // ----- BEGIN ENTER URL AND VALIDATE URL -----

        printDividerWithText("Youtube", "redBright", "redBright");

        // ----- BEGIN GET BASIC YOUTUBE RELATED DATA -----
        const videoId = getYoutubeVideoId(userEnteredUrl);
        console.log(`Video ID: ${chalk.green(videoId)}`);

        const playlistId = getYoutubePlaylistId(userEnteredUrl);
        console.log(`Playlist ID: ${chalk.green(playlistId || "N/A")}`);

        const videoUrl = createYoutubeVideoUrl(videoId);
        console.log(`Video URL: ${chalk.green(videoUrl)}`);

        if (playlistId) {
            const playlistUrl = createYoutubePlaylistUrl(playlistId);
            console.log(`Playlist URL: ${chalk.green(playlistUrl)}`);
        }
        // ----- END GET BASIC YOUTUBE RELATED DATA -----

        spinner = new yoctoSpinner({
            text: "Fetching video metadata...",
        }).start();

        // ----- BEGIN CREATE INFO JSON -----
        await createVideoIdFolder(videoId);
        await createVideoInfoJsonFromYtDlp(videoId, videoUrl);
        await updateUrlHistory();
        await updateSettings();

        args.push("--load-info-json", INFO_JSON_PATH);
        // ----- END CREATE INFO JSON -----

        spinner.success("Fetched video metadata.");

        const videoInfoJson = await readJson(INFO_JSON_PATH);
        console.log(chalk.redBright(`\n${videoInfoJson.fulltitle}\n`));

        // ----- BEGIN SELECT FORMAT -----
        console.log();
        const selectedFormat = await getSelectedFormat();
        console.log(
            chalk.greenBright(
                `Selected Format: ${
                    typeof selectedFormat === "string"
                        ? selectedFormat
                        : selectedFormat.info
                }`
            )
        );

        if (selectedFormat.media === "audio") {
            updateArgs(
                "-f",
                typeof selectedFormat === "string"
                    ? selectedFormat
                    : selectedFormat.id
            );
        } else {
            updateArgs(
                "-f",
                `${
                    typeof selectedFormat === "string"
                        ? selectedFormat + "+ba"
                        : selectedFormat.id + "+ba"
                }`
            );
        }
        // ----- END SELECT FORMAT -----

        // ----- BEGIN SELECT DOWNLOAD LOCATION -----
        const selectedDownloadLocation = await getSelectedDownloadLocation();
        console.log(
            chalk.greenBright(
                `Selected Download Location: ${selectedDownloadLocation}`
            )
        );
        // updateArgs("-o", selectedDownloadLocation);
        // ----- END SELECT DOWNLOAD LOCATION -----

        // ----- BEGIN EXTRA OPTIONS -----
        console.log();
        const startAndEndTime = await input({
            message: "Download section of video? [start end]",
        });
        let startTime;
        let endTime;
        if (startAndEndTime) {
            startTime = startAndEndTime.split(" ")[0];
            if (startAndEndTime.includes(" ")) {
                endTime = startAndEndTime.split(" ")[1];
            }
            if (endTime) {
                console.log(
                    chalk.greenBright(
                        `Start and End time : ${startTime} - ${endTime}`
                    )
                );
                updateArgs("--download-sections", `*${startTime}-${endTime}`);
                args.push("--force-keyframes-at-cuts");
            } else {
                console.log(
                    chalk.greenBright(
                        `Start and End time : ${startAndEndTime} - inf`
                    )
                );
                updateArgs("--download-sections", `*${startTime}-inf`);
                args.push("--force-keyframes-at-cuts");
            }
        } else {
            console.log(chalk.greenBright(`Skipping download sections`));
        }
        // ----- END EXTRA OPTIONS -----

        // ----- BEGIN ENTER EXTRA COMMANDS -----
        console.log();
        const extraCommands = await input({
            message: "Enter Extra Commands: ",
        });
        if (extraCommands.length > 0) {
            const extraCommandsArr = extraCommands.trim().split(" ");
            args.concat(extraCommandsArr);
        }
        console.log(
            chalk.greenBright(
                `Extra Commands: ${
                    extraCommands.length > 0
                        ? extraCommands
                        : "No extra commands"
                }`
            )
        );
        // ----- END ENTER EXTRA COMMANDS -----

        // ----- START DOWNLOAD -----
        console.log();
        const confirmStartDownload = await confirm({
            message: "Start Download?",
        });
        if (!confirmStartDownload) {
            process.exit(0);
        }
        await updateDownloadLocationHistory(selectedDownloadLocation.trim());
        if (extraCommands.length > 0) {
            await updateExtraCommandsHistory(extraCommands.trim());
        }
        await updateSettings();

        await startDownload(
            selectedDownloadLocation,
            selectedFormat,
            startTime,
            endTime
        );
        // ----- END DOWNLOAD -----
    }
} catch (err) {
    if (err instanceof Error && err.name === "ExitPromptError") {
        console.log(chalk.greenBright("\nClosed by user"));
        process.exit(0);
    } else {
        console.error("Unexpected error:", err);
        process.exit(1);
    }
}
