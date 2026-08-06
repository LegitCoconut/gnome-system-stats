# System Usage

GNOME Shell extension showing live network speed, RAM usage and optional disk
usage in the top bar.

```
↑ 34.5 KB/s ↓ 2.3 MB/s  |  4.1/14.6G  |  32.3/467G
```

## Why another one

Most network monitors sum every interface in `/proc/net/dev`. If you run a VPN
(WireGuard, CloudflareWARP, Tailscale) or Docker, the same bytes are counted on
the tunnel *and* on the physical NIC — a real 2.5 MB/s shows up as ~6 MB/s.

This one counts only interfaces with a `/sys/class/net/<if>/device` link, i.e.
real hardware, so the number matches what actually crosses the wire.

## Settings

- **Position** — left, center or right of the panel
- **Split stats** — network, RAM and disk as separate tiles, each independently
  placed
- **Show disk usage** — pick any mounted filesystem (snap loop devices are
  filtered out)

## Install from source

Requires GNOME Shell 50.

```sh
git clone https://github.com/legitcoconut/gnome-system-stats
ln -s "$PWD/gnome-system-stats" ~/.local/share/gnome-shell/extensions/system-usage@legitcoconut
glib-compile-schemas ~/.local/share/gnome-shell/extensions/system-usage@legitcoconut/schemas
gnome-extensions enable system-usage@legitcoconut
```

Log out and back in on Wayland, or `Alt+F2` → `r` on X11.

## Tests

```sh
gjs -m test.js
```

Unit checks for the meminfo/netdev parsers, rate math, counter resets, unit
formatting and the mount filter, then a 6 second live sample.

## License

GPL-2.0-or-later. Copyright (C) 2026 Adithyan P &lt;mail.adithyanp@gmail.com&gt;
