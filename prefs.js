// SPDX-FileCopyrightText: 2026 Adithyan P <mail.adithyanp@gmail.com>
// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {listMounts} from './monitor.js';

const SIDES = ['left', 'center', 'right'];

function positionRow(settings, key, title) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(['Left', 'Center', 'Right']),
        selected: SIDES.indexOf(settings.get_string(key)),
    });
    row.connect('notify::selected', () => settings.set_string(key, SIDES[row.selected]));
    return row;
}

export default class SystemUsagePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const layout = new Adw.PreferencesGroup({title: 'Layout'});
        page.add(layout);

        const split = new Adw.SwitchRow({
            title: 'Split stats',
            subtitle: 'Show network, RAM and disk as separate tiles you can place individually',
        });
        settings.bind('split', split, 'active', Gio.SettingsBindFlags.DEFAULT);
        layout.add(split);

        const whole = positionRow(settings, 'position', 'Position');
        layout.add(whole);

        const perTile = [['net', 'Network'], ['ram', 'RAM'], ['disk', 'Disk']]
            .map(([tile, title]) => {
                const row = positionRow(settings, `${tile}-position`, `${title} position`);
                layout.add(row);
                return [tile, row];
            });

        const disk = new Adw.PreferencesGroup({title: 'Disk'});
        page.add(disk);

        const showDisk = new Adw.SwitchRow({title: 'Show disk usage'});
        settings.bind('show-disk', showDisk, 'active', Gio.SettingsBindFlags.DEFAULT);
        disk.add(showDisk);

        const mounts = listMounts();
        const mountRow = new Adw.ComboRow({
            title: 'Disk',
            model: Gtk.StringList.new(mounts.map(m => `${m.dev} — ${m.mount}`)),
            selected: Math.max(0, mounts.findIndex(m => m.mount === settings.get_string('disk-mount'))),
        });
        mountRow.connect('notify::selected', () => {
            const m = mounts[mountRow.selected];
            if (m)
                settings.set_string('disk-mount', m.mount);
        });
        // GET, not DEFAULT: a two-way bind would write widget state back into the key.
        settings.bind('show-disk', mountRow, 'sensitive', Gio.SettingsBindFlags.GET);
        disk.add(mountRow);

        const applySplit = () => {
            whole.visible = !split.active;
            for (const [tile, row] of perTile)
                row.visible = split.active && (tile !== 'disk' || showDisk.active);
        };
        split.connect('notify::active', applySplit);
        showDisk.connect('notify::active', applySplit);
        applySplit();
    }
}