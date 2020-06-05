import fs from "fs"
import google from "googleapis"
import readline from "readline"
import path from "path"

let youtube = new google.youtube_v3.Youtube()
let auth = "AIzaSyBSaQ8guLySQp6c79oAzW1A0g3Zbqewnvc"
let channelId = "UCeizBL3uMi5YmCsdOF7Z1-w"
let saveLocation = "C:/Users/Ophion/OneDrive/Image Gallery"
let unlistedPlaylists = [
    "PL7zOJSOQKEuAe2bke7KKwrdr31DWj3pnv"
]
let basePath = path.dirname(import.meta.url).substring(8)

async function execute() {
    let videos = await indexPlaylists()
    let folders = indexFolders(saveLocation);
    pairFolders(videos, folders)
    generateFolders(videos)
    generateFirstPage(videos)
    generateSearchIndex(videos)
}
execute()

async function indexPlaylists() {
    const ids = await new Promise((resolve) => {
        process.stdout.write("Fetching all playlists... ")
        youtube.playlists.list({
            auth,
            channelId,
            part: "id",
            maxResults: "10"
        }, (err, success) => {
            process.stdout.write(`${success.data.items.length} results!\n`)
            resolve(success.data.items.map(item => item.id))
        })
    })
    ids.push(...unlistedPlaylists)
    let videoList = []
    let idcounter = 0
    for (let id of ids) {
        idcounter++
        process.stdout.write(`Fetching playlist ${idcounter}/${ids.length}... `)
        let counter = 0
        let newVids = await new Promise(resolve => {
            let snippets = []
            let fetchSnippets = nextPageToken_1 => {
                youtube.playlistItems.list({
                    auth,
                    playlistId: id,
                    part: "snippet,contentDetails",
                    maxResults: "50",
                    pageToken: nextPageToken_1
                }, async (err_1, success_1) => {
                    counter = counter + success_1.data.items.length
                    readline.cursorTo(process.stdout, 0)
                    process.stdout.write(`Fetching playlist ${idcounter}/${ids.length}... ${counter} videos!`)
                    snippets.push(...(success_1.data.items.map(item => {
                        item.snippet.videoPublishedAt = item.contentDetails.videoPublishedAt
                        return item.snippet
                    })))
                    if (success_1.data.nextPageToken != null) {
                        fetchSnippets(success_1.data.nextPageToken)
                    }
                    else {
                        process.stdout.write("\n")
                        resolve(snippets)
                    }
                })
            }
            fetchSnippets()
        })
        videoList.push(...newVids)
    }
    const videos = videoList
    return videos.map(vid => {
        let track = {
            title: vid.title,
            id: vid.resourceId.videoId,
            date: new Date(vid.videoPublishedAt),
            labels: [],
            tracks: [],
            files: {
                tracks: [],
                images: [],
                other: []
            }
        }
        let titleStart = vid.description.indexOf("Music:") + 6
        let title = vid.description.substring(titleStart, vid.description.indexOf("\n", titleStart))
        if (title.length > 0) {
            track.tracks.push(title.trim())
        }
        else {
            vid.description.match(/\d\d:\d\d [-|] /g).forEach(match => {
                titleStart = vid.description.indexOf(match) + 8
                track.tracks.push(vid.description.substring(titleStart, vid.description.indexOf("\n", titleStart)))
            })
        }
        let label = vid.description.match(/Label: (.*) - (.*)\n/)
        if (label != null) {
            label[1].split(" & ").forEach(lab => {
                track.labels.push({
                    name: lab,
                    youtube: label[2]
                })
            })
        } else if (vid.description.includes("Labels:\n")) {
            const startIndex = vid.description.indexOf("Labels:\n")
            const endIndex = vid.description.indexOf("---", startIndex)
            const piece = vid.description.substring(startIndex, endIndex)
            const arr = [...piece.matchAll(/^(.*) - (.*)$/gm)]
            arr.forEach(label => {
                label[1].split(" & ").forEach(lab => {
                    track.labels.push({
                        name: lab,
                        youtube: label[2]
                    })
                })
            })
        }
        return track
    })
}

function indexFolders(dirName) {
    let folders = []

    fs.readdirSync(dirName)
        .filter(dir => fs.lstatSync(dirName + "/" + dir).isDirectory())
        .filter(dir => !dir.includes("[DELETED]"))
        .filter(dir => dir !== "cache")
        .forEach(dir => {
            let entry = {
                name: dir,
                searchterms: [],
                mix: dir.includes(" Mix"),
                video: undefined,
                content: [],
                exact: dir.includes("[EXACT]")
            }
            folders.push(entry)
            if (dir.includes("[")) {
                dir = dir.substring(0, dir.indexOf("[")).trim()
            }

            if (dir.includes(" - ")) {
                entry.searchterms = dir.split(" - ")
            } else {
                entry.searchterms = [dir]
            }

            for (const file of fs.readdirSync(dirName + "/" + entry.name)) {
                entry.content.push(file)
            }
        })

    return folders;
}

function pairFolders(videos, folders) {
    process.stdout.write("Pairing folders with videos... ")
    const videoMap = new Map()
    const titleMap = new Map()
    for (const vid of videos) {
        let index = 1;
        if (!vid.title.startsWith("N")) index = 0
        let tit = vid.title.split(" - ")[index]
        if (tit.includes("[")) {
            tit = tit.split("[")[0]
        }
        tit = tit.trim()
        let titArr = titleMap.get(tit) || []
        titArr.push(vid)
        titleMap.set(tit, titArr)

        for (const track of vid.tracks) {
            let title = track.split(" - ").slice(1).join(" - ")
            if (title.includes("(")) {
                title = title.split("(")[0]
            }
            if (title.includes("[")) {
                title = title.split("[")[0]
            }
            title = title.trim()
            if (title.endsWith("?")) {
                title = title.substring(0, title.length - 1)
            }
            let vidArr = videoMap.get(title) || []
            vidArr.push(vid)
            videoMap.set(title, vidArr)
        }
    }

    for (const folder of folders) {
        let map = videoMap
        if (folder.mix) map = titleMap
        let videoArr = map.get(folder.searchterms[0])
        if (videoArr === undefined) {
            console.error(`Could not find remote pair: ${folder.searchterms.join(" - ")}`)
            continue
        }
        let video
        if (videoArr.length > 1) {
            let searchterms = folder.searchterms.slice(1)
            let matches = []
            for (const video of videoArr) {
                if (video.tracks.length > 1 && !folder.mix) continue
                for (const track of video.tracks) {
                    let add = true
                    for (const term of searchterms) {
                        if (!track.includes(term)) {
                            add = false
                            continue
                        }
                    }
                    if (add && folder.exact && !track.endsWith(folder.searchterms[0])) {
                        add = false
                    }
                    if (add) {
                        matches.push(video)
                        break
                    }

                }
            }
            if (matches.length === 1) {
                video = matches[0]
            } else if (matches.length === 0) {
                console.error(`Failed pairing (no match): ${folder.searchterms.join(" - ")}`)
                console.error(map.get(folder.searchterms[0]))
                continue
            } else {
                console.error(`Ambiguous pairing (no unique match): ${folder.searchterms.join(" - ")}`)
                console.error(map.get(folder.searchterms[0]))
                continue
            }
        } else {
            video = videoArr[0]
        }

        if (video.files.tracks.length + video.files.images.length + video.files.other.length === 0) {
            folder.video = video
            for (const file of folder.content) {
                const type = file.substring(file.lastIndexOf(".")+1)
                switch (type) {
                    case "mp3":
                    case "wav":
                    case "flac":
                        video.files.tracks.push(file)
                        break;
                    case "jpg":
                    case "jpeg":
                    case "png":
                    case "bmp":
                        video.files.images.push(file)
                        break;
                    default:
                        console.error(`Could not index file of unrecognized type: ${file}`)
                }
            }
        } else {
            console.error(`Ambiguous pairing (video already assigned a folder): ${folder.searchterms.join(" - ")}`)
            console.error(map.get(folder.searchterms[0]))
        }
    }

    let errors = false
    for (const folder of folders) {
        if (folder.video === undefined) {
            console.error(`No pairing found for: ${folder.searchterms.join(" - ")}`)
            errors = true
        }
    }
    if (errors) {
        process.exit()
    }
    process.stdout.write("done!\n")
}

function generateFolders(videos) {
    process.stdout.write("Writing index files... ")
    let index = 0
    for (const vid of videos) {
        const saveloc = `${basePath}/content/tracks/${vid.id}`
        if (!fs.existsSync(saveloc)) {
            fs.mkdirSync(saveloc)
        }
        const oldcontent = fs.readFileSync(saveloc + "/index.json").toString()
        const newcontent = JSON.stringify(vid, null, 2)
        if (oldcontent !== newcontent) {
            const file = fs.openSync(saveloc + "/index.json", 'w')
            fs.writeSync(file, Buffer.from(JSON.stringify(vid, null, 2)))
            fs.closeSync(file)
        }
    }
    process.stdout.write("done!\n")
}

function generateFirstPage(videos) {
    process.stdout.write("Writing first page content... ")
    const content = videos.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0,20).map(vid => videoSummary(vid))
    
    const oldcontent = fs.readFileSync(`${basePath}/content/firstPage.json`, {flag: 'a+'}).toString()
    const newcontent = JSON.stringify(content, null, 2)
    if (oldcontent !== newcontent) {
        const file = fs.openSync(`${basePath}/content/firstPage.json`, 'w')
        fs.writeSync(file, Buffer.from(JSON.stringify(content, null, 2)))
        fs.closeSync(file)
    }
    process.stdout.write("done!\n")
}

function generateSearchIndex(videos) {
    process.stdout.write("Writing search index... ")
    const content = {}

    for (const video of videos) {
        const sum = videoSummary(video)
        delete sum.id
        if (video.files.tracks.length !== 0) {
            sum.dl = null
        }
        content[video.id] = sum
    }

    const oldcontent = fs.readFileSync(`${basePath}/content/searchIndex.json`, {flag: 'a+'}).toString()
    const newcontent = JSON.stringify(content, null, 2)
    if (oldcontent !== newcontent) {
        const file = fs.openSync(`${basePath}/content/searchIndex.json`, 'w')
        fs.writeSync(file, Buffer.from(JSON.stringify(content, null, 2)))
        fs.closeSync(file)
    }
    process.stdout.write("done!\n")
}

function videoSummary(video) {
    let index = 1;
    if (!video.title.startsWith("N")) index = 0
    let title = video.title.split(" - ")[index]
    if (title.includes("[")) {
        title = title.split("[")[0]
    }
    title = title.trim()
    return {
        title: title,
        id: video.id,
        date: video.date.toJSON().substring(0, 10)
    }
}