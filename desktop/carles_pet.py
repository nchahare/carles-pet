"""Carles desktop pet: plays the frames baked from carles.js (tools/bake.ps1) in a frameless,
always-on-top window that is only as big as he is, standing on the taskbar. Standard library only
(tkinter), Windows, main screen.

    pythonw -I desktop\\carles_pet.py [animId] [--sleep-after SECONDS]
    python -I desktop\\carles_pet.py --save-icon carles.ico     (writes his icon; used by make-shortcut.ps1)

He picks his own activities and walks about. Click him (1, 2 or 4 times), rest the pointer on him,
or drag him and let go. Leave the computer alone for a minute and he naps. Right-click him, or click
his icon by the clock, for size, shirt colour, pause, start with Windows and quit.
With an animId he only does that one.
"""
import ctypes
import json
import os
import random
import sys
import tkinter as tk
import winreg
from ctypes import wintypes
from pathlib import Path

FRAMES = Path(__file__).with_name('carles-frames.json')
SETTINGS = Path(os.environ.get('APPDATA') or Path.home()) / 'CarlesPet' / 'settings.json'
RUN_KEY, RUN_NAME = r'Software\Microsoft\Windows\CurrentVersion\Run', 'CarlesPet'
KEY = '#ff00fe'           # the see-through colour; not used by any part of him
INK_DARK = '#e8e2d8'      # symbols (z, !) on dark windows, as the lab uses on a dark page
SHIRTS = [('Pink', '#E86AA0'), ('Red', '#D9483B'), ('Orange', '#EE8A2E'), ('Yellow', '#F2CF48'),
          ('Green', '#4CAF6A'), ('Teal', '#2BA5A0'), ('Blue', '#3D7FD6'), ('Purple', '#8E5BC8'),
          ('Grey', '#8A8F98')]
SIZES = (1, 2, 3)         # 1× is 4 screen pixels per unit at 100 % display scaling

ACTIVITIES = ['idle', 'walk', 'build', 'groove', 'read', 'dance', 'think', 'sweep', 'carry']
WALK_SPEED = 12.5         # units per second: 50 screen px/s at 4 px per unit
SLEEP_AFTER = 60          # seconds without input before he stretches, yawns and naps
PEEK_CHANCE = 0.2         # how often a walk goes off to a screen edge to peek instead
CLICK_GAP = 300           # ms: clicks closer together than this count as one burst
DRAG_START = 4            # px the pointer must move while held before it's a drag
GRAVITY = 600             # units per second², when he's dropped

user32, kernel32, shell32, gdi32 = ctypes.windll.user32, ctypes.windll.kernel32, ctypes.windll.shell32, ctypes.windll.gdi32
W = wintypes
LRESULT = ctypes.c_ssize_t
WNDPROC = ctypes.WINFUNCTYPE(LRESULT, W.HWND, W.UINT, W.WPARAM, W.LPARAM)


def sig(fn, res, *args):
    fn.restype, fn.argtypes = res, list(args)


sig(user32.GetParent, W.HWND, W.HWND)
sig(user32.GetAncestor, W.HWND, W.HWND, W.UINT)
sig(user32.WindowFromPoint, W.HWND, W.POINT)
sig(user32.GetWindowLongW, W.LONG, W.HWND, ctypes.c_int)
sig(user32.SetWindowLongW, W.LONG, W.HWND, ctypes.c_int, W.LONG)
sig(user32.DefWindowProcW, LRESULT, W.HWND, W.UINT, W.WPARAM, W.LPARAM)
sig(user32.CreateWindowExW, W.HWND, W.DWORD, W.LPCWSTR, W.LPCWSTR, W.DWORD, ctypes.c_int, ctypes.c_int,
    ctypes.c_int, ctypes.c_int, W.HWND, W.HMENU, W.HINSTANCE, W.LPVOID)
sig(user32.CreatePopupMenu, W.HMENU)
sig(user32.AppendMenuW, W.BOOL, W.HMENU, W.UINT, ctypes.c_size_t, W.LPCWSTR)
sig(user32.TrackPopupMenu, W.BOOL, W.HMENU, W.UINT, ctypes.c_int, ctypes.c_int, ctypes.c_int, W.HWND, W.LPVOID)
sig(user32.DestroyMenu, W.BOOL, W.HMENU)
sig(user32.SetForegroundWindow, W.BOOL, W.HWND)
sig(user32.PostMessageW, W.BOOL, W.HWND, W.UINT, W.WPARAM, W.LPARAM)
sig(user32.CreateIconIndirect, W.HICON, W.LPVOID)
sig(user32.DestroyIcon, W.BOOL, W.HICON)
sig(user32.GetDC, W.HDC, W.HWND)
sig(user32.ReleaseDC, ctypes.c_int, W.HWND, W.HDC)
sig(gdi32.CreateDIBSection, W.HBITMAP, W.HDC, W.LPVOID, W.UINT, ctypes.POINTER(ctypes.c_void_p), W.HANDLE, W.DWORD)
sig(gdi32.CreateBitmap, W.HBITMAP, ctypes.c_int, ctypes.c_int, W.UINT, W.UINT, W.LPVOID)
sig(gdi32.DeleteObject, W.BOOL, W.HGDIOBJ)
sig(shell32.Shell_NotifyIconW, W.BOOL, W.DWORD, W.LPVOID)
sig(kernel32.GetModuleHandleW, W.HMODULE, W.LPCWSTR)
sig(kernel32.CloseHandle, W.BOOL, W.HANDLE)
kernel32.GetTickCount.restype = W.DWORD
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW, WS_EX_NOACTIVATE = 0x80, 0x8000000
SPI_GETWORKAREA = 0x30
GA_ROOT = 2
QUNS_FULLSCREEN = (2, 3, 4)  # busy (full-screen app), Direct3D full screen, presentation mode
SM_CXSMICON = 49
WM_NULL, WM_LBUTTONUP, WM_RBUTTONUP, WM_TRAY = 0, 0x202, 0x205, 0x8001
NIM_ADD, NIM_MODIFY, NIM_DELETE = 0, 1, 2
NIF_MESSAGE, NIF_ICON, NIF_TIP = 1, 2, 4
MF_CHECKED, MF_POPUP, MF_SEPARATOR = 0x8, 0x10, 0x800
TPM_RIGHTBUTTON, TPM_NONOTIFY, TPM_RETURNCMD = 0x2, 0x80, 0x100


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [('cbSize', W.UINT), ('dwTime', W.DWORD)]


class NOTIFYICONDATAW(ctypes.Structure):
    _fields_ = [('cbSize', W.DWORD), ('hWnd', W.HWND), ('uID', W.UINT), ('uFlags', W.UINT),
                ('uCallbackMessage', W.UINT), ('hIcon', W.HICON), ('szTip', W.WCHAR * 128),
                ('dwState', W.DWORD), ('dwStateMask', W.DWORD), ('szInfo', W.WCHAR * 256),
                ('uVersion', W.UINT), ('szInfoTitle', W.WCHAR * 64), ('dwInfoFlags', W.DWORD),
                ('guidItem', W.BYTE * 16), ('hBalloonIcon', W.HICON)]


class WNDCLASSW(ctypes.Structure):
    _fields_ = [('style', W.UINT), ('lpfnWndProc', WNDPROC), ('cbClsExtra', ctypes.c_int),
                ('cbWndExtra', ctypes.c_int), ('hInstance', W.HINSTANCE), ('hIcon', W.HICON),
                ('hCursor', W.HANDLE), ('hbrBackground', W.HBRUSH), ('lpszMenuName', W.LPCWSTR),
                ('lpszClassName', W.LPCWSTR)]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [('biSize', W.DWORD), ('biWidth', W.LONG), ('biHeight', W.LONG), ('biPlanes', W.WORD),
                ('biBitCount', W.WORD), ('biCompression', W.DWORD), ('biSizeImage', W.DWORD),
                ('biXPelsPerMeter', W.LONG), ('biYPelsPerMeter', W.LONG), ('biClrUsed', W.DWORD),
                ('biClrImportant', W.DWORD)]


class ICONINFO(ctypes.Structure):
    _fields_ = [('fIcon', W.BOOL), ('xHotspot', W.DWORD), ('yHotspot', W.DWORD),
                ('hbmMask', W.HBITMAP), ('hbmColor', W.HBITMAP)]


def load():
    """Palette keys and colours, and animations by id. Each frame is (ms, rects facing right,
    rects facing left), rects as (x, y, w, h, colour index) in units with y up from the ground."""
    data = json.loads(FRAMES.read_text(encoding='utf-8'))
    keys = data['keys']

    # The soft ground shadow is half transparent, which a colour-keyed window can't show, so it's left out.
    def rects(flat):
        return [tuple(flat[i:i + 5]) for i in range(0, len(flat), 5) if keys[flat[i + 4]] != '_shadow']

    anims = {}
    for a in data['anims']:
        a['frames'] = [(f['d'], rects(f['R']), rects(f['L'])) for f in a['frames']]
        anims[a['id']] = a
    # two poses used on their own: the front view halfway through a turn, and falling with arms up
    anims['front'] = {'id': 'front', 'loop': False, 'dur': 120, 'frames': [(120,) + anims['turn']['frames'][1][1:]]}
    anims['falling'] = {'id': 'falling', 'loop': True, 'dur': 1000, 'frames': [(1000,) + anims['fall']['frames'][0][1:]]}
    return keys, data['colors'], anims


def work_area():
    """The main screen minus the taskbar: (left, top, right, bottom)."""
    r = wintypes.RECT()
    user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(r), 0)
    return r.left, r.top, r.right, r.bottom


def idle_ms():
    """Milliseconds since the last mouse or keyboard input anywhere."""
    li = LASTINPUTINFO(ctypes.sizeof(LASTINPUTINFO), 0)
    user32.GetLastInputInfo(ctypes.byref(li))
    return (kernel32.GetTickCount() - li.dwTime) & 0xFFFFFFFF


def fullscreen_app():
    """True while a full-screen app, game or presentation is in front."""
    state = ctypes.c_int(0)
    return shell32.SHQueryUserNotificationState(ctypes.byref(state)) == 0 and state.value in QUNS_FULLSCREEN


def dark_mode():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Themes\Personalize') as k:
            return winreg.QueryValueEx(k, 'AppsUseLightTheme')[0] == 0
    except OSError:
        return False


def read_settings():
    try:
        return json.loads(SETTINGS.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def save_settings(settings):
    try:
        SETTINGS.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS.write_text(json.dumps(settings), encoding='utf-8')
    except OSError:
        pass


def startup_command():
    exe = Path(sys.executable)
    pyw = exe.with_name('pythonw.exe')  # no console window
    return f'"{pyw if pyw.exists() else exe}" -I "{Path(__file__).resolve()}"'


def starts_with_windows():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as k:
            winreg.QueryValueEx(k, RUN_NAME)
            return True
    except OSError:
        return False


def set_start_with_windows(on):
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
        if on:
            winreg.SetValueEx(k, RUN_NAME, 0, winreg.REG_SZ, startup_command())
        else:
            try:
                winreg.DeleteValue(k, RUN_NAME)
            except FileNotFoundError:
                pass


def icon_pixels(rects, colors, n):
    """His head and shoulders (rows 6 to 21 of a standing frame: 16 × 16 units) as n × n BGRA, top row first."""
    k = max(1, n // 16)
    pad = (n - 16 * k) // 2
    px = bytearray(n * n * 4)
    for x, y, w, h, c in rects:
        b = bytes((int(colors[c][5:7], 16), int(colors[c][3:5], 16), int(colors[c][1:3], 16), 255))
        for i in range(max(x, -8), min(x + w, 8)):
            for j in range(max(y, 6), min(y + h, 22)):
                for dy in range(k):
                    row = pad + (21 - j) * k + dy
                    for dx in range(k):
                        o = (row * n + pad + (i + 8) * k + dx) * 4
                        px[o:o + 4] = b
    return px


def save_ico(path, rects, colors, sizes=(16, 32, 48, 64)):
    """Write an .ico file (32-bit images with alpha), e.g. for a desktop shortcut."""
    images = []
    for n in sizes:
        px = icon_pixels(rects, colors, n)
        rows = b''.join(bytes(px[r * n * 4:(r + 1) * n * 4]) for r in reversed(range(n)))  # bottom-up
        mask = bytes(((n + 31) // 32) * 4 * n)  # unused: the alpha channel decides
        images.append(bytes(BITMAPINFOHEADER(40, n, 2 * n, 1, 32)) + rows + mask)
    head = (0).to_bytes(2, 'little') + (1).to_bytes(2, 'little') + len(sizes).to_bytes(2, 'little')
    offset, entries = 6 + 16 * len(sizes), b''
    for n, img in zip(sizes, images):
        entries += bytes((n % 256, n % 256, 0, 0)) + (1).to_bytes(2, 'little') + (32).to_bytes(2, 'little') \
            + len(img).to_bytes(4, 'little') + offset.to_bytes(4, 'little')
        offset += len(img)
    Path(path).write_bytes(head + entries + b''.join(images))


def make_icon(rects, colors):
    """The tray icon, at the system's small-icon size."""
    n = user32.GetSystemMetrics(SM_CXSMICON)
    px = icon_pixels(rects, colors, n)
    bmi = BITMAPINFOHEADER(ctypes.sizeof(BITMAPINFOHEADER), n, -n, 1, 32)  # top-down rows
    bits = ctypes.c_void_p()
    dc = user32.GetDC(None)
    color = gdi32.CreateDIBSection(dc, ctypes.byref(bmi), 0, ctypes.byref(bits), None, 0)
    user32.ReleaseDC(None, dc)
    ctypes.memmove(bits, bytes(px), len(px))
    mask = gdi32.CreateBitmap(n, n, 1, 1, None)  # unused: the colour bitmap's alpha decides
    icon = user32.CreateIconIndirect(ctypes.byref(ICONINFO(True, 0, 0, mask, color)))
    gdi32.DeleteObject(mask)
    gdi32.DeleteObject(color)
    return icon


def popup_menu(owner, items, x, y):
    """A native menu at (x, y). items: (label, checked, action), (label, [items]) for a submenu,
    or None for a line. Runs the chosen action."""
    actions = []

    def build(items):
        h = user32.CreatePopupMenu()
        for it in items:
            if it is None:
                user32.AppendMenuW(h, MF_SEPARATOR, 0, None)
            elif isinstance(it[1], list):
                user32.AppendMenuW(h, MF_POPUP, build(it[1]), it[0])
            else:
                actions.append(it[2])
                user32.AppendMenuW(h, MF_CHECKED if it[1] else 0, len(actions), it[0])
        return h

    menu = build(items)
    user32.SetForegroundWindow(owner)  # so the menu closes when you click elsewhere
    cmd = user32.TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_NONOTIFY, x, y, 0, owner, None)
    user32.PostMessageW(owner, WM_NULL, 0, 0)
    user32.DestroyMenu(menu)  # and its submenus
    if cmd:
        actions[cmd - 1]()


class Tray:
    """His icon in the notification area, on a hidden window of its own. A click calls on_click(x, y)."""

    def __init__(self, tip, icon, on_click):
        self.on_click = on_click
        self.taskbar_created = user32.RegisterWindowMessageW('TaskbarCreated')
        self.proc = WNDPROC(self.wndproc)  # kept here, or it would be freed while Windows still calls it
        inst = kernel32.GetModuleHandleW(None)
        user32.RegisterClassW(ctypes.byref(WNDCLASSW(lpfnWndProc=self.proc, hInstance=inst, lpszClassName='CarlesPetTray')))
        self.hwnd = user32.CreateWindowExW(0, 'CarlesPetTray', tip, 0, 0, 0, 0, 0, None, None, inst, None)
        self.nid = NOTIFYICONDATAW(cbSize=ctypes.sizeof(NOTIFYICONDATAW), hWnd=self.hwnd, uID=1,
                                   uFlags=NIF_MESSAGE | NIF_ICON | NIF_TIP, uCallbackMessage=WM_TRAY,
                                   hIcon=icon, szTip=tip)
        self.added = bool(shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(self.nid)))

    def wndproc(self, hwnd, msg, wp, lp):
        if msg == WM_TRAY and lp & 0xFFFF in (WM_LBUTTONUP, WM_RBUTTONUP):
            pt = W.POINT()
            user32.GetCursorPos(ctypes.byref(pt))
            self.on_click(pt.x, pt.y)
            return 0
        if msg == self.taskbar_created:  # Explorer restarted: put the icon back
            shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(self.nid))
        return user32.DefWindowProcW(hwnd, msg, wp, lp)

    def set_icon(self, icon):
        old, self.nid.hIcon = self.nid.hIcon, icon
        shell32.Shell_NotifyIconW(NIM_MODIFY, ctypes.byref(self.nid))
        user32.DestroyIcon(old)

    def remove(self):
        shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(self.nid))
        user32.DestroyIcon(self.nid.hIcon)


class Pet:
    def __init__(self, palette, anims, scale, only=None, sleep_after=SLEEP_AFTER, size=1):
        self.keys, self.colors = palette
        self.anims, self.base, self.size = anims, scale, size
        self.scale = scale * size  # screen pixels per unit
        self.activities = only or ACTIVITIES
        self.sleep_after = sleep_after
        self.left, _, self.right, self.ground = work_area()
        self.ax, self.ay = (self.left + self.right) // 2, self.ground  # screen point of his ground point
        self.facing = 1
        self.mode = 'act'   # act | react | sleep | drag | fall | held | paused (for a full-screen app)
        self.held = False   # paused from the menu
        self.last = None    # the previous activity, so it's never picked twice in a row
        self.timers = {}
        self.clicks, self.press, self.hover = 0, None, 0
        self.tray = None
        self.log = None     # a list to record every animation played (for testing)

        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes('-topmost', True)
        self.root.attributes('-transparentcolor', KEY)
        self.canvas = tk.Canvas(self.root, bg=KEY, highlightthickness=0, bd=0)
        self.canvas.pack()
        self.root.update_idletasks()
        # no taskbar button, not in Alt+Tab, and clicking him doesn't take focus from your window
        self.hwnd = user32.GetParent(self.root.winfo_id())
        user32.SetWindowLongW(self.hwnd, GWL_EXSTYLE,
                              user32.GetWindowLongW(self.hwnd, GWL_EXSTYLE) | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)

        self.canvas.bind('<ButtonPress-1>', self.on_press)
        self.canvas.bind('<B1-Motion>', self.on_motion)
        self.canvas.bind('<ButtonRelease-1>', self.on_release)
        self.canvas.bind('<ButtonRelease-3>', lambda e: self.show_menu(e.x_root, e.y_root))
        self.later('poll', 1000, self.poll)
        self.root.after_idle(self.next)

    # ---------- timers ----------

    def later(self, name, ms, fn):
        self.cancel(name)
        def run():
            self.timers.pop(name, None)
            fn()
        self.timers[name] = self.root.after(max(1, int(ms)), run)

    def cancel(self, name):
        if name in self.timers:
            self.root.after_cancel(self.timers.pop(name))

    # ---------- playing ----------

    def play(self, anim_id, then=None, cycles=1, until=None, speed=0, limit=True):
        """Play an animation from its first frame. A looping one repeats `cycles` times, or until
        `until()` is true at the end of a cycle; then `then()` runs (by default, pick what's next).
        `speed` walks him the way he faces, in units per second; `limit` keeps him on the screen."""
        for name in ('frame', 'move', 'fall'):
            self.cancel(name)
        self.anim = self.anims[anim_id]
        self.frame, self.cycles, self.until, self.then = 0, cycles, until, then or self.next
        if self.log is not None:
            self.log.append(anim_id)
        self.fit()
        self.build()
        self.show()
        if speed:
            self.later('move', 1000 / speed, lambda: self.step(speed, limit))

    def fit(self):
        """Size the window to everything the animation draws, so it only changes between animations."""
        side = 1 if self.facing > 0 else 2
        rs = [r for f in self.anim['frames'] for r in f[side]] or [(0, 0, 1, 1, 0)]
        s = self.scale
        self.minx = min(r[0] for r in rs)
        self.maxy = max(r[1] + r[3] for r in rs)
        self.w = (max(r[0] + r[2] for r in rs) - self.minx) * s
        self.h = (self.maxy - min(r[1] for r in rs)) * s
        self.canvas.config(width=self.w, height=self.h)

    def build(self):
        """Draw every frame of the animation once, hidden, tagged by frame number. Two see-through
        masks on top hide whatever is past the screen's sides, for walking off to peek."""
        c, s, mx, my = self.canvas, self.scale, self.minx, self.maxy
        colors = list(self.colors)
        if dark_mode():
            colors[self.keys.index('i')] = INK_DARK
        c.delete('all')
        side = 1 if self.facing > 0 else 2
        for i, f in enumerate(self.anim['frames']):
            for x, y, w, h, col in f[side]:
                x0, y0 = (x - mx) * s, (my - y - h) * s
                c.create_rectangle(x0, y0, x0 + w * s, y0 + h * s, fill=colors[col], width=0,
                                   state='hidden', tags=f'f{i}')
        for tag in ('maskL', 'maskR'):
            c.create_rectangle(0, 0, 0, 0, fill=KEY, width=0, tags=tag)
        self.shown = None
        self.place()

    def place(self):
        s = self.scale
        x, y = round(self.ax) + self.minx * s, round(self.ay) - self.maxy * s
        self.canvas.coords('maskL', 0, 0, min(self.w, max(0, self.left - x)), self.h)
        self.canvas.coords('maskR', max(0, min(self.w, self.right - x)), 0, self.w, self.h)
        self.root.geometry(f'{self.w}x{self.h}+{x}+{y}')

    def show(self):
        if self.shown is not None:
            self.canvas.itemconfigure(f'f{self.shown}', state='hidden')
        self.canvas.itemconfigure(f'f{self.frame}', state='normal')
        self.shown = self.frame
        # sleep until the frame changes; nothing runs in between
        self.later('frame', self.anim['frames'][self.frame][0], self.advance)

    def advance(self):
        if self.frame + 1 < len(self.anim['frames']):
            self.frame += 1
            return self.show()
        # the end of a cycle: he's back on BASE, so this is where he may change animation
        self.cycles -= 1
        done = self.until() if self.until else self.cycles <= 0
        if self.anim['loop'] and not done:
            self.frame = 0
            return self.show()
        self.cancel('move')
        self.then()

    def step(self, speed, limit):
        """One unit along the way he faces, staying 10 units in from the edges if `limit`."""
        s = self.scale
        x = self.ax + self.facing * s
        if not limit or self.left + 10 * s <= x <= self.right - 10 * s:
            self.ax = x
            self.place()
        self.later('move', 1000 / speed, lambda: self.step(speed, limit))

    # ---------- what he does on his own ----------

    def next(self):
        self.mode = 'act'
        s = self.scale
        if idle_ms() >= self.sleep_after * 1000:
            return self.sleep()
        if not self.left + 10 * s <= self.ax <= self.right - 10 * s:
            return self.walk_to(self.somewhere())  # left half off the screen by a reaction
        pick = random.choice([a for a in self.activities if a != self.last] or self.activities)
        self.last = pick
        if pick == 'walk' and random.random() < PEEK_CHANCE and self.activities is ACTIVITIES:
            return self.peek(random.choice((-1, 1)))
        if pick in ('walk', 'carry'):
            return self.walk_to(self.somewhere(), pick)
        cycles = max(1, round(random.uniform(5000, 10000) / self.anims[pick]['dur']))
        self.play(pick, cycles=cycles)

    def somewhere(self):
        return random.randint(self.left + 20 * self.scale, self.right - 20 * self.scale)

    def walk_to(self, x, anim='walk', then=None, limit=True):
        """Turn to face x if needed, then walk until he's there (finishing the stride he's on)."""
        d = 1 if x > self.ax else -1
        if d != self.facing:
            return self.turn(d, lambda: self.walk_to(x, anim, then, limit))
        speed = WALK_SPEED * (0.7 if anim == 'carry' else 1)  # slower with the box
        self.play(anim, then, until=lambda: (self.ax - x) * d >= 0, speed=speed, limit=limit)

    def turn(self, d, then):
        """A glimpse of the front view, then he faces the other way."""
        def face():
            self.facing = d
            then()
        self.play('front', face)

    def peek(self, side):
        """Walk off the screen at one side, peek back in from the edge, then walk back on."""
        s = self.scale
        edge = self.right if side > 0 else self.left

        def look():
            self.facing = side             # peek's own pose turns him back toward the screen
            self.ax = edge - side * 12 * s  # peek's edge line (12 units out) on the screen edge
            self.play('peek', come_back)

        def come_back():
            self.facing = -side
            self.ax = edge + side * 14 * s  # where peek leaves him, just behind the edge
            self.walk_to(self.somewhere(), limit=False)

        self.walk_to(edge + side * 10 * s, then=look, limit=False)

    def sleep(self):
        """stretch, yawn, then nap until there's input (see poll)."""
        self.mode = 'sleep'

        def after_stretch():
            self.play('yawn', after_yawn) if self.mode == 'sleep' else self.next()

        def after_yawn():
            self.play('nap', until=lambda: False) if self.mode == 'sleep' else self.next()

        self.play('stretch', after_stretch)

    def react(self, anim_id, **kw):
        """Reactions to you start straight away, without waiting for the end of a cycle."""
        self.mode = 'react'
        self.play(anim_id, **kw)

    # ---------- clicks and dragging ----------

    def on_press(self, e):
        if self.mode in ('fall', 'held', 'paused'):
            return
        self.press = (e.x_root, e.y_root)

    def on_motion(self, e):
        if self.press is None:
            return
        if self.mode != 'drag':
            if abs(e.x_root - self.press[0]) + abs(e.y_root - self.press[1]) < DRAG_START:
                return
            self.start_drag()
        self.hold(e.x_root, e.y_root)

    def on_release(self, e):
        if self.press is None:
            return
        self.press = None
        if self.mode == 'drag':
            self.drop()
        else:
            self.click()

    def click(self):
        """1 click hops, 2 or 3 double-jump, the 4th in a fast burst annoys him."""
        self.clicks += 1
        if self.clicks >= 4:
            self.cancel('clicks')
            self.clicks = 0
            return self.react('annoyed')
        self.later('clicks', CLICK_GAP, self.clicked)

    def clicked(self):
        n, self.clicks = self.clicks, 0
        self.react('hop' if n == 1 else 'doubleJump')

    def start_drag(self):
        self.cancel('clicks')
        self.clicks = 0
        self.mode = 'drag'
        self.play('dangle', until=lambda: False)

    def hold(self, mx, my):
        """Hang him so the cursor drawn pinching his hair sits right under the real pointer."""
        side = 1 if self.facing > 0 else 2
        x, y, w, h, _ = max(self.anims['dangle']['frames'][0][side], key=lambda r: r[1] + r[3])
        self.ax, self.ay = mx - x * self.scale, my + (y + h) * self.scale
        self.place()

    def drop(self):
        """Let go: he falls to the taskbar and lands."""
        s = self.scale
        self.mode = 'fall'
        self.ax = min(max(self.ax, self.left + 10 * s), self.right - 10 * s)
        feet = self.ay - 10 * s  # dangle hangs his feet 10 units above his ground point
        if feet >= self.ground:
            self.ay = self.ground
            return self.react('land')
        self.play('falling', until=lambda: False)
        self.ay, self.vy = feet + 20 * s, 0.0  # the falling pose is drawn 20 units up
        self.place()
        self.later('fall', 16, self.fall)

    def fall(self):
        dt, s = 0.016, self.scale
        self.vy += GRAVITY * s * dt
        self.ay += self.vy * dt
        if self.ay - 20 * s >= self.ground:
            self.ay = self.ground
            return self.react('land')
        self.place()
        self.later('fall', 16, self.fall)

    # ---------- once a second: full screen, waking up, hovering ----------

    def poll(self):
        self.later('poll', 1000, self.poll)
        if fullscreen_app():
            if self.mode != 'paused':
                self.pause()
            return
        if self.mode == 'paused':
            return self.resume()
        if self.mode == 'sleep' and idle_ms() < 1500:
            if self.anim['id'] == 'nap':
                return self.react('wake')
            self.mode = 'act'  # still stretching or yawning: finish, then carry on as usual
        self.hover = self.hover + 1 if self.pointer_over() else 0
        if self.hover >= 2 and self.mode == 'act':
            self.react('love', until=lambda: not self.pointer_over())

    def pointer_over(self):
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        h = user32.WindowFromPoint(pt)
        return bool(h) and user32.GetAncestor(h, GA_ROOT) == self.hwnd

    def pause(self):
        """Out of the way of full-screen apps, with no timers running."""
        self.mode = 'paused'
        for name in ('frame', 'move', 'fall', 'clicks'):
            self.cancel(name)
        self.press, self.clicks = None, 0
        self.root.withdraw()

    def resume(self):
        self.root.deiconify()
        self.restart()

    def restart(self):
        """Back on the taskbar, inside the screen, starting afresh (or standing still if paused)."""
        for name in ('frame', 'move', 'fall', 'clicks'):
            self.cancel(name)
        self.press, self.clicks = None, 0
        s = self.scale
        self.ax = min(max(self.ax, self.left + 10 * s), self.right - 10 * s)
        self.ay = self.ground
        self.freeze() if self.held else self.next()

    def freeze(self):
        self.play('idle', until=lambda: False)
        self.cancel('frame')
        self.mode = 'held'

    # ---------- the menu (his tray icon, or right-click on him) ----------

    def show_menu(self, x, y):
        if not self.tray:
            return self.root.destroy()  # no tray (testing): right-click just quits
        shirt = self.colors[self.keys.index('o')].upper()
        popup_menu(self.tray.hwnd, [
            ('Size', [(f'{k}×', k == self.size, lambda k=k: self.set_size(k)) for k in SIZES]),
            ('Shirt colour', [(name, c == shirt, lambda c=c: self.set_shirt(c)) for name, c in SHIRTS]),
            ('Pause', self.held, self.toggle_pause),
            ('Start with Windows', starts_with_windows(), lambda: set_start_with_windows(not starts_with_windows())),
            None,
            ('Quit', False, self.quit),
        ], x, y)

    def set_size(self, k):
        self.size, self.scale = k, self.base * k
        self.save()
        if self.mode != 'paused':
            self.restart()

    def set_shirt(self, color):
        self.colors[self.keys.index('o')] = color
        self.save()
        if self.tray:
            self.tray.set_icon(self.icon())
        if self.mode != 'paused':
            self.build()  # redraw the current animation, carrying on from the same frame
            self.show()
            if self.held:
                self.cancel('frame')

    def toggle_pause(self):
        self.held = not self.held
        if self.mode != 'paused':
            self.restart()

    def save(self):
        save_settings({'size': self.size, 'shirt': self.colors[self.keys.index('o')]})

    def icon(self):
        return make_icon(self.anims['idle']['frames'][0][1], self.colors)

    def quit(self):
        if self.tray:
            self.tray.remove()
        self.root.destroy()


def main(args):
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)  # real screen pixels, so the blocks stay crisp
    except OSError:
        pass
    if '--save-icon' in args:  # used by make-shortcut.ps1
        keys, colors, anims = load()
        return save_ico(args[args.index('--save-icon') + 1], anims['idle']['frames'][0][1], colors)
    # only one Carles at a time (say, started with Windows and again by hand)
    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    k32.CreateMutexW.restype = W.HANDLE
    mutex = k32.CreateMutexW(None, False, 'Local\\CarlesPet')
    if ctypes.get_last_error() == 183:  # ERROR_ALREADY_EXISTS
        return
    keys, colors, anims = load()
    settings = read_settings()
    size = settings.get('size') if settings.get('size') in SIZES else 1
    if isinstance(settings.get('shirt'), str) and len(settings['shirt']) == 7:
        colors[keys.index('o')] = settings['shirt']
    sleep_after = SLEEP_AFTER
    if '--sleep-after' in args:
        i = args.index('--sleep-after')
        sleep_after = float(args[i + 1])
        del args[i:i + 2]
    only = [a for a in args if not a.startswith('--')]
    for a in only:
        if a not in anims:
            sys.exit(f'Unknown animation: {a}')
    dpi = user32.GetDpiForSystem() if hasattr(user32, 'GetDpiForSystem') else 96
    scale = max(1, round(4 * dpi / 96))  # 4 screen pixels per unit at 100 %, always a whole number
    pet = Pet((keys, colors), anims, scale, only or None, sleep_after, size)
    pet.tray = Tray('Carles', pet.icon(), lambda x, y: pet.root.after(1, lambda: pet.show_menu(x, y)))
    try:
        pet.root.mainloop()
    finally:
        if pet.tray.added:
            shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(pet.tray.nid))
        kernel32.CloseHandle(mutex)


if __name__ == '__main__':
    main(sys.argv[1:])
