// SPDX-FileCopyrightText: 2026 Adithyan P <mail.adithyanp@gmail.com>
// SPDX-License-Identifier: GPL-2.0-or-later

// gjs -m test.js   → unit checks, then a 6s live sample
import GLib from 'gi://GLib';
import System from 'system';
import {formatRam, parseNetDev, formatRate, rates, readNet, readRam,
        formatDisk, readDisk, parseMounts, listMounts} from './monitor.js';

const eq = (got, want, what) => {
    if (got !== want)
        throw new Error(`${what}: expected ${want}, got ${got}`);
};

const sleep = secs => new Promise(resolve =>
    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secs, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));

async function main() {

eq(formatRam(`MemTotal:       16777216 kB
MemFree:         1048576 kB
MemAvailable:    8388608 kB
`), '8.0/16.0G', 'ram');

const FAKE = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 5546154   31198    0    0    0     0          0         0  5546154   31198    0    0    0     0       0          0
  wlo1: 1000000  3041376    0    0    0     0          0         0  2000000 2039662    0   13    0     0       0          0
CloudflareWARP: 900000  428642    0    0    0     0          0         0 1900000  165815    0    0    0     0       0          0
`;

// only the hardware NIC counts — the tunnel would nearly double it
const t = parseNetDev(FAKE, i => i === 'wlo1');
eq(t.rx, 1000000, 'rx');
eq(t.tx, 2000000, 'tx');

// 2.5 MiB over 2 s = 1.25 MiB/s
eq(formatRate(rates({rx: 0, tx: 0, time: 0},
                    {rx: 2.5 * 1024 * 1024, tx: 0, time: 2e6}).rx), '1.3 MB/s', 'rate');
eq(formatRate(2.5 * 1024 * 1024), '2.5 MB/s', 'format MB');
eq(formatRate(1023), '1023 B/s', 'format B');
eq(formatRate(1536), '1.5 KB/s', 'format KB');
eq(formatRate(0), '0 B/s', 'format zero');

// interface reset must not spike
eq(rates({rx: 500, tx: 0, time: 0}, {rx: 0, tx: 0, time: 1e6}).rx, 0, 'reset');

const GB = 1024 ** 3;
eq(formatDisk(33 * GB, 468 * GB), '33.0/468G', 'disk big');
eq(formatDisk(6.4 * GB, 60 * GB), '6.4/60.0G', 'disk small');
eq(await readDisk('/nope/not/here'), '--', 'disk missing');

// loop devices (snaps) must not clutter the picker
const mounts = parseMounts(`/dev/nvme0n1p2 / ext4 rw 0 0
/dev/loop3 /snap/core20/2866 squashfs ro 0 0
tmpfs /run tmpfs rw 0 0
/dev/nvme0n1p1 /boot/efi vfat rw 0 0
`);
eq(mounts.length, 2, 'mount count');
eq(mounts[0].mount, '/', 'mount path');

print(`unit checks ok — mounts: ${(await listMounts()).map(m => m.dev).join(', ')}`);
print('live sample (6s):');
let prev = await readNet();
for (let i = 0; i < 6; i++) {
    await sleep(1);
    const now = await readNet();
    const s = rates(prev, now);
    prev = now;
    print(`  ↑ ${formatRate(s.tx)} ↓ ${formatRate(s.rx)} | ${await readRam()} | ${await readDisk('/')}`);
}

}

const loop = GLib.MainLoop.new(null, false);
let failed = false;
main()
    .catch(e => {
        failed = true;
        printerr(e);
    })
    .finally(() => loop.quit());
loop.run();
System.exit(failed ? 1 : 0);
