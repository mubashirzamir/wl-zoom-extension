const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const Settings = imports.ui.settings;

const UUID = "panel-zoom@mubashirzamir";

let settings;
let panelStates = {};
let panelAddedSignal;

// bindProperty(sync_type, key_name, applet_var, callback, user_data) always
// writes onto the single object passed into the *Settings constructor.
// So every location's properties live flat on this one object.
let panelSettings = {
    topEnabled: true,
    topZoomFactor: 1.3,
    bottomEnabled: true,
    bottomZoomFactor: 1.3,
    leftEnabled: false,
    leftZoomFactor: 1.3,
    rightEnabled: false,
    rightZoomFactor: 1.3
};

function init(metadata) {
}

function enable() {
    settings = new Settings.ExtensionSettings(panelSettings, UUID);

    bindLocationSettings("top");
    bindLocationSettings("bottom");
    bindLocationSettings("left");
    bindLocationSettings("right");

    Main.panelManager.panels.forEach(panel => {
        initPanel(panel);
    });

    panelAddedSignal = Main.panelManager.connect('panel-added', function(manager, panel) {
        try {
            initPanel(panel);
        } catch(e) {}
    });
}

function bindLocationSettings(location) {
    settings.bindProperty(
        Settings.BindingDirection.IN,
        location + "-enabled",
        location + "Enabled",
        null,
        null
    );

    settings.bindProperty(
        Settings.BindingDirection.IN,
        location + "-zoomFactor",
        location + "ZoomFactor",
        null,
        null
    );
}

function getSettingsForLocation(location) {
    switch (location) {
        case "top":
            return { enabled: panelSettings.topEnabled, zoomFactor: panelSettings.topZoomFactor };
        case "bottom":
            return { enabled: panelSettings.bottomEnabled, zoomFactor: panelSettings.bottomZoomFactor };
        case "left":
            return { enabled: panelSettings.leftEnabled, zoomFactor: panelSettings.leftZoomFactor };
        case "right":
            return { enabled: panelSettings.rightEnabled, zoomFactor: panelSettings.rightZoomFactor };
        default:
            return null;
    }
}

function getPanelLocation(panel) {
    if (!panel || !panel.actor) return "unknown";

    let monitor = Main.layoutManager.findMonitorForActor(panel.actor);
    if (!monitor) return "unknown";

    let panelY = panel.actor.y;
    let panelX = panel.actor.x;
    let panelWidth = panel.actor.width;
    let panelHeight = panel.actor.height;

    if (panelY <= monitor.y + 10) {
        return "top";
    } else if (panelY + panelHeight >= monitor.y + monitor.height - 10) {
        return "bottom";
    } else if (panelX <= monitor.x + 10) {
        return "left";
    } else if (panelX + panelWidth >= monitor.x + monitor.width - 10) {
        return "right";
    }

    return "unknown";
}

function initPanel(panel) {
    if (!panel || !panel.actor) return;
    if (panelStates[panel.panelId]) return;

    panelStates[panel.panelId] = {
        zoomEnterId: null,
        zoomLeaveId: null,
        location: getPanelLocation(panel)
    };

    setupAppletZoom(panel);
}

function setupAppletZoom(panel) {
    if (!panel || !panel.actor) return;

    let state = panelStates[panel.panelId];
    if (!state) return;

    cleanupAppletZoom(panel);

    try {
        state.zoomEnterId = panel.actor.connect('enter-event', function(actor, event) {
            let locationSettings = getSettingsForLocation(state.location);
            if (!locationSettings || !locationSettings.enabled) return;

            let target = event.get_source();
            if (target && target !== panel.actor && !isLayoutContainer(target)) {
                zoomApplet(target, true, locationSettings.zoomFactor);
            }
        });

        state.zoomLeaveId = panel.actor.connect('leave-event', function(actor, event) {
            let target = event.get_source();
            if (target && target !== panel.actor) {
                zoomApplet(target, false, 1.0);
            }
        });
    } catch(e) {
        cleanupAppletZoom(panel);
    }
}

function isLayoutContainer(actor) {
    let actorType = actor.toString();

    if (actorType.includes('StBoxLayout') ||
        actorType.includes('St.BoxLayout') ||
        actorType.includes('StBin') ||
        actorType.includes('ClutterActor') ||
        actorType.includes('St.Bin')) {
        return true;
    }

    return false;
}

function cleanupAppletZoom(panel) {
    if (!panel || !panel.actor) return;

    let state = panelStates[panel.panelId];
    if (!state) return;

    if (typeof state.zoomEnterId === 'number') {
        try {
            panel.actor.disconnect(state.zoomEnterId);
        } catch(e) {}
        state.zoomEnterId = null;
    }

    if (typeof state.zoomLeaveId === 'number') {
        try {
            panel.actor.disconnect(state.zoomLeaveId);
        } catch(e) {}
        state.zoomLeaveId = null;
    }
}

function zoomApplet(actor, zoomIn, zoomFactor) {
    if (!actor) return;

    try {
        Tweener.removeTweens(actor);

        actor.set_pivot_point(0.5, 0.5);

        let targetScale = zoomIn ? zoomFactor : 1.0;

        Tweener.addTween(actor, {
            scale_x: targetScale,
            scale_y: targetScale,
            time: 0.15,
            transition: 'easeOutQuad'
        });
    } catch(e) {}
}

function resetAllAppletZoom(panel) {
    if (!panel) return;
    if (!panel._leftBox || !panel._centerBox || !panel._rightBox) return;

    let boxes = [panel._leftBox, panel._centerBox, panel._rightBox];

    boxes.forEach(box => {
        try {
            let children = box.get_children();
            children.forEach(child => {
                try {
                    Tweener.removeTweens(child);
                    child.set_pivot_point(0.5, 0.5);
                    child.set_scale(1.0, 1.0);
                } catch(e) {}
            });
        } catch(e) {}
    });
}

function disable() {
    if (panelAddedSignal) {
        try {
            Main.panelManager.disconnect(panelAddedSignal);
        } catch(e) {}
        panelAddedSignal = null;
    }

    Main.panelManager.panels.forEach(panel => {
        if (!panel || !panel.actor) return;

        let state = panelStates[panel.panelId];
        if (state) {
            cleanupAppletZoom(panel);
            resetAllAppletZoom(panel);
        }
    });

    panelStates = {};

    if (settings) {
        settings.finalize();
        settings = null;
    }
}