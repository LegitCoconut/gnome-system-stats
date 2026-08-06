// SPDX-FileCopyrightText: 2026 Adithyan P <mail.adithyanp@gmail.com>
// SPDX-License-Identifier: GPL-2.0-or-later

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const read = path => new TextDecoder().decode(GLib.file_get_contents(path)[1]);

/* ---------- RAM ---------- */

const KB_IN_GIB = 1024 * 1024; // /proc/meminfo is in kB

export function formatRam(meminfo) {
    const kb = key => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))[1]);
    const total = kb('MemTotal');
    const used = total - kb('MemAvailable');
    return `${(used / KB_IN_GIB).toFixed(1)}/${(total / KB_IN_GIB).toFixed(1)}G`;
}

export const readRam = () => formatRam(read('/proc/meminfo'));

/* ---------- Network ---------- */

// Count bytes on the wire once. Virtual interfaces (lo, docker0, br-*, veth*,
// VPN tunnels like CloudflareWARP) carry the same traffic a second time, so
// summing every interface reports a real 2.5 MB/s as ~6 MB/s. Hardware NICs are
// exactly the ones with a /sys/class/net/<if>/device link.
const isPhysical = iface =>
    GLib.file_test(`/sys/class/net/${iface}/device`, GLib.FileTest.EXISTS);

export function parseNetDev(text, keep = isPhysical) {
    let rx = 0, tx = 0;
    for (const line of text.split('\n').slice(2)) {
        const m = line.match(/^\s*(\S+):\s*(.+)$/);
        if (!m || !keep(m[1]))
            continue;
        const f = m[2].trim().split(/\s+/);
        rx += Number(f[0]);   // receive bytes
        tx += Number(f[8]);   // transmit bytes
    }
    return {rx, tx};
}

export const readNet = () => ({
    ...parseNetDev(read('/proc/net/dev')),
    time: GLib.get_monotonic_time(),
});

const UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

export function formatRate(bps) {
    let i = 0;
    while (bps >= 1024 && i < UNITS.length - 1) {
        bps /= 1024;
        i++;
    }
    return `${bps.toFixed(i === 0 ? 0 : 1)} ${UNITS[i]}`;
}

// prev/now from readNet(); time is monotonic microseconds.
export function rates(prev, now) {
    const secs = (now.time - prev.time) / 1e6;
    if (secs <= 0)
        return {rx: 0, tx: 0};
    const delta = (a, b) => Math.max(0, b - a) / secs; // counters reset on iface down
    return {rx: delta(prev.rx, now.rx), tx: delta(prev.tx, now.tx)};
}

/* ---------- Disk ---------- */

const GB = 1024 ** 3;

export function formatDisk(used, size) {
    const g = v => (v / GB).toFixed(v < 100 * GB ? 1 : 0);
    return `${g(used)}/${g(size)}G`;
}

export function readDisk(mount) {
    try {
        const info = Gio.File.new_for_path(mount || '/').query_filesystem_info(
            'filesystem::size,filesystem::used,filesystem::free', null);
        const size = info.get_attribute_uint64('filesystem::size');
        const used = info.get_attribute_uint64('filesystem::used') ||
            size - info.get_attribute_uint64('filesystem::free');
        return formatDisk(used, size);
    } catch {
        return '--'; // unmounted or unreadable
    }
}

// Mounted real filesystems, for the disk picker in prefs.
export function listMounts(text = read('/proc/mounts')) {
    const seen = new Set();
    const out = [];
    for (const line of text.split('\n')) {
        const [dev, mount] = line.split(' ');
        if (!dev?.startsWith('/dev/') || dev.startsWith('/dev/loop') || seen.has(dev))
            continue;
        seen.add(dev);
        out.push({dev, mount: mount.replace(/\\040/g, ' ')});
    }
    return out;
}