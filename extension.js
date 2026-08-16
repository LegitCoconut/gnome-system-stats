// SPDX-FileCopyrightText: 2026 Adithyan P <mail.adithyanp@gmail.com>
// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {readRam, readNet, readDisk, formatRate, rates} from './monitor.js';

export default class SystemUsageExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicators = [];
        this._build();

        this._settings.connectObject('changed', () => this._build(), this);
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    // ponytail: whole panel rebuild on any settings change — settings change
    // rarely, so nothing smarter is worth the state tracking.
    _build() {
        this._clear();
        const tiles = ['net', 'ram'];
        if (this._settings.get_boolean('show-disk'))
            tiles.push('disk');

        if (this._settings.get_boolean('split'))
            tiles.forEach(t => this._add([t], this._settings.get_string(`${t}-position`), t));
        else
            this._add(tiles, this._settings.get_string('position'), 'all');

        this._update();
    }

    _add(tiles, side, name) {
        const button = new PanelMenu.Button(0.0, `System Usage (${name})`, true);
        const label = new St.Label({yAlign: Clutter.ActorAlign.CENTER});
        button.add_child(label);
        // -1 appends: on the left that lands after Activities and the window
        // switcher instead of shoving them aside. On the right, 0 keeps us left
        // of the quick settings menu, where extensions normally sit.
        Main.panel.addToStatusArea(`${this.uuid}-${name}`, button,
            side === 'right' ? 0 : -1, side);
        this._indicators.push({tiles, label, button});
    }

    _update() {
        if (this._busy) // a tick is still reading; skip rather than interleave
            return;
        this._busy = true;
        this._refresh().catch(logError).finally(() => (this._busy = false));
    }

    async _refresh() {
        const now = await readNet();
        const r = this._prev ? rates(this._prev, now) : {rx: 0, tx: 0};
        this._prev = now;

        const text = {
            net: `↑ ${formatRate(r.tx)} ↓ ${formatRate(r.rx)}`,
            ram: await readRam(),
        };
        if (this._settings?.get_boolean('show-disk'))
            text.disk = await readDisk(this._settings.get_string('disk-mount'));

        if (!this._settings) // disabled while we were reading
            return;

        for (const ind of this._indicators)
            ind.label.text = ind.tiles.map(t => text[t]).join('  |  ');
    }

    _clear() {
        this._indicators.forEach(i => i.button.destroy());
        this._indicators = [];
    }

    disable() {
        GLib.Source.remove(this._timeout);
        this._timeout = null;
        this._settings.disconnectObject(this);
        this._clear();
        this._settings = null;
        this._prev = null;
    }
}