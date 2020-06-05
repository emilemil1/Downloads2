// CLASSES //
class VideoEntryElement extends HTMLElement {
    constructor() {
        super()
    }

    setInfo(info) {
        this.info = info
        this.querySelector(".video-image-preview").src = `https://i.ytimg.com/vi/${this.info.id}/mqdefault.jpg`
        this.querySelector(".video-text-preview-title").textContent = this.info.title
        this.querySelector(".video-text-preview-date").textContent = this.info.date
    }
    
}
customElements.define('video-entry', VideoEntryElement)

// ACTIONS //
function loadFirstPage(firstPage) {
    for (let i = 0; i < 20; i++) {
        const entry = storage.availableEntries[i]
        entry.setInfo(firstPage[i])
        storage.usedEntries.push(entry)
    }
    storage.availableEntries = []
}

function prepareFirstPage(resolve) {
    const template = document.getElementById("video-entry-template")
    const frag = document.createDocumentFragment()
    storage.availableEntries = []
    storage.usedEntries = []
    for (let i = 0; i < 20; i++) {
        const content = template.content.cloneNode(true)
        frag.appendChild(content)
        storage.availableEntries.push(frag.lastElementChild)
    }
    template.remove()
    document.getElementById("content").appendChild(frag)
    resolve()
}

// TRIGGERS //
const storage = {}
const fpLoad = new Promise(res => prepareFirstPage(res))
window.global.firstPage.then(async (firstPage) => {
    await fpLoad
    loadFirstPage(firstPage)
})