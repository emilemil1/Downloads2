// CLASSES //
class VideoEntryElement extends HTMLElement {
    constructor() {
        super()
        this.infoLoaded = false
        this.titleLoaded = false
        this.dateLoaded = false
        this.imageLoaded = false
    }

    setInfo(info, delayImages) {
        if (!this.infoLoaded) {
            this.info = info
            this.id = "_"+info.id
            this.infoLoaded = true
        }
        if (!this.titleLoaded) {
            this.querySelector(".video-text-preview-title").textContent = this.info.title
            this.titleLoaded = true
        }
        if (!this.dateLoaded) {
            this.querySelector(".video-text-preview-date").textContent = this.info.date
            this.dateLoaded = true
        }
        if (!this.imageLoaded) {
            const setImg = () => {
                this.querySelector(".video-image-preview").src = `https://i.ytimg.com/vi/${this.info.id}/hqdefault.jpg`
                this.imageLoaded = true
            }
            if (delayImages) {
                setTimeout(() => {
                    if (document.getElementById(this.info.id) !== null) {
                        setImg()
                    }
                }, 250)
            } else {
                setImg()
            }
        }
    }
}
customElements.define('video-entry', VideoEntryElement)

// ACTIONS //
function loadFirstPage(firstPage) {
    const type = performance.getEntriesByType("navigation")[0].type
    if (type === "reload" || type === "back_forward") {
        return
    }
    const content = document.getElementById("content")
    for (let i = 0; i < 20; i++) {
        const entry = firstPage[i]
        entry.element = content.children[i]
        entry.element.setInfo(entry)
        entry.element.querySelector(".video-entry-content").setAttribute("trigger", `click: #footer.load(#_${entry.id})`)
    }
}

function prepareFirstPage(resolve) {
    const template = document.getElementById("video-entry-template")
    const frag = document.createDocumentFragment()
    for (let i = 0; i < 20; i++) {
        const content = template.content.cloneNode(true)
        frag.appendChild(content)
    }
    document.getElementById("content").appendChild(frag)
    resolve()
}

// TRIGGERS //
const fpLoad = new Promise(res => prepareFirstPage(res))
window.global.firstPage.then(async (firstPage) => {
    await fpLoad
    loadFirstPage(firstPage)
    fetch("content/searchIndex.json")
        .then(response => response.json())
        .then(index => window.global.searchIndex.resolve(index))
}).then(window.global.sync.loaded.resolve())