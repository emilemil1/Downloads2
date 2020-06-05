// CLASSES //

class Toggle {
    constructor(element) {
        const settingsMap = new Map();

        //set events
        element.getAttribute("toggle").split("|").forEach(s => {
            const settings = s.trim().split(" ");
            if (!settingsMap.has(settings[0])) {
                settingsMap.set(settings[0], []);
            }
            settingsMap.get(settings[0]).push(settings.slice(1));
        })

        //set actions
        settingsMap.forEach((actions, event) => {
            const actionsMap = new Map();
            actions.forEach(action => {
                action[0].split(",").forEach(attribute => {
                    if (!actionsMap.has(attribute)) {
                        actionsMap.set(attribute, []);
                    }
                    actionsMap.get(attribute).push(...action[1].split(",").map(targetId => document.querySelector(targetId)));
                })
            })
            element.addEventListener(event, () => this.toggle(element, actionsMap));
        })
    }

    toggle(element, actions) {
        actions.forEach((targets, attribute) => {
            if (attribute.endsWith("()")) {
                //call method
                const func = attribute.substring(0, attribute.indexOf("()"));
                targets.forEach(target => target[func]());
            } else {
                if (attribute.startsWith("attr.")) {
                    attribute = attribute.substring(5)
                    if (attribute.includes("=")) {
                        //set attribute
                        const split = attribute.split("=");
                        targets.forEach(target => target.setAttribute(split[0], split[1].replace(/(?<=^)'|'(?=$)/g,"")));
                    } else {
                        //toggle attribute
                        targets.forEach(target => target.toggleAttribute(attribute));
                    }
                } else if (attribute.startsWith("prop.")) {
                    attribute = attribute.substring(5)
                    if (attribute.includes("=")) {
                        //set property
                        const split = attribute.split("=");
                        targets.forEach(target => target[split[0]] = split[1].replace(/(?<=^)'|'(?=$)/g,""));
                    } else {
                        //toggle property
                        if (target[attribute] !== undefined) {
                            delete target[attribute]
                        } else {
                            targets.forEach(target => target[attribute] = null);
                        }
                    }
                }
            }
        })
    }
}

document.querySelectorAll(".toggle").forEach(toggle => {
    new Toggle(toggle);
})