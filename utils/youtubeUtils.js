export const isYoutube = (url) => {
    try {
        const { hostname } = new URL(url);
        return (
            hostname === "www.youtube.com" ||
            hostname === "youtube.com" ||
            hostname === "m.youtube.com" ||
            hostname === "youtu.be" ||
            hostname === "www.youtu.be" ||
            hostname === "youtube-nocookie.com" ||
            hostname === "www.youtube-nocookie.com"
        );
    } catch (e) {
        console.log(e);
        return false;
    }
};

export const isYoutubeVideo = (url) => {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;

        const YT_HOSTS = [
            "www.youtube.com",
            "youtube.com",
            "m.youtube.com",
            "youtu.be",
            "youtube-nocookie.com",
            "www.youtube-nocookie.com",
        ];

        if (!YT_HOSTS.includes(hostname)) return false;

        const pathname = parsed.pathname;
        const searchParams = parsed.searchParams;

        // 1. youtu.be short links: /VIDEO_ID
        if (hostname === "youtu.be" && pathname.length > 1) {
            return true;
        }

        // 2. watch URL with ?v=...
        if (pathname === "/watch" && searchParams.has("v")) {
            return true;
        }

        // 3. embed, shorts, or live paths
        const YT_PATH_PREFIXES = ["/embed/", "/shorts/"];
        if (YT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
            return true;
        }

        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
};

export const getYoutubeVideoId = (url) => {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;
        const pathname = parsed.pathname;
        const searchParams = parsed.searchParams;

        // Case 1: youtu.be short link
        // e.g., https://youtu.be/VIDEO_ID
        if (hostname === "youtu.be") {
            const id = pathname.slice(1).split("/")[0]; // removes leading slash and avoids extra segments
            return isValidYoutubeId(id) ? id : null;
        }

        // Case 2: /watch?v=VIDEO_ID
        if (
            (pathname === "/watch" || pathname === "/watch/") &&
            searchParams.has("v")
        ) {
            const id = searchParams.get("v");
            return isValidYoutubeId(id) ? id : null;
        }

        // Case 3: /embed/VIDEO_ID or /shorts/VIDEO_ID or /live/VIDEO_ID
        const embedLikeMatch = pathname.match(/^\/(embed|shorts)\/([^/?#&]+)/);
        if (embedLikeMatch && embedLikeMatch[2]) {
            const id = embedLikeMatch[2];
            return isValidYoutubeId(id) ? id : null;
        }

        // Case 4: weird URLs with v= in fragments or params
        const vParamInPath = pathname.match(/v=([^&]+)/);
        if (vParamInPath && isValidYoutubeId(vParamInPath[1])) {
            return vParamInPath[1];
        }

        // Case 5: legacy user error or malformed encoding
        for (const [key, value] of searchParams.entries()) {
            if (key.toLowerCase() === "v" && isValidYoutubeId(value)) {
                return value;
            }
        }

        return null;
    } catch (err) {
        console.log(err);
        return null;
    }
};

// Optional helper for stricter validation
export const isValidYoutubeId = (id) => {
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
};

export const getYoutubePlaylistId = (url) => {
    try {
        const parsedUrl = new URL(url);
        const listId = parsedUrl.searchParams.get("list");

        if (!listId) return null;

        // Optional: Validate the playlist ID structure
        const PLAYLIST_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

        if (!PLAYLIST_ID_REGEX.test(listId)) return null;

        return listId;
    } catch (err) {
        console.log(err);
        return null; // not a valid URL
    }
};

export const createYoutubeVideoUrl = (videoId) => {
    if (!videoId) {
        return null;
    }
    return `https://www.youtube.com/watch?v=${videoId}`;
};

export const createYoutubePlaylistUrl = (playListId) => {
    if (!playListId) {
        return null;
    }
    return `https://www.youtube.com/playlist?list=${playListId}`;
};

export const createYoutubeIframeUrl = (videoId, playListId = null) => {
    if (!videoId) {
        return null;
    }
    if (!playListId) {
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return `https://www.youtube.com/embed/${videoId}?list=${playListId}`;
};

export const createYoutubeEmbedIframe = (iframeUrl) => {
    if (!iframeUrl) {
        return null;
    }
    return `<iframe src="${iframeUrl}" style="border: 0;" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
};

export const getYoutubeOembedInfo = async (url) => {
    if (!url) {
        return null;
    }
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
        const data = await response.json();
        return data;
    } catch (err) {
        console.log(err);
        return null;
    }
};