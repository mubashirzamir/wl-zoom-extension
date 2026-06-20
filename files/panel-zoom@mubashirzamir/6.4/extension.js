const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const Settings = imports.ui.settings;

const UUID = "panel-zoom@mubashirzamir";

let settings;
let panelStates = {};
let panelAddedSignal;

let panelSettings = {
    zoomEnabled: true,
    zoomFactor: 1.3
};

function init(metadata) {}

function enable() {
    settings = new Settings.ExtensionSettings(panelSettings, UUID);

    bindZoomSettings();

    Main.panelManager.panels.forEach(panel => {
        initPanel(panel);
    });

    panelAddedSignal = Main.panelManager.connect('panel-added', function(manager, panel) {
        try {
            initPanel(panel);
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

function initPanel(panel) {
    if (!panel || !panel.actor) return;
    if (panelStates[panel.panelId]) return;

    panelStates[panel.panelId] = {
        zoomEnterId: null,
        zoomLeaveId: null
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
            if (!panelSettings.zoomEnabled) return;

            let target = findGroupedWindowListButton(event.get_source(), panel.actor);
            if (target) {
                zoomApplet(target, true, panelSettings.zoomFactor);
            }
        });

        state.zoomLeaveId = panel.actor.connect('leave-event', function(actor, event) {
            let target = findGroupedWindowListButton(event.get_source(), panel.actor);
            if (target) {
                zoomApplet(target, false, 1.0);
            }
        });
    } catch (e) {
        cleanupAppletZoom(panel);
    }
}

const GROUPED_WINDOW_LIST_ITEM_CLASS = 'grouped-window-list-item-box';

function findGroupedWindowListButton(actor, panelActor) {
    let current = actor;

    while (current && current !== panelActor) {
        try {
            if (current.has_style_class_name &&
                current.has_style_class_name(GROUPED_WINDOW_LIST_ITEM_CLASS)) {
                return current;
            }
        } catch (e) {
            return null;
        }
        current = current.get_parent ? current.get_parent() : null;
    }

    return null;
}

function cleanupAppletZoom(panel) {
    if (!panel || !panel.actor) return;

    let state = panelStates[panel.panelId];
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
    } catch (e) {}
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
                } catch (e) {}
            });
        } catch (e) {}
    });
}

function disable() {
    if (panelAddedSignal) {
        try {
            Main.panelManager.disconnect(panelAddedSignal);
        } catch (e) {}
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