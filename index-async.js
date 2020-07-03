// CLASSES //

class Trigger {
    constructor(element) {
        element.isTrigger = true

        element.getAttribute("trigger").split("|").forEach(s => {
            this.createTrigger(element, s.trim())
        })
    }

    createTrigger(element, triggerString) {
        const split = triggerString.split(/:|(?:(?<![\[ \,])\.)/)
        if (split.length !== 3) {
            throw {message: "Trigger definition has invalid format", element}
        }
        const event = split[0].trim()
        const targets = split[1].trim().match(/[^,\[\]]+/g).map(target => target.trim())
        if (targets.length === 0) {
            throw {message: "Could not parse trigger targets", element}
        }
        const actions = split[2].trim().match(/[^,\[\]]+/g).map(action => action.trim())
        if (actions.length === 0) {
            throw {message: "Could not parse trigger actions", element}
        }

        element.addEventListener(event, this.createEventListener(element, targets, actions))
    }

    createEventListener(element, targets, actions) {
        const listeners = []
        for (const target of targets) {
            for (const action of actions) {
                if (action.includes("(")) {
                    listeners.push(this.createMethodEventListener(element, target, action))
                } else if (action.startsWith("@")) {
                    listeners.push(this.createAttributeEventListener(element, target, action))
                } else {
                    listeners.push(this.createPropertyEventListener(element, target, action))
                }
            }
        }
        return (e) => {
            listeners.forEach(listener => listener(e))
        }
    }

    resolveTargetElement(element, target, event) {
        let targetElement
        if (target === "this") targetElement = element
        else if (target === "e") targetElement = event
        else targetElement = document.querySelector(target)
        if (targetElement === undefined) {
            throw {message: "Could not locate trigger target element in DOM: " + target, element}
        }
        return targetElement
    }

    createMethodEventListener(element, target, method, event) {
        const index = method.indexOf("(")
        const methodName = method.substring(0, index)
        let args = method.substring(index).match(/[^,\(\)]+/g) || []
        
        args = args.map(arg => arg.trim())
        return (e) => {
            const targetElement = this.resolveTargetElement(element, target, e)
            const resolvedArgs = args.map(arg => {
                if (arg === "this") {
                    return element
                } else if (arg.startsWith('"') || arg.startsWith("'")) {
                    return arg.subtring(1, arg.length-1)
                } else {
                    const argElement = document.querySelector(arg)
                    if (argElement === undefined) {
                        throw {message: "Could not locate trigger argument element in DOM: " + arg, element}
                    }
                    return argElement
                }
            })
            targetElement[methodName](...resolvedArgs)
        }
    }

    createAttributeEventListener(element, target, assignment) {
        let parts = this.getAssignmentParts(assignment)
        parts.attribute = parts.attribute.substring(1)
        
        if (parts.value === null) {
            return () => this.resolveTargetElement(element, target).toggleAttribute(parts.attribute)
        } else if (parts.assign) {
            if (parts.value === "") {
                return () => this.resolveTargetElement(element, target).toggleAttribute(parts.attribute, true)
            } else {
                return () => this.resolveTargetElement(element, target).setAttribute(parts.attribute, parts.value)
            }
        } else {
            return () => {
                const targetElement = this.resolveTargetElement(element, target)
                targetElement.hasAttribute(parts.attribute) ? targetElement.setAttribute(parts.attribute, parts.value) : targetElement.removeAttribute(parts.attribute)
            }
        }
    }

    createPropertyEventListener(element, target, assignment) {
        let parts = this.getAssignmentParts(assignment)
        if (parts.value === "this") {
            parts.value = element
        }
        
        if (parts.value === null) {
            return () => {
                const targetElement = this.resolveTargetElement(element, target)
                targetElement[parts.attribute] = targetElement[parts.attribute] === undefined ? true : undefined
            }
        } else if (parts.assign) {
            return () => this.resolveTargetElement(element, target)[parts.attribute] = parts.value
        } else {
            return () => {
                const targetElement = this.resolveTargetElement(element, target)
                targetElement[parts.attribute] = targetElement[parts.attribute] === undefined ? parts.value : undefined
            }
        }
    }

    getAssignmentParts(assignment) {
        const operatorIndex = assignment.indexOf("=")
        const offset = assignment[operatorIndex - 1] === "?" ? 1 : 0
        let attribute = operatorIndex === -1 ? assignment : assignment.substring(0, operatorIndex - offset)
        attribute = attribute.trim()
        const value = operatorIndex === -1 ? null : assignment.substring(operatorIndex + 1).trim()

        return {
            attribute,
            value,
            assign: offset === 0
        }
    }
}

class Footer {
    constructor(element) {
        this.footer = element
        this.content = element.querySelector("#footer-content")
        this.video = element.querySelector("#footer-video")
        this.footer.load = videoEntry => this.load(videoEntry)
        this.load.listener = e => e.preventDefault()
    }

    load(videoEntry) {
        this.footer.addEventListener("transitionend", () => {
            this.footer.toggleAttribute("transition")
            if (this.footer.hasAttribute("display")) {
                this.loadExpensiveContent(videoEntry)
            }
        }, {
            once: true
        })
        this.footer.toggleAttribute("transition")
        this.footer.toggleAttribute("display")
        if (this.footer.hasAttribute("display")) {
            this.footer.addEventListener("wheel", this.load.listener)
            this.footer.addEventListener("touchmove", this.load.listener)
            this.loadCheapContent(videoEntry)
        } else {
            this.footer.removeEventListener("wheel", this.load.listener)
            this.footer.removeEventListener("touchmove", this.load.listener)
            this.unloadExpensiveContent()
        }
    }

    loadCheapContent(videoEntry) {

    }

    loadExpensiveContent(videoEntry) {
        this.content.firstElementChild.toggleAttribute("display", true)
        if (videoEntry !== undefined) {
            const src = "https://www.youtube-nocookie.com/embed/" + videoEntry.id.substring(1)
            if (this.video.src !== src) this.video.src = src
        }
    }

    unloadExpensiveContent() {
        this.content.firstElementChild.removeAttribute("display")
    }
}

class Content {
    constructor(content) {
        this.content = content
        this.template = document.getElementById("video-entry-template")
        this.template.remove()
        this.tagTemplate = document.getElementById("video-tag")
        this.tagTemplate.remove()
        this.entries = []
        this.scrollPosition = document.documentElement.scrollTop
        document.addEventListener("scroll", () => this.scroll(), {
            passive: true
        })

        window.addEventListener("beforeunload", this.save)
    }

    set(entries, delayImages) {
        this.entries = entries
        if (this.entryHeight === undefined) {
            this.entryHeight = this.content.children[0].offsetHeight
        }
        const index = Math.round(this.scrollPosition / this.entryHeight)
        this.reveal(index - 10, index + 10, delayImages)
    }

    reveal(start, end, delayImages) {
        start = Math.max(0, start)
        end = Math.min(this.entries.length, end)
        const frag = document.createDocumentFragment()
        const init = []
        const slice = this.entries.slice(start, end)
        for (const entry of slice) {
            if (entry.ref.element === undefined) {
                entry.ref.element = this.template.content.children[0].cloneNode(true)
                entry.ref.element.querySelector(".video-entry-content").setAttribute("trigger", `click: #footer.load(#_${entry.ref.id})`)
            }
            entry.ref.element.querySelector(".video-tags").innerHTML = ""
            init.push(entry.ref)
            frag.appendChild(entry.ref.element)
        }
        this.content.innerHTML = ""
        this.content.appendChild(frag)
        this.content.style.paddingTop = (start * this.entryHeight) + "px"
        this.content.style.paddingBottom = ((this.entries.length - end) * this.entryHeight) + "px"

        for (const entry of init) {
            entry.element.setInfo(entry, delayImages)
        }
        for (const entry of slice) {
            if (entry.tags.length === 0) continue
            const frag = document.createDocumentFragment()
            for (const tag of entry.tags) {
                const tagElement = this.tagTemplate.content.children[0].cloneNode(true)
                frag.appendChild(tagElement)
                tagElement.children[0].innerText = tag.type
                tagElement.children[1].innerHTML = tag.content[0]
                if (tag.content.length > 1) {
                    tagElement.children[2].innerText = `+ ${tag.content.length - 1} more`
                    tagElement.children[2].classList.remove("hidden")
                    tagElement.children[2].title = tag.cleanContent.slice(1).join("\n")
                }
                entry.ref.element.querySelector(".video-tags").appendChild(frag)
            }
        }
    }

    scroll() {
        if (Math.abs(this.scrollPosition - document.documentElement.scrollTop) < this.entryHeight * 4) return
        this.scrollPosition = document.documentElement.scrollTop
        const index = Math.round(this.scrollPosition / this.entryHeight)
        this.reveal(index - 10, index + 10)
    }

    save() {
        localStorage.setItem("scrollPosition", document.documentElement.scrollTop)
    }
}

class IndexManager {
    constructor(index) {
        this.index = {}
        for (const id in index) {
            this.index[id] = index[id]
            this.index[id].id = id
        }
        this.content = new Content(document.getElementById("content"))
        for (const element of this.content.content.children) {
            if (element.info === undefined) continue
            this.index[element.info.id].element = element
        }
        this.content.set(Object.values(this.index).map(entry => {
            return {
                ref: entry,
                tags: []
            }
        }))
        if (performance !== undefined) {
            const type = performance.getEntriesByType("navigation")[0].type
            if (type === "reload" || type === "back_forward") {
                document.documentElement.scrollTo(0, localStorage.getItem("scrollPosition"))
            }
        }
        document.getElementById("search-box").search = () => this.search()
    }

    search() {
        if (this.searchIndex === undefined) {
            this.createSearchIndex()
        }

        const query = document.getElementById("search-box").value.toLowerCase()

        if (query === "") {
            this.content.set(Object.values(this.index).map(entry => {
                return {
                    ref: entry,
                    tags: []
                }
            }))
            return
        }

        const searchSet = []

        searchSet.push(this.searchIndex.titleIndex
            .filter(entry => entry.title.includes(query))
            .map(entry => {
                return {
                    id: entry.id,
                    matching: "title",
                    priority: this.calcTitlePriority(entry.title, query)
                }
            }))
        searchSet.push(this.searchIndex.trackIndex
            .filter(entry => entry.track.includes(query))
            .map(entry => {
                const i = entry.track.indexOf(query)
                return {
                    id: entry.id,
                    matching: "track",
                    index: entry.index,
                    priority: this.calcTrackPriority(entry.track, query)
                }
            }))
        
        const results = new Map()
        for (const set of searchSet) {
            for (const entry of set) {
                let result = results.get(entry.id)
                if (result === undefined) {
                    result = {
                        id: entry.id,
                        ref: this.index[entry.id],
                        matching: new Map(),
                        tags: [],
                        priority: 100
                    }
                    results.set(entry.id, result)
                }
                if (entry.priority < result.priority) result.priority = entry.priority
                if (entry.matching === "track") {
                    const indices = result.matching.get("track") || []
                    if (indices.length === 0) result.matching.set("track", indices)
                    indices.push({
                        priority: entry.priority,
                        index: entry.index !== undefined ? entry.index : 0
                    })
                }
            }
        }

        const resultsArr = [...results.values()].sort((r1,r2) => r1.priority - r2.priority)

        for (const res of resultsArr) {
            if (res.matching.has("track")) {
                const sorted = res.matching.get("track").sort((t1,t2) => t1.priority - t2.priority)
                res.tags.push({
                    type: "search",
                    content: sorted.map(t => {
                        const text = this.index[res.id].tracks[t.index]
                        const highlightStart = text.toLowerCase().indexOf(query)
                        return `<span>${text.substring(0, highlightStart)}</span><b>${text.substring(highlightStart, highlightStart + query.length)}</b><span>${text.substring(highlightStart + query.length)}</span>`
                    }),
                    cleanContent: sorted.map(t => this.index[res.id].tracks[t.index])
                })
            }
        }

        document.documentElement.scrollTop = 0
        this.content.set(resultsArr, true)
    }

    calcTitlePriority(string, query) {
        const index = string.indexOf(query)
        const charStart = string.charAt(index-1)
        const charEnd = string.charAt(index+query.length)

        let priority = 15;
        if (charStart === "" || charStart === " ") priority -= 8
        if (charStart === "") priority -= 4
        if (charEnd === "" || charEnd === " ") priority -= 2

        return priority
    }

    calcTrackPriority(string, query) {
        const index = string.indexOf(query)
        const charStart = string.charAt(index-1)
        const charEnd = string.charAt(index+query.length)

        let priority = 16;
        if (charStart === "" || charStart === " " || charStart === "(") priority -= 8
        if (charEnd === "" || charEnd === " " || charEnd === ")") priority -= 2

        return priority
    }

    createSearchIndex() {
        const titleIndex = Object.entries(this.index).map(entry => {
            return {
                title: entry[1].title.toLowerCase(),
                id: entry[0]
            }
        })

        const trackIndex = Object.entries(this.index).flatMap(entry => {
            return entry[1].tracks.map((track, index) => {
                return {
                    track: track.toLowerCase(),
                    id: entry[0],
                    index
                }
            })
        })

        this.searchIndex = {
            titleIndex,
            trackIndex
        }
    }
}

//ACTIONS
function init() {
    document.querySelectorAll("*[trigger]").forEach(trigger => {
        new Trigger(trigger);
    })
    new MutationObserver(record => {
        record.forEach(rec => {
            rec.addedNodes.forEach(node => {
                if (node.children[0].isTrigger == undefined) {
                    new Trigger(node.children[0])
                }
            })
        })
    }).observe(document.getElementById("content"), {
        childList: true
    })

    new Footer(document.getElementById("footer"))
}

window.global.sync.loaded.then(init)
    .then(window.global.async.loaded.resolve())

window.global.searchIndex
    .then(index => new IndexManager(index))
