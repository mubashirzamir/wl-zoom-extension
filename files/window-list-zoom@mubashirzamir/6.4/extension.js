const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const Settings = imports.ui.settings;

const UUID = "window-list-zoom@mubashirzamir";

let settings;
let windowListStates = {};
let panelAddedHandlerId;

let defaultSettings = {
    zoomEnabled: true,
    zoomFactor: 1.3
};

function init(metadata) {}

function enable() {
    settings = new Settings.ExtensionSettings(defaultSettings, UUID);

    bindZoomSettings();

    Main.panelManager.panels.forEach(panel => {
        initWindowListZoom(panel);
    });

    panelAddedHandlerId = Main.panelManager.connect('panel-added', function(manager, panel) {
        try {
            initWindowListZoom(panel);
        } catch (e) {}
    });
}

function bindZoomSettings() {
    settings.bindProperty(
        Settings.BindingDirection.IN,
        "zoom-enabled",
        "zoomEnabled",
        null,
        null
    );

    settings.bindProperty(
        Settings.BindingDirection.IN,
        "zoom-zoomFactor",
        "zoomFactor",
        null,
        null
    );
}

function initWindowListZoom(panel) {
    if (!panel || !panel.actor) return;
    if (windowListStates[panel.panelId]) return;

    windowListStates[panel.panelId] = {
        zoomEnterId: null,
        zoomLeaveId: null
    };

    setupWindowListZoom(panel);
}

function setupWindowListZoom(panel) {
    if (!panel || !panel.actor) return;

    let state = windowListStates[panel.panelId];
    if (!state) return;

    cleanupWindowListZoom(panel);

    try {
        state.zoomEnterId = panel.actor.connect('enter-event', function(actor, event) {
            if (!defaultSettings.zoomEnabled) return;

            let target = findWindowListButton(event.get_source(), panel.actor);
            if (target) {
                zoomButton(target, true, defaultSettings.zoomFactor);
            }
        });

        state.zoomLeaveId = panel.actor.connect('leave-event', function(actor, event) {
            let target = findWindowListButton(event.get_source(), panel.actor);
            if (target) {
                zoomButton(target, false, 1.0);
            }
        });
    } catch (e) {
        cleanupWindowListZoom(panel);
    }
}

const WINDOW_LIST_ITEM_CLASS = 'grouped-window-list-item-box';

function findWindowListButton(actor, panelActor) {
    let current = actor;

    while (current && current !== panelActor) {
        try {
            if (current.has_style_class_name &&
                current.has_style_class_name(WINDOW_LIST_ITEM_CLASS)) {
                return current;
            }
        } catch (e) {
            return null;
        }
        current = current.get_parent ? current.get_parent() : null;
    }

    return null;
}

function cleanupWindowListZoom(panel) {
    if (!panel || !panel.actor) return;

    let state = windowListStates[panel.panelId];
    if (!state) return;

    if (typeof state.zoomEnterId === 'number') {
        try {
            panel.actor.disconnect(state.zoomEnterId);
        } catch (e) {}
        state.zoomEnterId = null;
    }

    if (typeof state.zoomLeaveId === 'number') {
        try {
            panel.actor.disconnect(state.zoomLeaveId);
        } catch (e) {}
        state.zoomLeaveId = null;
    }
}

function zoomButton(actor, zoomIn, zoomFactor) {
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
    } catch (e) {}
}

function resetAllWindowListZoom(panel) {
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
                } catch (e) {}
            });
        } catch (e) {}
    });
}

function disable() {
    if (panelAddedHandlerId) {
        try {
            Main.panelManager.disconnect(panelAddedHandlerId);
        } catch (e) {}
        panelAddedHandlerId = null;
    }

    Main.panelManager.panels.forEach(panel => {
        if (!panel || !panel.actor) return;

        let state = windowListStates[panel.panelId];
        if (state) {
            cleanupWindowListZoom(panel);
            resetAllWindowListZoom(panel);
        }
    });

    windowListStates = {};

    if (settings) {
        settings.finalize();
        settings = null;
    }
}
